import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useTrayStore } from "../stores/trayStore";
import type { SessionStatus, WorkSession } from "../types/session.types";

// Debouncing utility for sync operations
class DebouncedSyncManager {
  private timeouts = new Map<string, number>();
  private batchedUpdates = new Map<string, any>();

  debounce<T extends (...args: any[]) => any>(
    key: string,
    fn: T,
    delay: number,
  ): (...args: Parameters<T>) => void {
    return (...args: Parameters<T>) => {
      // Clear existing timeout
      const existingTimeout = this.timeouts.get(key);
      if (existingTimeout) {
        window.clearTimeout(existingTimeout);
      }

      // Set new timeout
      const timeout = window.setTimeout(() => {
        fn(...args);
        this.timeouts.delete(key);
      }, delay);

      this.timeouts.set(key, timeout);
    };
  }

  batch<T>(
    key: string,
    value: T,
    delay: number,
    processor: (values: T[]) => void,
  ): void {
    // Add to batch
    const existing = this.batchedUpdates.get(key) || [];
    this.batchedUpdates.set(key, [...existing, value]);

    // Clear existing timeout
    const existingTimeout = this.timeouts.get(key);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }

    // Set new timeout to process batch
    const timeout = window.setTimeout(() => {
      const values = this.batchedUpdates.get(key) || [];
      if (values.length > 0) {
        processor(values);
        this.batchedUpdates.delete(key);
      }
      this.timeouts.delete(key);
    }, delay);

    this.timeouts.set(key, timeout);
  }

  throttle<T extends (...args: any[]) => any>(
    key: string,
    fn: T,
    delay: number,
  ): (...args: Parameters<T>) => void {
    let lastExecution = 0;

    return (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecution;

      if (timeSinceLastExecution >= delay) {
        lastExecution = now;
        fn(...args);
      } else {
        // Clear existing timeout
        const existingTimeout = this.timeouts.get(key);
        if (existingTimeout) {
          window.clearTimeout(existingTimeout);
        }

        // Schedule execution
        const timeout = window.setTimeout(() => {
          lastExecution = Date.now();
          fn(...args);
          this.timeouts.delete(key);
        }, delay - timeSinceLastExecution);

        this.timeouts.set(key, timeout);
      }
    };
  }

  clear(): void {
    for (const timeout of this.timeouts.values()) {
      window.clearTimeout(timeout);
    }
    this.timeouts.clear();
    this.batchedUpdates.clear();
  }
}

// Event types for Tauri backend communication
export interface SessionUpdateEvent {
  session: WorkSession;
  status: SessionStatus;
  duration: number;
}

export interface SessionListUpdateEvent {
  sessions: WorkSession[];
}

export interface NotificationEvent {
  type: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
}

export interface TrayIconUpdateEvent {
  status: "idle" | "recording" | "processing";
  tooltip: string;
}

/**
 * Service for synchronizing tray state with backend services
 */
export class TraySyncService {
  private eventListeners: UnlistenFn[] = [];
  private syncInterval: number | null = null;
  private isInitialized = false;
  private debouncedSync = new DebouncedSyncManager();

  // Debounced sync methods
  private debouncedSessionSync = this.debouncedSync.debounce(
    "session-sync",
    this.syncSessionData.bind(this),
    1000, // 1 second debounce
  );

  private debouncedPreferencesSync = this.debouncedSync.debounce(
    "preferences-sync",
    this.syncPreferencesToBackend.bind(this),
    2000, // 2 second debounce
  );

  private debouncedPositionSync = this.debouncedSync.debounce(
    "position-sync",
    this.syncPopoverPosition.bind(this),
    500, // 500ms debounce for position updates
  );

  // Throttled notification handler
  private throttledNotificationHandler = this.debouncedSync.throttle(
    "notification-handler",
    (notification: NotificationEvent) => {
      const { type, title, message } = notification;
      useTrayStore.getState().addNotification({ type, title, message });
    },
    100, // Max 10 notifications per second
  );

  /**
   * Initialize the sync service and set up event listeners
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      useTrayStore.getState().startSync();

      // Set up event listeners for real-time updates
      await this.setupEventListeners();

      // Start periodic sync for session data
      this.startPeriodicSync();

      // Initial data sync
      await this.syncInitialData();

      this.isInitialized = true;
      useTrayStore.getState().endSync();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown sync error";
      useTrayStore.getState().endSync([errorMessage]);
      throw error;
    }
  }

  /**
   * Clean up event listeners and stop sync
   */
  async cleanup(): Promise<void> {
    // Remove all event listeners
    for (const unlisten of this.eventListeners) {
      unlisten();
    }
    this.eventListeners = [];

    // Stop periodic sync
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // Clear all debounced operations
    this.debouncedSync.clear();

    this.isInitialized = false;
  }

