import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import {
  type TrayAvailabilityStatus,
  useTrayFallback,
} from "../services/tray/TrayFallbackManager";

export interface TrayErrorState {
  hasError: boolean;
  error: string | null;
  errorType: string | null;
  canRetry: boolean;
  retryCount: number;
  isRetrying: boolean;
  fallbackActive: boolean;
  availabilityStatus: TrayAvailabilityStatus | null;
}

export interface TrayErrorActions {
  retry: () => Promise<boolean>;
  activateFallback: () => Promise<void>;
  clearError: () => void;
  requestPermissions: () => Promise<boolean>;
}

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 2000;

export function useTrayErrorHandling(): [TrayErrorState, TrayErrorActions] {
  const [errorState, setErrorState] = useState<TrayErrorState>({
    hasError: false,
    error: null,
    errorType: null,
    canRetry: true,
    retryCount: 0,
    isRetrying: false,
    fallbackActive: false,
    availabilityStatus: null,
  });

  const {
    checkAvailability,
    retryInitialization,
    activateFallback,
    requestPermissions,
    onStatusChange,
  } = useTrayFallback();

  // Listen for tray-related events
  useEffect(() => {
    const unsubscribers: Array<() => void> = [];

    // Listen for tray initialization failures
    const setupTrayInitFailedListener = async () => {
      const unlisten = await listen("tray-init-failed", (event) => {
        const payload = event.payload as any;
        console.log("Tray initialization failed:", payload);

        setErrorState((prev) => ({
          ...prev,
          hasError: true,
          error: payload.error || "Tray initialization failed",
          errorType: payload.reason || "initialization_failed",
          canRetry: payload.canRetry !== false,
          fallbackActive: false,
        }));
      });
      unsubscribers.push(unlisten);
    };

    // Listen for tray recovery
    const setupTrayRecoveredListener = async () => {
      const unlisten = await listen("tray-recovered", () => {
        console.log("Tray recovered successfully");

        setErrorState((prev) => ({
          ...prev,
          hasError: false,
          error: null,
          errorType: null,
          canRetry: true,
          retryCount: 0,
          isRetrying: false,
          fallbackActive: false,
        }));
      });
      unsubscribers.push(unlisten);
    };

    // Listen for fallback activation
    const setupFallbackActivatedListener = async () => {
      const unlisten = await listen("tray-fallback-activated", (event) => {
        const payload = event.payload as any;
        console.log("Tray fallback activated:", payload);

        setErrorState((prev) => ({
          ...prev,
          fallbackActive: true,
          isRetrying: false,
        }));
      });
      unsubscribers.push(unlisten);
    };

    // Listen for permission requests
    const setupPermissionRequestListener = async () => {
      const unlisten = await listen("permission-request", (event) => {
        const payload = event.payload as any;
        console.log("Permission request:", payload);

        // You could show a modal or notification here
        // For now, just log the message
      });
      unsubscribers.push(unlisten);
    };

    // Set up all listeners
    setupTrayInitFailedListener();
    setupTrayRecoveredListener();
    setupFallbackActivatedListener();
    setupPermissionRequestListener();

    // Listen for availability status changes
    const unsubscribeStatus = onStatusChange((status) => {
      setErrorState((prev) => ({
        ...prev,
        availabilityStatus: status,
        hasError: !status.isAvailable,
        error: status.error || null,
        canRetry: status.canRetry,
      }));
    });
    unsubscribers.push(unsubscribeStatus);

    // Initial status check
    checkAvailability().then((status) => {
      setErrorState((prev) => ({
        ...prev,
        availabilityStatus: status,
        hasError: !status.isAvailable,
        error: status.error || null,
        canRetry: status.canRetry,
      }));
    });

    // Cleanup function
    return () => {
      unsubscribers.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch (error) {
          console.error("Error unsubscribing from event:", error);
        }
      });
    };
  }, [checkAvailability, onStatusChange]);

  const retry = useCallback(async (): Promise<boolean> => {
    if (errorState.retryCount >= MAX_RETRY_ATTEMPTS || !errorState.canRetry) {
      console.log("Cannot retry: max attempts reached or not retryable");
      return false;
    }

    setErrorState((prev) => ({
      ...prev,
      isRetrying: true,
      retryCount: prev.retryCount + 1,
    }));

    try {
      const success = await retryInitialization({
        maxRetries: MAX_RETRY_ATTEMPTS - errorState.retryCount,
        retryInterval: RETRY_DELAY,
        showMainWindow: false, // Don't auto-show window on retry
        showNotification: false, // Don't show notification on retry
      });

      if (success) {
        setErrorState((prev) => ({
          ...prev,
          hasError: false,
          error: null,
          errorType: null,
          isRetrying: false,
          retryCount: 0,
        }));
        return true;
      } else {
        setErrorState((prev) => ({
          ...prev,
          isRetrying: false,
        }));
        return false;
      }
    } catch (error) {
      console.error("Retry failed:", error);
      setErrorState((prev) => ({
        ...prev,
        isRetrying: false,
        error: error instanceof Error ? error.message : "Retry failed",
      }));
      return false;
    }
  }, [errorState.retryCount, errorState.canRetry, retryInitialization]);

  const handleActivateFallback = useCallback(async (): Promise<void> => {
    try {
      await activateFallback({
        showMainWindow: true,
        showNotification: true,
      });

      setErrorState((prev) => ({
        ...prev,
        fallbackActive: true,
        isRetrying: false,
      }));
    } catch (error) {
      console.error("Failed to activate fallback:", error);
    }
  }, [activateFallback]);

  const clearError = useCallback((): void => {
    setErrorState((prev) => ({
      ...prev,
      hasError: false,
      error: null,
      errorType: null,
      retryCount: 0,
      isRetrying: false,
    }));
  }, []);

  const handleRequestPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const success = await requestPermissions();

      if (success) {
        // After requesting permissions, try to check availability again
        const status = await checkAvailability();
        setErrorState((prev) => ({
          ...prev,
          availabilityStatus: status,
          hasError: !status.isAvailable,
          error: status.error || null,
        }));
      }

      return success;
    } catch (error) {
      console.error("Failed to request permissions:", error);
      return false;
    }
  }, [requestPermissions, checkAvailability]);

  const actions: TrayErrorActions = {
    retry,
    activateFallback: handleActivateFallback,
    clearError,
    requestPermissions: handleRequestPermissions,
  };

  return [errorState, actions];
}

