// React import not needed for this component
import { useTrayErrorRecovery } from "../../hooks/useTrayErrorHandling";

export function TrayErrorRecoveryScreen() {
  const {
    hasError,
    error,
    errorType,
    isRetrying,
    fallbackActive,
    getErrorMessage,
    getRecoveryActions,
  } = useTrayErrorRecovery();

  if (!hasError && !fallbackActive) {
    return null;
  }

  const errorMessage = getErrorMessage();
  const recoveryActions = getRecoveryActions();

  const getErrorIcon = () => {
    switch (errorType) {
      case "insufficient_permissions":
        return (
          <svg
            className="h-12 w-12 text-yellow-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            role="img"
            aria-label="Shield icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
            />
          </svg>
        );
      case "platform_not_supported":
        return (
          <svg
            className="h-12 w-12 text-orange-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            role="img"
            aria-label="Warning icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        );
      case "tray_already_in_use":
        return (
          <svg
            className="h-12 w-12 text-blue-500"
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
        );
      default:
        return (
          <svg
            className="h-12 w-12 text-red-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            role="img"
            aria-label="Alert icon"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        );
    }
  };

  const getErrorTitle = () => {
    switch (errorType) {
      case "insufficient_permissions":
        return "Permissions Required";
      case "platform_not_supported":
        return "Platform Not Supported";
      case "tray_already_in_use":
        return "Already Running";
      case "icon_resource_missing":
        return "Resources Missing";
      default:
        return "System Tray Unavailable";
    }
  };

  const getHelpText = () => {
    switch (errorType) {
      case "insufficient_permissions":
        return "Notari needs system permissions to create a tray icon. This allows you to access the application quickly from your system tray.";
      case "platform_not_supported":
        return "Your system doesn't support tray applications, but you can still use Notari through the main window interface.";
      case "tray_already_in_use":
        return "Another instance of Notari is already running. Please close other instances or continue with the main window.";
      case "icon_resource_missing":
        return "Some application resources are missing. Try restarting the application or reinstalling if the problem persists.";
      default:
        return "The system tray is temporarily unavailable. You can continue using Notari through the main window interface.";
    }
  };

  if (fallbackActive) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-900">
        <div className="text-center space-y-4 max-w-sm">
          <div className="flex justify-center">
            <svg
              className="h-12 w-12 text-green-500"
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
          </div>

          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Using Main Window
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Notari is now running in the main window interface. All features
              are available as normal.
            </p>
          </div>

          <div className="pt-4">
            <button
              onClick={() => window.close()}
              className="w-full px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
            >
              Close This Window
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-900">
      <div className="text-center space-y-6 max-w-sm">
        <div className="flex justify-center">{getErrorIcon()}</div>

        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {getErrorTitle()}
          </h3>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            {errorMessage}
          </p>

          <p className="text-xs text-gray-500 dark:text-gray-500">
            {getHelpText()}
          </p>
        </div>

        {isRetrying && (
          <div className="flex items-center justify-center space-x-2 text-blue-600 dark:text-blue-400">
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
            <span className="text-sm">Retrying...</span>
          </div>
        )}

        <div className="space-y-2 w-full">
          {recoveryActions.map((action, index) => (
            <button
              key={index}
              onClick={action.action}
              disabled={isRetrying}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                action.primary
                  ? "bg-blue-600 hover:bg-blue-700 text-white"
                  : "border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              }`}
            >
              {action.label.includes("Retry") && (
                <svg
                  className="h-4 w-4"
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
              )}
              {action.label === "Request Permissions" && (
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  role="img"
                  aria-label="Settings icon"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              )}
              {action.label === "Use Main Window" && (
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
              )}
              {action.label}
            </button>
          ))}
        </div>

        {error && (
          <details className="w-full text-xs text-gray-500 dark:text-gray-500">
            <summary className="cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 text-center">
              Technical Details
            </summary>
            <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-left overflow-auto max-h-20 text-xs">
              {error}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

// Simplified error recovery component for use in other contexts
export function TrayErrorAlert() {
  const { hasError, getErrorMessage, getRecoveryActions } =
    useTrayErrorRecovery();

  if (!hasError) {
    return null;
  }

  const errorMessage = getErrorMessage();
  const recoveryActions = getRecoveryActions();
  const primaryAction = recoveryActions.find((action) => action.primary);

  return (
    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4">
      <div className="flex items-start space-x-3">
        <svg
          className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          role="img"
          aria-label="Warning icon"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.268 16.5c-.77.833.192 2.5 1.732 2.5z"
          />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {errorMessage}
          </p>
          {primaryAction && (
            <div className="mt-2">
              <button
                onClick={primaryAction.action}
                className="text-sm bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded transition-colors"
              >
                {primaryAction.label}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
