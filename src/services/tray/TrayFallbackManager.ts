import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";

export interface TrayAvailabilityStatus {
  isAvailable: boolean;
  error?: string;
  fallbackReason?: string;
  canRetry: boolean;
}

export interface FallbackOptions {
  showMainWindow?: boolean;
  showNotification?: boolean;
  retryInterval?: number;
  maxRetries?: number;
}

export class TrayFallbackManager {
  private static instance: TrayFallbackManager | null = null;
  private availabilityStatus: TrayAvailabilityStatus = {
    isAvailable: false,
    canRetry: true,
  };
  private retryCount = 0;
  private retryTimeoutId: number | null = null;
  private listeners: Array<(status: TrayAvailabilityStatus) => void> = [];

  private constructor() {
    this.setupEventListeners();
  }

  static getInstance(): TrayFallbackManager {
    if (!TrayFallbackManager.instance) {
      TrayFallbackManager.instance = new TrayFallbackManager();
    }
    return TrayFallbackManager.instance;
  }

  private setupEventListeners() {
    // Listen for fallback events from the backend
    listen("fallback-to-window", (event) => {
      console.log("Received fallback-to-window event:", event.payload);
      this.handleFallbackToWindow(event.payload as any);
    });

    // Listen for tray initialization failures
    listen("tray-init-failed", (event) => {
      console.log("Tray initialization failed:", event.payload);
      this.handleTrayInitFailure(event.payload as any);
    });

    // Listen for tray recovery events
    listen("tray-recovered", () => {
      console.log("Tray functionality recovered");
      this.handleTrayRecovery();
    });
  }

  async checkTrayAvailability(): Promise<TrayAvailabilityStatus> {
    try {
      // Try to initialize tray
      await invoke("initialize_tray");

      this.availabilityStatus = {
        isAvailable: true,
        canRetry: true,
      };

      this.retryCount = 0;
      this.notifyListeners();

      return this.availabilityStatus;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      this.availabilityStatus = {
        isAvailable: false,
        error: errorMessage,
        fallbackReason: this.determineFallbackReason(errorMessage),
        canRetry: this.canRetryBasedOnError(errorMessage),
      };

      this.notifyListeners();
      return this.availabilityStatus;
    }
  }

  private determineFallbackReason(error: string): string {
    const lowerError = error.toLowerCase();
    if (lowerError.includes("permission")) {
      return "insufficient_permissions";
    } else if (lowerError.includes("not supported")) {
      return "platform_not_supported";
    } else if (
      lowerError.includes("already exists") ||
      lowerError.includes("in use")
    ) {
      return "tray_already_in_use";
    } else if (lowerError.includes("resource")) {
      return "resource_unavailable";
    } else {
      return "unknown_error";
    }
  }

  private canRetryBasedOnError(error: string): boolean {
    // Don't retry for permission or platform support issues
    const lowerError = error.toLowerCase();
    if (
      lowerError.includes("permission") ||
      lowerError.includes("not supported")
    ) {
      return false;
    }
    return true;
  }

  async retryTrayInitialization(
    options: FallbackOptions = {},
  ): Promise<boolean> {
    const { maxRetries = 3, retryInterval = 2000 } = options;

    if (this.retryCount >= maxRetries || !this.availabilityStatus.canRetry) {
      console.log(
        "Cannot retry tray initialization: max retries reached or not retryable",
      );
      return false;
    }

    this.retryCount++;

    return new Promise((resolve) => {
      this.retryTimeoutId = window.setTimeout(async () => {
        console.log(
          `Retrying tray initialization (attempt ${this.retryCount}/${maxRetries})`,
        );

        const status = await this.checkTrayAvailability();

        if (status.isAvailable) {
          resolve(true);
        } else if (this.retryCount < maxRetries && status.canRetry) {
          // Recursive retry
          const success = await this.retryTrayInitialization(options);
          resolve(success);
        } else {
          // Max retries reached or error is not retryable
          await this.activateFallbackMode(options);
          resolve(false);
        }
      }, retryInterval);
    });
  }