// Hook for components that need to handle specific tray errors
export function useTrayErrorRecovery() {
  const [errorState, actions] = useTrayErrorHandling();

  const getErrorMessage = useCallback((): string => {
    if (!errorState.error) return "";

    switch (errorState.errorType) {
      case "insufficient_permissions":
        return "Notari needs system permissions to create a tray icon. Please grant the required permissions and try again.";
      case "platform_not_supported":
        return "System tray is not supported on this platform. The application will use the main window interface instead.";
      case "tray_already_in_use":
        return "Another instance of Notari is already running. Please close other instances or use the main window interface.";
      case "icon_resource_missing":
        return "Tray icon resources are missing. Please reinstall the application or try restarting.";
      case "creation_failed":
        return "Failed to create system tray. This might be a temporary issue - please try again.";
      default:
        return (
          errorState.error || "An unknown error occurred with the system tray."
        );
    }
  }, [errorState.error, errorState.errorType]);

  const getRecoveryActions = useCallback(() => {
    const actions_list = [];

    if (errorState.canRetry && errorState.retryCount < MAX_RETRY_ATTEMPTS) {
      actions_list.push({
        label: `Retry (${MAX_RETRY_ATTEMPTS - errorState.retryCount} attempts left)`,
        action: actions.retry,
        primary: true,
      });
    }

    if (errorState.errorType === "insufficient_permissions") {
      actions_list.push({
        label: "Request Permissions",
        action: actions.requestPermissions,
        primary: false,
      });
    }

    actions_list.push({
      label: "Use Main Window",
      action: actions.activateFallback,
      primary: false,
    });

    return actions_list;
  }, [
    errorState.canRetry,
    errorState.retryCount,
    errorState.errorType,
    actions.retry,
    actions.requestPermissions,
    actions.activateFallback,
  ]);

  return {
    ...errorState,
    getErrorMessage,
    getRecoveryActions,
    ...actions,
  };
}
