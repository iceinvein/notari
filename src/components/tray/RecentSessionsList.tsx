import { Button, Card, CardBody, Chip, Divider, Spinner } from "@heroui/react";
import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";
import { SessionManager } from "../../services/session/SessionManager";
import { SessionStatus, type WorkSession } from "../../types/session.types";
import { useTrayRouter } from "./TrayRouter";

interface RecentSessionsListProps {
  className?: string;
  limit?: number;
}

interface SessionItemProps {
  session: WorkSession;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCreateProofPack: (sessionId: string) => void;
  onExport: (sessionId: string) => void;
  formatDuration: (durationMs: number) => string;
  formatDate: (timestamp: number) => string;
}

// Custom hook for session management
function useSessionsData(limit = 10) {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionManager = new SessionManager();

  const loadSessions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Mock user ID - in real app this would come from auth context
      const userId = "user-1";

      // Get recent sessions
      const allSessions = await sessionManager.getUserSessions(userId, limit);

      // Sort by creation time (most recent first)
      const sortedSessions = allSessions.sort(
        (a, b) => b.createdAt - a.createdAt,
      );

      setSessions(sortedSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
      console.error("Failed to load sessions:", err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionManager, limit]);

  const refreshSessions = useCallback(() => {
    loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  return {
    sessions,
    isLoading,
    error,
    refreshSessions,
    formatDuration: sessionManager.formatDuration.bind(sessionManager),
    getStatusDisplay: sessionManager.getStatusDisplay.bind(sessionManager),
  };
}

function SessionItem({
  session,
  isExpanded,
  onToggleExpand,
  onCreateProofPack,
  onExport,
  formatDuration,
  formatDate,
}: SessionItemProps) {
  const duration = session.endTime
    ? session.endTime - session.startTime
    : Date.now() - session.startTime;

  const getStatusColor = (status: SessionStatus) => {
    switch (status) {
      case SessionStatus.Active:
        return "success";
      case SessionStatus.Paused:
        return "warning";
      case SessionStatus.Completed:
        return "primary";
      case SessionStatus.Failed:
        return "danger";
      default:
        return "default";
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onToggleExpand();
    }
  };

  return (
    <Card className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
      <CardBody className="p-3">
        <button
          type="button"
          onClick={onToggleExpand}
          onKeyDown={handleKeyDown}
          className="focus:outline-none focus:ring-2 focus:ring-primary-500 rounded w-full text-left"
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                Session {session.id.slice(-8)}
              </h3>
              <div className="flex items-center space-x-2 mt-1">
                <Chip
                  color={getStatusColor(session.status)}
                  variant="flat"
                  size="sm"
                  className="text-xs"
                >
                  {session.status}
                </Chip>
                <span className="text-xs text-gray-500">
                  {formatDuration(duration)}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-gray-500">
                {formatDate(session.createdAt)}
              </span>
              <div className="mt-1">
                <span className="text-xs text-gray-400">
                  {isExpanded ? "▼" : "▶"}
                </span>
              </div>
            </div>
          </div>
        </button>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="mt-3 space-y-3">
            <Divider />

            {/* Session Details */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Started:
                </span>
                <span className="text-gray-900 dark:text-gray-100">
                  {new Date(session.startTime).toLocaleString()}
                </span>
              </div>
              {session.endTime && (
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">
                    Ended:
                  </span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {new Date(session.endTime).toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Capture Config:
                </span>
                <div className="text-right text-xs">
                  <div>
                    Screen: {session.captureConfig.captureScreen ? "✓" : "✗"}
                  </div>
                  <div>
                    Keystrokes:{" "}
                    {session.captureConfig.captureKeystrokes ? "✓" : "✗"}
                  </div>
                  <div>
                    Mouse: {session.captureConfig.captureMouse ? "✓" : "✗"}
                  </div>
                </div>
              </div>
              {session.tamperEvidence && (
                <div className="flex justify-between">
                  <span className="text-red-600 dark:text-red-400">
                    Tamper Evidence:
                  </span>
                  <span className="text-red-600 dark:text-red-400 text-xs">
                    ⚠️ Detected
                  </span>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="flex space-x-2">
              <Button
                type="button"
                size="sm"
                color="primary"
                variant="flat"
                className="flex-1"
                onPress={() => onCreateProofPack(session.id)}
                isDisabled={session.status === SessionStatus.Failed}
              >
                📦 Create Proof Pack
              </Button>
              <Button
                type="button"
                size="sm"
                color="default"
                variant="flat"
                className="flex-1"
                onPress={() => onExport(session.id)}
                isDisabled={session.status === SessionStatus.Active}
              >
                📤 Export
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export function RecentSessionsList({
  className = "",
  limit = 10,
}: RecentSessionsListProps) {
  const { navigateTo } = useTrayRouter();
  const { sessions, isLoading, error, refreshSessions, formatDuration } =
    useSessionsData(limit);

  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(
    new Set(),
  );

  const toggleExpanded = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const handleCreateProofPack = useCallback(
    (sessionId: string) => {
      navigateTo("proof-pack-manager", { sessionId });
    },
    [navigateTo],
  );

  const handleExport = useCallback(async (sessionId: string) => {
    try {
      // Call Tauri command to export session data
      await invoke("export_session_data", { sessionId });
      // Show success notification or feedback
    } catch (error) {
      console.error("Failed to export session:", error);
      // Show error notification
    }
  }, []);

  const formatDate = useCallback((timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return "Today";
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }, []);

  if (isLoading) {
    return (
      <div
        className={`p-4 flex items-center justify-center min-h-[200px] ${className}`}
      >
        <div className="text-center">
          <Spinner size="md" />
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            Loading sessions...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 space-y-4 max-w-[400px] ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Recent Sessions
        </h2>
        <Button
          type="button"
          variant="light"
          size="sm"
          onPress={refreshSessions}
          className="text-xs"
        >
          🔄 Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-danger-200 bg-danger-50 dark:bg-danger-900/20">
          <CardBody className="py-2">
            <p className="text-sm text-danger-600 dark:text-danger-400">
              {error}
            </p>
            <Button
              type="button"
              size="sm"
              variant="light"
              onPress={refreshSessions}
              className="mt-2"
            >
              Try Again
            </Button>
          </CardBody>
        </Card>
      )}

      {/* Sessions List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {sessions.map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            isExpanded={expandedSessions.has(session.id)}
            onToggleExpand={() => toggleExpanded(session.id)}
            onCreateProofPack={handleCreateProofPack}
            onExport={handleExport}
            formatDuration={formatDuration}
            formatDate={formatDate}
          />
        ))}
      </div>

      {/* Empty State */}
      {sessions.length === 0 && !error && (
        <div className="text-center py-8">
          <div className="text-4xl mb-4">📋</div>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            No recent sessions found
          </p>
          <Button
            type="button"
            color="primary"
            variant="flat"
            onPress={() => navigateTo("dashboard")}
          >
            Start your first session
          </Button>
        </div>
      )}

      {/* Load More Button */}
      {sessions.length >= limit && (
        <div className="text-center pt-4">
          <Button
            type="button"
            variant="light"
            size="sm"
            onPress={() => {
              // In a real implementation, this would load more sessions
              // For now, we'll just refresh to show the pattern
              refreshSessions();
            }}
          >
            Load More Sessions
          </Button>
        </div>
      )}
    </div>
  );
}
