import { Button, Card, CardBody, Chip } from "@heroui/react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { SessionManager } from "../../services/session/SessionManager";
import { useTrayResourceManager } from "../../services/tray/TrayResourceManager";
import { SessionStatus, type WorkSession } from "../../types/session.types";
import { AnimatedList, AnimatedListItem } from "./animations/TrayAnimations";
import { SessionControls } from "./SessionControls";
import { useTrayRouter } from "./TrayRouter";

interface TrayDashboardProps {
  className?: string;
}

// Custom hook for recent sessions management
function useRecentSessions() {
  const [recentSessions, setRecentSessions] = useState<WorkSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sessionManager = new SessionManager();

  // Load initial data
  useEffect(() => {
    const loadRecentSessions = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Mock user ID - in real app this would come from auth context
        const userId = "user-1";

        // Get recent sessions (limit to 5 for tray display)
        const sessions = await sessionManager.getUserSessions(userId, 5);
        setRecentSessions(
          sessions.filter((s) => s.status !== SessionStatus.Active),
        );
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load session data",
        );
        console.error("Failed to load session data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadRecentSessions();
  }, [sessionManager.getUserSessions]);

  return {
    recentSessions,
    setRecentSessions,
    isLoading,
    error,
    setError,
    formatDuration: sessionManager.formatDuration.bind(sessionManager),
  };
}

export function TrayDashboard({ className = "" }: TrayDashboardProps) {
  const { navigateTo } = useTrayRouter();
  const { getConfig } = useTrayResourceManager();
  const {
    recentSessions,
    setRecentSessions,
    isLoading,
    error,
    setError,
    formatDuration,
  } = useRecentSessions();

  // Local state for tracking active session from SessionControls
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const config = getConfig();

  if (isLoading) {
    return (
      <div
        className={`p-4 flex items-center justify-center min-h-[200px] ${className}`}
      >
        <div className="text-center space-y-4 w-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Loading dashboard...
          </p>

          {/* Loading skeleton for better UX */}
          <div className="space-y-3 max-w-sm mx-auto">
            <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-3/4" />
            </div>
            <div className="grid grid-cols-1 gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className={`p-4 space-y-4 max-w-[400px] ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: config.enableAnimations ? 0.3 : 0 }}
    >
      {/* Error Display */}
      {error && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="border-danger-200 bg-danger-50 dark:bg-danger-900/20">
            <CardBody className="py-2">
              <p className="text-sm text-danger-600 dark:text-danger-400">
                {error}
              </p>
            </CardBody>
          </Card>
        </motion.div>
      )}

      {/* Session Controls */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: config.enableAnimations ? 0.3 : 0, delay: 0.1 }}
      >
        <SessionControls
          compact={true}
          onSessionStart={(session) => {
            setActiveSession(session);
          }}
          onSessionStop={(session) => {
            setRecentSessions((prev) => [session, ...prev.slice(0, 4)]);
            setActiveSession(null);
          }}
          onSessionPause={(session) => {
            setActiveSession(session);
          }}
          onSessionResume={(session) => {
            setActiveSession(session);
          }}
          onError={(error) => setError(error)}
        />
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        className="space-y-2"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: config.enableAnimations ? 0.3 : 0, delay: 0.2 }}
      >
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Quick Actions
        </h3>
        <AnimatedList className="grid grid-cols-1 gap-2">
          <AnimatedListItem>
            <motion.div
              whileHover={config.enableAnimations ? { scale: 1.02 } : undefined}
              whileTap={config.enableAnimations ? { scale: 0.98 } : undefined}
            >
              <Button
                type="button"
                variant="flat"
                className="justify-start h-auto p-3 w-full"
                onPress={() => navigateTo("proof-pack-manager")}
                isDisabled={!activeSession}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">📦</span>
                  <span className="text-sm font-medium">
                    {activeSession
                      ? "Create Proof Pack"
                      : "Create Proof Pack (No Session)"}
                  </span>
                </div>
              </Button>
            </motion.div>
          </AnimatedListItem>

          <AnimatedListItem>
            <motion.div
              whileHover={config.enableAnimations ? { scale: 1.02 } : undefined}
              whileTap={config.enableAnimations ? { scale: 0.98 } : undefined}
            >
              <Button
                type="button"
                variant="flat"
                className="justify-start h-auto p-3 w-full"
                onPress={() => navigateTo("recent-sessions")}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">📋</span>
                  <span className="text-sm font-medium">Recent Sessions</span>
                </div>
              </Button>
            </motion.div>
          </AnimatedListItem>

          <AnimatedListItem>
            <motion.div
              whileHover={config.enableAnimations ? { scale: 1.02 } : undefined}
              whileTap={config.enableAnimations ? { scale: 0.98 } : undefined}
            >
              <Button
                type="button"
                variant="flat"
                className="justify-start h-auto p-3 w-full"
                onPress={() => navigateTo("settings")}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">⚙️</span>
                  <span className="text-sm font-medium">Settings</span>
                </div>
              </Button>
            </motion.div>
          </AnimatedListItem>
        </AnimatedList>
      </motion.div>

      {/* Recent Sessions Preview */}
      {recentSessions.length > 0 && (
        <motion.div
          className="space-y-2"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: config.enableAnimations ? 0.3 : 0,
            delay: 0.3,
          }}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Recent Sessions ({recentSessions.length})
            </h3>
            {recentSessions.length >= 5 && (
              <Button
                type="button"
                variant="light"
                size="sm"
                onPress={() => navigateTo("recent-sessions")}
                className="text-xs"
              >
                View All
              </Button>
            )}
          </div>
          <AnimatedList className="space-y-1">
            {recentSessions.slice(0, 3).map((session) => (
              <AnimatedListItem key={session.id}>
                <Card className="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <CardBody className="py-2 px-3">
                    <div className="flex justify-between items-center">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          Session {session.id.slice(-8)}
                        </p>
                        <div className="flex items-center space-x-2 mt-1">
                          <Chip
                            color={
                              session.status === SessionStatus.Completed
                                ? "success"
                                : "default"
                            }
                            variant="flat"
                            size="sm"
                            className="text-xs"
                          >
                            {session.status}
                          </Chip>
                          <span className="text-xs text-gray-500">
                            {formatDuration(
                              session.endTime
                                ? session.endTime - session.startTime
                                : 0,
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </AnimatedListItem>
            ))}
          </AnimatedList>
        </motion.div>
      )}
    </motion.div>
  );
}
