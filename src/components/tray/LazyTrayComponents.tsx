import type { ComponentType } from "react";
import { lazy, Suspense } from "react";

// Loading fallback component
function TrayComponentFallback() {
  return (
    <div className="flex items-center justify-center h-32 w-full">
      <div className="flex flex-col items-center space-y-2">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
        <p className="text-xs text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    </div>
  );
}

// Lazy-loaded components with proper error boundaries
export const LazyTrayDashboard = lazy(() =>
  import("./TrayDashboard").then((module) => ({
    default: module.TrayDashboard,
  })),
);

export const LazySessionControls = lazy(() =>
  import("./SessionControls").then((module) => ({
    default: module.SessionControls,
  })),
);

export const LazyRecentSessionsList = lazy(() =>
  import("./RecentSessionsList").then((module) => ({
    default: module.RecentSessionsList,
  })),
);

export const LazyProofPackManager = lazy(() =>
  import("./ProofPackManager").then((module) => ({
    default: module.ProofPackManager,
  })),
);

export const LazyTraySettings = lazy(() =>
  import("./TraySettings").then((module) => ({
    default: module.TraySettings,
  })),
);

// Higher-order component to wrap lazy components with Suspense
function withLazyLoading<P extends object>(
  LazyComponent: ComponentType<P>,
  fallback?: React.ReactNode,
) {
  return function LazyWrapper(props: P) {
    return (
      <Suspense fallback={fallback || <TrayComponentFallback />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  };
}

// Wrapped components ready for use
export const TrayDashboard = withLazyLoading(LazyTrayDashboard);
export const SessionControls = withLazyLoading(LazySessionControls);
export const RecentSessionsList = withLazyLoading(LazyRecentSessionsList);
export const ProofPackManager = withLazyLoading(LazyProofPackManager);
export const TraySettings = withLazyLoading(LazyTraySettings);

// Preload function for critical components
export function preloadCriticalComponents() {
  // Preload dashboard as it's the first view users see
  import("./TrayDashboard");
  import("./SessionControls");
}

// Preload function for secondary components
export function preloadSecondaryComponents() {
  import("./RecentSessionsList");
  import("./ProofPackManager");
  import("./TraySettings");
}

// Component registry for dynamic loading
export const LAZY_COMPONENT_REGISTRY = {
  dashboard: TrayDashboard,
  "session-controls": SessionControls,
  "recent-sessions": RecentSessionsList,
  "proof-pack-manager": ProofPackManager,
  settings: TraySettings,
} as const;

export type LazyComponentKey = keyof typeof LAZY_COMPONENT_REGISTRY;
