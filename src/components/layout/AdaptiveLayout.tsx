import type React from "react";
import type { AppView } from "../../App";
import {
  useAppMode,
  useResponsiveConstraints,
} from "../../contexts/AppModeContext";
import { MainLayout } from "./MainLayout";

interface AdaptiveLayoutProps {
  children: React.ReactNode;
  currentView?: AppView;
  onViewChange?: (view: AppView) => void;
  title?: string;
  showNavigation?: boolean;
}

export function AdaptiveLayout({
  children,
  currentView,
  onViewChange,
  title = "Notari",
  showNavigation = true,
}: AdaptiveLayoutProps) {
  const { isTrayMode } = useAppMode();
  const { containerClass } = useResponsiveConstraints();

  // In tray mode, use a minimal layout
  if (isTrayMode) {
    return (
      <div className={`bg-white dark:bg-gray-900 ${containerClass}`}>
        {showNavigation && (
          <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-xs">N</span>
              </div>
              <h1 className="text-sm font-semibold text-gray-900 dark:text-white">
                {title}
              </h1>
            </div>
          </div>
        )}
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    );
  }

  // In window mode, use the full MainLayout
  if (currentView && onViewChange) {
    return (
      <MainLayout currentView={currentView} onViewChange={onViewChange}>
        {children}
      </MainLayout>
    );
  }

  // Fallback for window mode without navigation
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className={containerClass}>{children}</div>
    </div>
  );
}

// Hook to provide adaptive sizing for components
export function useAdaptiveSize() {
  const { isTrayMode } = useAppMode();

  return {
    // Button sizes
    buttonSize: isTrayMode ? "sm" : "md",
    // Input sizes
    inputSize: isTrayMode ? "sm" : "md",
    // Card padding
    cardPadding: isTrayMode ? "p-3" : "p-6",
    // Text sizes
    titleSize: isTrayMode ? "text-lg" : "text-2xl",
    subtitleSize: isTrayMode ? "text-sm" : "text-lg",
    bodySize: isTrayMode ? "text-xs" : "text-sm",
    // Spacing
    spacing: isTrayMode ? "space-y-2" : "space-y-4",
    // Grid columns
    gridCols: isTrayMode ? "grid-cols-1" : "grid-cols-2 lg:grid-cols-3",
  };
}
