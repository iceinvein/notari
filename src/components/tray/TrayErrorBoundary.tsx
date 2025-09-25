import React, { Component, type ErrorInfo, type ReactNode } from "react";

interface TrayErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

interface TrayErrorBoundaryProps {
  children: ReactNode;
  fallbackComponent?: React.ComponentType<TrayErrorFallbackProps>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRetries?: number;
  resetOnPropsChange?: boolean;
}

interface TrayErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retry: () => void;
  fallbackToWindow: () => void;
  retryCount: number;
  maxRetries: number;
}

export class TrayErrorBoundary extends Component<
  TrayErrorBoundaryProps,
  TrayErrorBoundaryState
> {
  private resetTimeoutId: number | null = null;

  constructor(props: TrayErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(
    error: Error,
  ): Partial<TrayErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);

    // Log error details for debugging
    console.error("TrayErrorBoundary caught an error:", error);
    console.error("Error info:", errorInfo);

    // Report error to monitoring service if available
    this.reportError(error, errorInfo);
  }

  componentDidUpdate(prevProps: TrayErrorBoundaryProps) {
    const { resetOnPropsChange } = this.props;
    const { hasError } = this.state;

    // Reset error state if props changed and resetOnPropsChange is enabled
    if (
      hasError &&
      resetOnPropsChange &&
      prevProps.children !== this.props.children
    ) {
      this.resetErrorBoundary();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to your error reporting service
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // For now, just log to console. In production, send to error reporting service
    console.error("Error Report:", errorReport);

    // You could also emit this to the Tauri backend for logging
    try {
      if ((window as any).__TAURI__) {
        (window as any).__TAURI__.event.emit("tray-error", errorReport);
      }
    } catch (e) {
      console.warn("Failed to emit error to Tauri backend:", e);
    }
  };

  private resetErrorBoundary = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
  };

  private handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    const { retryCount } = this.state;

    if (retryCount < maxRetries) {
      this.setState((prevState) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        retryCount: prevState.retryCount + 1,
      }));

      // Add a small delay before retry to prevent rapid retry loops
      this.resetTimeoutId = window.setTimeout(() => {
        this.resetErrorBoundary();
      }, 1000);
    }
  };

  private handleFallbackToWindow = () => {
    try {
      // Emit event to Tauri backend to show main window as fallback
      if ((window as any).__TAURI__) {
        (window as any).__TAURI__.event.emit("fallback-to-window", {
          reason: "tray-error",
          error: this.state.error?.message,
        });
      }
    } catch (e) {
      console.error("Failed to fallback to window:", e);
      // As a last resort, try to open a new window
      window.open(window.location.href, "_blank");
    }
  };

  render() {
    const { hasError, error, errorInfo, retryCount } = this.state;
    const {
      children,
      fallbackComponent: FallbackComponent,
      maxRetries = 3,
    } = this.props;

    if (hasError) {
      const fallbackProps: TrayErrorFallbackProps = {
        error,
        errorInfo,
        retry: this.handleRetry,
        fallbackToWindow: this.handleFallbackToWindow,
        retryCount,
        maxRetries,
      };

      if (FallbackComponent) {
        return <FallbackComponent {...fallbackProps} />;
      }

      return <DefaultTrayErrorFallback {...fallbackProps} />;
    }

    return children;
  }
}

// Default error fallback component
function DefaultTrayErrorFallback({
  error,
  retry,
  fallbackToWindow,
  retryCount,
  maxRetries,
}: TrayErrorFallbackProps) {
  const canRetry = retryCount < maxRetries;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-900">
      <div className="text-center space-y-4 max-w-sm">
        <div className="flex justify-center">
          <svg
            className="h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            role="img"
            aria-label="Error icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Something went wrong
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            The tray interface encountered an unexpected error.
          </p>
          {error && (
            <details className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                Error details
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-left overflow-auto max-h-20">
                {error.message}
              </pre>
            </details>
          )}
        </div>

        <div className="space-y-2">
          {canRetry && (
            <button
              onClick={retry}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                role="img"
                aria-label="Refresh icon"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Try Again ({maxRetries - retryCount} attempts left)
            </button>
          )}

          <button
            onClick={fallbackToWindow}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              role="img"
              aria-label="External link icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Open Main Window
          </button>

          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              role="img"
              aria-label="Home icon"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            Reload Application
          </button>
        </div>

        {!canRetry && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Maximum retry attempts reached. Please try reloading or use the main
            window.
          </p>
        )}
      </div>
    </div>
  );
}

// Hook for using error boundary functionality
export function useTrayErrorHandler() {
  const reportError = (error: Error, context?: string) => {
    console.error(`Tray Error${context ? ` in ${context}` : ""}:`, error);

    // Report to error monitoring service
    try {
      if ((window as any).__TAURI__) {
        (window as any).__TAURI__.event.emit("tray-error", {
          message: error.message,
          stack: error.stack,
          context,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e) {
      console.warn("Failed to report error to backend:", e);
    }
  };

  const handleAsyncError = async <T,>(
    asyncFn: () => Promise<T>,
    context?: string,
  ): Promise<T | null> => {
    try {
      return await asyncFn();
    } catch (error) {
      reportError(error as Error, context);
      return null;
    }
  };

  return {
    reportError,
    handleAsyncError,
  };
}
