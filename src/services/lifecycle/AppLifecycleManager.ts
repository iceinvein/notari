import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { trayCompatibilityService } from "../compatibility/TrayCompatibilityService";

/**
 * Manages application lifecycle for tray-based startup and shutdown
 */
export class AppLifecycleManager {
  private static instance: AppLifecycleManager;
  private isInitialized = false;
  private cleanupFunctions: (() => void | Promise<void>)[] = [];

  private constructor() {}

  public static getInstance(): AppLifecycleManager {
    if (!AppLifecycleManager.instance) {
      AppLifecycleManager.instance = new AppLifecycleManager();
    }
    return AppLifecycleManager.instance;
  }

  /**
   * Initializes the application lifecycle management
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Set up event listeners for application lifecycle events
      await this.setupLifecycleListeners();

      // Initialize tray-based startup
      await this.initializeTrayStartup();

      // Set up cleanup handlers
      this.setupCleanupHandlers();

      this.isInitialized = true;
      console.log("App lifecycle manager initialized successfully");
    } catch (error) {
      console.error("Failed to initialize app lifecycle manager:", error);
      throw error;
    }
  }

  /**
   * Sets up listeners for application lifecycle events
   */
  private async setupLifecycleListeners(): Promise<void> {
    try {
      // Listen for app shutdown events
      const unlistenShutdown = await listen("app-shutdown", async () => {
        await this.handleAppShutdown();
      });
      this.cleanupFunctions.push(unlistenShutdown);

      // Listen for tray events
      const unlistenTray = await listen("tray-event", async (event) => {
        await this.handleTrayEvent(event.payload);
      });
      this.cleanupFunctions.push(unlistenTray);

      // Listen for window close events
      const unlistenWindowClose = await listen(
        "window-close-requested",
        async (event) => {
          await this.handleWindowCloseRequest(event);
        },
      );
      this.cleanupFunctions.push(unlistenWindowClose);
    } catch (error) {
      console.error("Failed to setup lifecycle listeners:", error);
      throw error;
    }
  }

  /**
   * Initializes tray-based startup sequence
   */
  private async initializeTrayStartup(): Promise<void> {
    try {
      // Initialize tray if not already done
      await invoke("initialize_tray");

      // Set up default hotkeys
      await this.setupDefaultHotkeys();

      // Initialize notification preferences
      await this.initializeNotificationPreferences();
    } catch (error) {
      console.error("Failed to initialize tray startup:", error);
      // Don't throw here - allow app to continue with fallback mode
    }
  }

  /**
   * Sets up default hotkeys for tray interaction
   */
  private async setupDefaultHotkeys(): Promise<void> {
    try {
      const defaultHotkey = await invoke<string>("get_default_hotkey_config");
      await invoke("register_hotkey", {
        id: "toggle_popover",
        hotkey: defaultHotkey,
      });
    } catch (error) {
      console.error("Failed to setup default hotkeys:", error);
      // Don't throw - hotkeys are optional
    }
  }

  /**
   * Initializes notification preferences
   */
  private async initializeNotificationPreferences(): Promise<void> {
    try {
      const preferences = await invoke("get_notification_preferences");
      if (!preferences) {
        // Set default notification preferences
        await invoke("update_notification_preferences", {
          preferences: {
            sessionStart: true,
            sessionStop: true,
            proofPackCreated: true,
            blockchainAnchor: true,
            errors: true,
            warnings: true,
          },
        });
      }
    } catch (error) {
      console.error("Failed to initialize notification preferences:", error);
      // Don't throw - notifications are optional
    }
  }

  /**
   * Sets up cleanup handlers for graceful shutdown
   */
  private setupCleanupHandlers(): void {
    // Handle browser/window close
    window.addEventListener("beforeunload", async () => {
      await this.handleAppShutdown();
    });

    // Handle process termination signals (if available in Tauri)
    if (typeof window !== "undefined" && (window as any).__TAURI_INTERNALS__) {
      // Set up Tauri-specific cleanup
      this.setupTauriCleanup();
    }
  }

  /**
   * Sets up Tauri-specific cleanup handlers
   */
  private setupTauriCleanup(): void {
    // This would be called when the Tauri app is shutting down
    // The actual implementation depends on Tauri's lifecycle events
  }

  /**
   * Handles application shutdown
   */
  private async handleAppShutdown(): Promise<void> {
    try {
      console.log("Handling app shutdown...");

      // Save any pending data
      await this.savePendingData();

      // Clean up tray resources
      await this.cleanupTrayResources();

      // Run all cleanup functions
      await this.runCleanupFunctions();

      console.log("App shutdown completed successfully");
    } catch (error) {
      console.error("Error during app shutdown:", error);
    }
  }

  /**
   * Handles tray events
   */
  private async handleTrayEvent(payload: any): Promise<void> {
    try {
      switch (payload.type) {
        case "click":
          await invoke("toggle_popover");
          break;
        case "double_click":
          await invoke("show_main_window");
          break;
        case "right_click":
          // Context menu is handled by the tray manager
          break;
        default:
          console.log("Unknown tray event:", payload);
      }
    } catch (error) {
      console.error("Failed to handle tray event:", error);
    }
  }

  /**
   * Handles window close requests
   */
  private async handleWindowCloseRequest(event: any): Promise<void> {
    try {
      const windowLabel = event.payload?.windowLabel;

      if (windowLabel === "main") {
        // Hide main window instead of closing it (keep app running in tray)
        await invoke("hide_main_window");
        event.preventDefault?.();
      } else if (windowLabel === "popover") {
        // Hide popover
        await invoke("hide_popover");
        event.preventDefault?.();
      }
    } catch (error) {
      console.error("Failed to handle window close request:", error);
    }
  }

  /**
   * Saves any pending data before shutdown
   */
  private async savePendingData(): Promise<void> {
    try {
      // Ensure data consistency
      await trayCompatibilityService.ensureDataConsistency();

      // Save any pending session data
      await invoke("flush_pending_session_data");

      // Save any pending proof pack data
      await invoke("flush_pending_proof_pack_data");
    } catch (error) {
      console.error("Failed to save pending data:", error);
      // Don't throw - we want shutdown to continue
    }
  }

  /**
   * Cleans up tray resources
   */
  private async cleanupTrayResources(): Promise<void> {
    try {
      // Unregister hotkeys
      await invoke("unregister_all_hotkeys");

      // Clean up tray
      await invoke("destroy_tray");

      // Clean up popover
      await invoke("destroy_popover");
    } catch (error) {
      console.error("Failed to cleanup tray resources:", error);
      // Don't throw - we want shutdown to continue
    }
  }

  /**
   * Runs all registered cleanup functions
   */
  private async runCleanupFunctions(): Promise<void> {
    for (const cleanup of this.cleanupFunctions) {
      try {
        await cleanup();
      } catch (error) {
        console.error("Error in cleanup function:", error);
      }
    }
    this.cleanupFunctions = [];
  }

  /**
   * Registers a cleanup function to be called on shutdown
   */
  registerCleanup(cleanup: () => void | Promise<void>): void {
    this.cleanupFunctions.push(cleanup);
  }

  /**
   * Shuts down the application gracefully
   */
  async shutdown(): Promise<void> {
    await this.handleAppShutdown();
  }
}

// Export singleton instance
export const appLifecycleManager = AppLifecycleManager.getInstance();