  /**
   * Set up event listeners for backend events
   */
  private async setupEventListeners(): Promise<void> {
    // Listen for session updates with batching
    const sessionUpdateListener = await listen<SessionUpdateEvent>(
      "session-update",
      (event) => {
        const { session, status, duration } = event.payload;

        // Batch session updates to prevent excessive re-renders
        this.debouncedSync.batch(
          "session-updates",
          { session, status, duration },
          50, // 50ms batch window
          (updates) => {
            // Apply the latest update from the batch
            const latestUpdate = updates[updates.length - 1];
            const store = useTrayStore.getState();

            store.updateCurrentSession(latestUpdate.session);
            store.updateSessionStatus(latestUpdate.status);
            store.updateSessionDuration(latestUpdate.duration);
            store.setRecording(latestUpdate.status === "active");
          },
        );
      },
    );
    this.eventListeners.push(sessionUpdateListener);

    // Listen for session list updates
    const sessionListListener = await listen<SessionListUpdateEvent>(
      "session-list-update",
      (event) => {
        const { sessions } = event.payload;
        useTrayStore.getState().updateRecentSessions(sessions);
      },
    );
    this.eventListeners.push(sessionListListener);

    // Listen for notifications with throttling
    const notificationListener = await listen<NotificationEvent>(
      "tray-notification",
      (event) => {
        this.throttledNotificationHandler(event.payload);
      },
    );
    this.eventListeners.push(notificationListener);

    // Listen for tray icon updates
    const trayIconListener = await listen<TrayIconUpdateEvent>(
      "tray-icon-update",
      (event) => {
        // This is handled by the backend, but we can use it for UI state
        const { status } = event.payload;
        const store = useTrayStore.getState();

        if (status === "recording") {
          store.setRecording(true);
        } else if (status === "idle") {
          store.setRecording(false);
        }
      },
    );
    this.eventListeners.push(trayIconListener);

    // Listen for popover show/hide events from backend
    const popoverListener = await listen<{
      visible: boolean;
      position?: { x: number; y: number };
    }>("popover-toggle", (event) => {
      const { visible, position } = event.payload;
      const store = useTrayStore.getState();

      if (visible) {
        store.showPopover(position);
      } else {
        store.hidePopover();
      }
    });
    this.eventListeners.push(popoverListener);
  }

  /**
   * Start periodic synchronization of session data
   */
  private startPeriodicSync(): void {
    // Sync every 5 seconds when recording, every 30 seconds when idle
    const getSyncInterval = () => {
      const isRecording = useTrayStore.getState().session.isRecording;
      return isRecording ? 5000 : 30000;
    };

    const scheduleNextSync = () => {
      this.syncInterval = window.setTimeout(async () => {
        try {
          await this.syncSessionData();
          scheduleNextSync();
        } catch (error) {
          console.error("Periodic sync failed:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Periodic sync failed";
          useTrayStore.getState().addSyncError(errorMessage);
          scheduleNextSync();
        }
      }, getSyncInterval());
    };

    scheduleNextSync();
  }

  /**
   * Sync initial data on startup
   */
  private async syncInitialData(): Promise<void> {
    try {
      // Get current session
      const currentSession = await this.getCurrentSession();
      if (currentSession) {
        useTrayStore.getState().updateCurrentSession(currentSession);
      }

      // Get recent sessions
      await this.syncSessionData();

      // Sync settings from backend
      await this.syncSettings();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Initial sync failed";
      useTrayStore.getState().addSyncError(errorMessage);
      throw error;
    }
  }

  /**
   * Sync session data from backend
   */
  private async syncSessionData(): Promise<void> {
    try {
      const sessions = await invoke<WorkSession[]>("get_recent_sessions", {
        limit: 10,
      });
      useTrayStore.getState().updateRecentSessions(sessions);
    } catch (error) {
      console.error("Failed to sync session data:", error);
      throw error;
    }
  }

  /**
   * Public method to trigger debounced session sync
   */
  public triggerSessionSync(): void {
    this.debouncedSessionSync();
  }

  /**
   * Get current active session
   */
  private async getCurrentSession(): Promise<WorkSession | null> {
    try {
      return await invoke<WorkSession | null>("get_current_session");
    } catch (error) {
      console.error("Failed to get current session:", error);
      return null;
    }
  }

  /**
   * Sync settings from backend
   */
  private async syncSettings(): Promise<void> {
    try {
      const settings = await invoke("get_tray_settings");
      if (settings) {
        useTrayStore.getState().updateSettings(settings);
      }
    } catch (error) {
      console.error("Failed to sync settings:", error);
      // Don't throw here as settings sync is not critical
    }
  }

  /**
   * Manually trigger a full sync
   */
  async forceSync(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error("Sync service not initialized");
    }

    try {
      useTrayStore.getState().startSync();
      useTrayStore.getState().clearSyncErrors();

      await this.syncInitialData();

      useTrayStore.getState().endSync();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Force sync failed";
      useTrayStore.getState().endSync([errorMessage]);
      throw error;
    }
  }

  /**
   * Update backend with current tray preferences
   */
  async syncPreferencesToBackend(): Promise<void> {
    try {
      const preferences = useTrayStore.getState().preferences;
      await invoke("update_tray_preferences", { preferences });
    } catch (error) {
      console.error("Failed to sync preferences to backend:", error);
      throw error;
    }
  }

  /**
   * Update backend with popover position
   */
  async syncPopoverPosition(): Promise<void> {
    try {
      const position = useTrayStore.getState().popover.position;
      if (position) {
        await invoke("update_popover_position", { position });
      }
    } catch (error) {
      console.error("Failed to sync popover position:", error);
      // Don't throw as this is not critical
    }
  }

  /**
   * Public methods to trigger debounced syncs
   */
  public triggerPreferencesSync(): void {
    this.debouncedPreferencesSync();
  }

  public triggerPositionSync(): void {
    this.debouncedPositionSync();
  }
}

// Singleton instance
export const traySyncService = new TraySyncService();

// Hook for using the sync service in components
export function useTraySync() {
  const syncState = useTrayStore((state) => ({
    isSyncing: state.isSyncing,
    lastSyncTimestamp: state.lastSyncTimestamp,
    syncErrors: state.syncErrors,
  }));

  return {
    ...syncState,
    forceSync: () => traySyncService.forceSync(),
    syncPreferences: () => traySyncService.triggerPreferencesSync(),
    syncPosition: () => traySyncService.triggerPositionSync(),
    syncSession: () => traySyncService.triggerSessionSync(),
  };
}
