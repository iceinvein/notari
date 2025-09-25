import { useEffect } from "react";
import { useOptimizedEventHandler } from "../../hooks/useOptimizedEventHandling";
import { useTrayErrorHandling } from "../../hooks/useTrayErrorHandling";
import { trayResourceManager } from "../../services/tray/TrayResourceManager";
import type { TrayView } from "../../types/tray.types";
import {
  ProofPackManager,
  preloadCriticalComponents,
  RecentSessionsList,
  SessionControls,
  TrayDashboard,
  TraySettings,
} from "./LazyTrayComponents";
import { TrayErrorBoundary } from "./TrayErrorBoundary";
import { TrayErrorRecoveryScreen } from "./TrayErrorRecoveryScreen";
import {
  TrayNavigationHeader,
  TrayRouterOutlet,
  TrayRouterProvider,
  useTrayRouter,
  useViewRegistration,
} from "./TrayRouter";

// Define all available views
const trayViews: TrayView[] = [
  {
    id: "dashboard",
    component: TrayDashboard,
    title: "Notari",
    canGoBack: false,
  },
  {
    id: "session-controls",
    component: SessionControls,
    title: "Session Controls",
    canGoBack: true,
  },
  {
    id: "recent-sessions",
    component: RecentSessionsList,
    title: "Recent Sessions",
    canGoBack: true,
  },
  {
    id: "proof-pack-manager",
    component: ProofPackManager,
    title: "Proof Pack Manager",
    canGoBack: true,
  },
  {
    id: "settings",
    component: TraySettings,
    title: "Settings",
    canGoBack: true,
  },
];

// Component to register all views
function ViewRegistrar() {
  // Register each view with individual hook calls at the top level
  // Access views directly by index since we know the array structure
  useViewRegistration(trayViews[0]); // dashboard
  useViewRegistration(trayViews[1]); // session-controls
  useViewRegistration(trayViews[2]); // recent-sessions
  useViewRegistration(trayViews[3]); // proof-pack-manager
  useViewRegistration(trayViews[4]); // settings

  return null;
}

// Main tray content component
function TrayContent() {
  const { navigateTo, getCurrentView } = useTrayRouter();

  // Navigate to dashboard on mount if no current view
  useEffect(() => {
    const currentView = getCurrentView();
    if (!currentView) {
      navigateTo("dashboard");
    }
  }, [navigateTo, getCurrentView]);

  // Initialize resource manager and preload critical components
  useEffect(() => {
    const initializeResources = async () => {
      try {
        await trayResourceManager.initialize();
        preloadCriticalComponents();
      } catch (error) {
        console.error("Failed to initialize tray resources:", error);
      }
    };

    initializeResources();

    return () => {
      trayResourceManager.cleanup();
    };
  }, []);

  // Add optimized event handlers for user activity tracking
  useOptimizedEventHandler(
    "mousedown",
    () => trayResourceManager.recordActivity(),
    document,
    { passive: true, recordActivity: false }, // Don't double-record activity
  );

  useOptimizedEventHandler(
    "keydown",
    () => trayResourceManager.recordActivity(),
    document,
    { passive: true, recordActivity: false },
  );

  return (
    <div className="w-full h-full bg-white dark:bg-gray-900 flex flex-col">
      <TrayNavigationHeader />
      <div className="flex-1 overflow-hidden">
        <TrayRouterOutlet />
      </div>
    </div>
  );
}

// Main tray app component with error handling
interface TrayAppProps {
  className?: string;
}

export function TrayApp({ className = "" }: TrayAppProps) {
  const [errorState] = useTrayErrorHandling();

  const initialView: TrayView = {
    id: "dashboard",
    component: TrayDashboard,
    title: "Notari",
    canGoBack: false,
  };

  // Show error recovery screen if tray has critical errors
  if (errorState.hasError && !errorState.fallbackActive) {
    return (
      <div className={`w-[400px] h-[600px] ${className}`}>
        <TrayErrorRecoveryScreen />
      </div>
    );
  }

  return (
    <div className={`w-[400px] h-[600px] ${className}`}>
      <TrayErrorBoundary
        onError={(error, errorInfo) => {
          console.error(
            "TrayApp Error Boundary caught error:",
            error,
            errorInfo,
          );
        }}
        maxRetries={3}
        resetOnPropsChange={true}
      >
        <TrayRouterProvider initialView={initialView}>
          <ViewRegistrar />
          <TrayContent />
        </TrayRouterProvider>
      </TrayErrorBoundary>
    </div>
  );
}