  async activateFallbackMode(options: FallbackOptions = {}): Promise<void> {
    const { showMainWindow = true, showNotification = true } = options;

    console.log("Activating fallback mode due to tray unavailability");

    try {
      if (showMainWindow) {
        await this.showMainWindowFallback();
      }

      if (showNotification) {
        await this.showFallbackNotification();
      }

      // Emit event to notify components about fallback mode
      await emit("tray-fallback-activated", {
        reason: this.availabilityStatus.fallbackReason,
        error: this.availabilityStatus.error,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to activate fallback mode:", error);
    }
  }

  private async showMainWindowFallback(): Promise<void> {
    try {
      // Try to show the main window
      await invoke("show_main_window");
    } catch (error) {
      console.error("Failed to show main window fallback:", error);

      // As a last resort, try to create a new window
      try {
        await invoke("create_fallback_window");
      } catch (fallbackError) {
        console.error("Failed to create fallback window:", fallbackError);

        // Ultimate fallback: reload the page in a new window
        window.open(window.location.href, "_blank", "width=800,height=600");
      }
    }
  }

  private async showFallbackNotification(): Promise<void> {
    try {
      const message = this.getFallbackMessage();

      // Try to show system notification
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Notari - Tray Unavailable", {
          body: message,
          icon: "/icons/icon.png",
        });
      } else {
        // Fallback to browser notification API
        await invoke("show_system_notification", {
          title: "Notari - Tray Unavailable",
          message,
          notificationType: "Warning",
        });
      }
    } catch (error) {
      console.error("Failed to show fallback notification:", error);
    }
  }

  private getFallbackMessage(): string {
    switch (this.availabilityStatus.fallbackReason) {
      case "insufficient_permissions":
        return "System tray permissions are required. Please grant permissions and restart the application.";
      case "platform_not_supported":
        return "System tray is not supported on this platform. Using main window interface.";
      case "tray_already_in_use":
        return "Another instance of Notari is already running. Using main window interface.";
      case "resource_unavailable":
        return "System tray resources are unavailable. Using main window interface.";
      default:
        return "System tray is unavailable. Using main window interface instead.";
    }
  }

  private handleFallbackToWindow(payload: any): void {
    console.log("Handling fallback to window:", payload);
    this.activateFallbackMode({
      showMainWindow: true,
      showNotification: false, // Don't show notification if explicitly requested
    });
  }

  private handleTrayInitFailure(payload: any): void {
    console.log("Handling tray initialization failure:", payload);

    this.availabilityStatus = {
      isAvailable: false,
      error: payload.error || "Tray initialization failed",
      fallbackReason: payload.reason || "initialization_failed",
      canRetry: payload.canRetry !== false,
    };

    this.notifyListeners();

    // Attempt retry if possible
    if (this.availabilityStatus.canRetry) {
      this.retryTrayInitialization();
    } else {
      this.activateFallbackMode();
    }
  }

  private handleTrayRecovery(): void {
    this.availabilityStatus = {
      isAvailable: true,
      canRetry: true,
    };

    this.retryCount = 0;

    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.notifyListeners();
  }

  getAvailabilityStatus(): TrayAvailabilityStatus {
    return { ...this.availabilityStatus };
  }

  onStatusChange(
    listener: (status: TrayAvailabilityStatus) => void,
  ): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.availabilityStatus);
      } catch (error) {
        console.error("Error in tray status listener:", error);
      }
    });
  }

  async requestPermissions(): Promise<boolean> {
    try {
      // Request notification permissions
      if ("Notification" in window && Notification.permission === "default") {
        const permission = await Notification.requestPermission();
        console.log("Notification permission:", permission);
      }

      // Try to request tray permissions through backend
      await invoke("request_tray_permissions");

      return true;
    } catch (error) {
      console.error("Failed to request permissions:", error);
      return false;
    }
  }

  cleanup(): void {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    this.listeners = [];
  }
}

// Hook for using tray fallback functionality
export function useTrayFallback() {
  const fallbackManager = TrayFallbackManager.getInstance();

  const checkAvailability = () => fallbackManager.checkTrayAvailability();
  const retryInitialization = (options?: FallbackOptions) =>
    fallbackManager.retryTrayInitialization(options);
  const activateFallback = (options?: FallbackOptions) =>
    fallbackManager.activateFallbackMode(options);
  const getStatus = () => fallbackManager.getAvailabilityStatus();
  const requestPermissions = () => fallbackManager.requestPermissions();

  return {
    checkAvailability,
    retryInitialization,
    activateFallback,
    getStatus,
    requestPermissions,
    onStatusChange: fallbackManager.onStatusChange.bind(fallbackManager),
  };
}
