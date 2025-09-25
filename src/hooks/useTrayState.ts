import { useCallback, useEffect, useState } from "react";
import { traySyncService } from "../services/traySync";
import {
  type TrayActions,
  type TrayState,
  useTrayStore,
} from "../stores/trayStore";
import type { TrayPreferences } from "../types/tray.types";

// Hook for popover state management
export function usePopover() {
  const popover = useTrayStore((state) => state.popover);
  const showPopover = useTrayStore((state) => state.showPopover);
  const hidePopover = useTrayStore((state) => state.hidePopover);
  const togglePopover = useTrayStore((state) => state.togglePopover);
  const updatePosition = useTrayStore((state) => state.updatePopoverPosition);
  const updateSize = useTrayStore((state) => state.updatePopoverSize);

  const syncPosition = useCallback(async () => {
    try {
      await traySyncService.syncPopoverPosition();
    } catch (error) {
      console.error("Failed to sync popover position:", error);
    }
  }, []);

  return {
    ...popover,
    show: showPopover,
    hide: hidePopover,
    toggle: togglePopover,
    updatePosition,
    updateSize,
    syncPosition,
  };
}

// Hook for navigation state management
export function useTrayNavigation() {
  const navigation = useTrayStore((state) => state.navigation);
  const navigateTo = useTrayStore((state) => state.navigateTo);
  const goBack = useTrayStore((state) => state.goBack);
  const isTransitioning = useTrayStore((state) => state.isTransitioning);
  const setTransitioning = useTrayStore((state) => state.setTransitioning);

  return {
    ...navigation,
    navigateTo,
    goBack,
    isTransitioning,
    setTransitioning,
  };
}

// Hook for session state management
export function useTraySession() {
  const session = useTrayStore((state) => state.session);
  const updateCurrentSession = useTrayStore(
    (state) => state.updateCurrentSession,
  );
  const updateSessionStatus = useTrayStore(
    (state) => state.updateSessionStatus,
  );
  const updateSessionDuration = useTrayStore(
    (state) => state.updateSessionDuration,
  );
  const setRecording = useTrayStore((state) => state.setRecording);
  const addRecentSession = useTrayStore((state) => state.addRecentSession);
  const updateRecentSessions = useTrayStore(
    (state) => state.updateRecentSessions,
  );

  return {
    ...session,
    updateCurrentSession,
    updateSessionStatus,
    updateSessionDuration,
    setRecording,
    addRecentSession,
    updateRecentSessions,
  };
}

// Hook for notification management
export function useTrayNotifications() {
  const notifications = useTrayStore((state) => state.notifications);
  const addNotification = useTrayStore((state) => state.addNotification);
  const markNotificationRead = useTrayStore(
    (state) => state.markNotificationRead,
  );
  const clearNotification = useTrayStore((state) => state.clearNotification);
  const clearAllNotifications = useTrayStore(
    (state) => state.clearAllNotifications,
  );

  return {
    ...notifications,
    addNotification,
    markNotificationRead,
    clearNotification,
    clearAllNotifications,
  };
}

// Hook for preferences and settings management
export function useTrayPreferences() {
  const preferences = useTrayStore((state) => state.preferences);
  const settings = useTrayStore((state) => state.settings);
  const updatePreferences = useTrayStore((state) => state.updatePreferences);
  const updateSettings = useTrayStore((state) => state.updateSettings);
  const resetSettings = useTrayStore((state) => state.resetSettings);

  const syncPreferences = useCallback(
    async (newPreferences: Partial<TrayPreferences>) => {
      try {
        updatePreferences(newPreferences);
        await traySyncService.syncPreferencesToBackend();
      } catch (error) {
        console.error("Failed to sync preferences:", error);
        throw error;
      }
    },
    [updatePreferences],
  );

  return {
    preferences,
    settings,
    updatePreferences,
    updateSettings,
    resetSettings,
    syncPreferences,
  };
}

// Hook for synchronization state
export function useTraySync() {
  const syncState = useTrayStore((state) => ({
    isSyncing: state.isSyncing,
    lastSyncTimestamp: state.lastSyncTimestamp,
    syncErrors: state.syncErrors,
  }));

  const startSync = useTrayStore((state) => state.startSync);
  const endSync = useTrayStore((state) => state.endSync);
  const addSyncError = useTrayStore((state) => state.addSyncError);
  const clearSyncErrors = useTrayStore((state) => state.clearSyncErrors);

  const forceSync = useCallback(async () => {
    try {
      await traySyncService.forceSync();
    } catch (error) {
      console.error("Force sync failed:", error);
      throw error;
    }
  }, []);

  return {
    ...syncState,
    startSync,
    endSync,
    addSyncError,
    clearSyncErrors,
    forceSync,
  };
}

// Main hook that provides all tray functionality
export function useTray() {
  const popover = usePopover();
  const navigation = useTrayNavigation();
  const session = useTraySession();
  const notifications = useTrayNotifications();
  const preferences = useTrayPreferences();
  const sync = useTraySync();

  return {
    popover,
    navigation,
    session,
    notifications,
    preferences,
    sync,
  };
}

// Separate hook for initializing the sync service
export function useTrayInitialization() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeSync = async () => {
      try {
        await traySyncService.initialize();
        if (mounted) {
          setIsInitialized(true);
          setInitError(null);
        }
      } catch (error) {
        if (mounted) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : "Failed to initialize tray sync";
          setInitError(errorMessage);
          console.error("Failed to initialize tray sync:", error);
        }
      }
    };

    initializeSync();

    return () => {
      mounted = false;
      traySyncService.cleanup();
    };
  }, []);

  return {
    isInitialized,
    initError,
  };
}

// Hook for subscribing to specific state changes
export function useTraySubscription<T>(
  selector: (state: TrayState & TrayActions) => T,
  callback: (value: T, previousValue: T) => void,
) {
  useEffect(() => {
    return useTrayStore.subscribe(selector, callback);
  }, [selector, callback]);
}

// Hook for getting formatted session duration
export function useSessionDuration() {
  const duration = useTrayStore((state) => state.session.sessionDuration);

  const formatDuration = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }, []);

  return {
    duration,
    formattedDuration: formatDuration(duration),
  };
}

// Hook for managing recent sessions with filtering and sorting
export function useRecentSessions() {
  const recentSessions = useTrayStore((state) => state.session.recentSessions);

  const getSessionsByStatus = useCallback(
    (status?: string) => {
      if (!status) return recentSessions;
      return recentSessions.filter((session) => session.status === status);
    },
    [recentSessions],
  );

  const getSessionsFromToday = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    return recentSessions.filter(
      (session) => session.startTime >= todayTimestamp,
    );
  }, [recentSessions]);

  const getTotalDurationToday = useCallback(() => {
    const todaySessions = getSessionsFromToday();
    return todaySessions.reduce((total, session) => {
      const duration = session.endTime
        ? session.endTime - session.startTime
        : 0;
      return total + Math.floor(duration / 1000); // Convert to seconds
    }, 0);
  }, [getSessionsFromToday]);

  return {
    recentSessions,
    getSessionsByStatus,
    getSessionsFromToday,
    getTotalDurationToday,
  };
}
