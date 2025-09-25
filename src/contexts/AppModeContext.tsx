import { createContext, useContext, useEffect, useState } from "react";

export type AppMode = "tray" | "window";

interface AppModeContextValue {
  mode: AppMode;
  isTrayMode: boolean;
  isWindowMode: boolean;
  switchToWindowMode: () => Promise<void>;
  switchToTrayMode: () => Promise<void>;
}

const AppModeContext = createContext<AppModeContextValue | undefined>(
  undefined,
);

interface AppModeProviderProps {
  children: React.ReactNode;
}

export function AppModeProvider({ children }: AppModeProviderProps) {
  const [mode, setMode] = useState<AppMode>(() => {
    // Detect initial mode based on URL parameters or window label
    const urlParams = new URLSearchParams(window.location.search);
    const isTrayParam = urlParams.get("tray") === "true";

    // Check if we're in a popover window
    const isPopoverWindow =
      (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label ===
      "popover";

    return isTrayParam || isPopoverWindow ? "tray" : "window";
  });

  const switchToWindowMode = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("show_main_window");
      setMode("window");
    } catch (error) {
      console.error("Failed to switch to window mode:", error);
    }
  };

  const switchToTrayMode = async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("show_popover");
      setMode("tray");
    } catch (error) {
      console.error("Failed to switch to tray mode:", error);
    }
  };

  // Listen for mode changes from the backend
  useEffect(() => {
    // Skip listener setup in test environment
    if (typeof window === "undefined" || import.meta.env.MODE === "test") {
      return;
    }

    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<{ mode: AppMode }>(
          "app-mode-changed",
          (event) => {
            setMode(event.payload.mode);
          },
        );
      } catch (error) {
        // Only log in development, not in tests
        if (import.meta.env.DEV) {
          console.error("Failed to setup app mode listener:", error);
        }
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        try {
          unlisten();
        } catch {
          // Ignore cleanup errors in test environment
        }
      }
    };
  }, []);

  const contextValue: AppModeContextValue = {
    mode,
    isTrayMode: mode === "tray",
    isWindowMode: mode === "window",
    switchToWindowMode,
    switchToTrayMode,
  };

  return (
    <AppModeContext.Provider value={contextValue}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode(): AppModeContextValue {
  const context = useContext(AppModeContext);
  if (context === undefined) {
    throw new Error("useAppMode must be used within an AppModeProvider");
  }
  return context;
}

// Hook to get responsive constraints based on app mode
export function useResponsiveConstraints() {
  const { isTrayMode } = useAppMode();

  return {
    maxWidth: isTrayMode ? "400px" : "none",
    maxHeight: isTrayMode ? "600px" : "none",
    isCompact: isTrayMode,
    containerClass: isTrayMode
      ? "w-full h-full max-w-[400px] max-h-[600px] overflow-hidden"
      : "container mx-auto px-4 py-6 max-w-7xl",
  };
}
