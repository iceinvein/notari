import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Progress,
} from "@heroui/react";
import { useCallback, useEffect, useState } from "react";
import { SessionManager } from "../../services/session/SessionManager";
import { SessionStatus, type WorkSession } from "../../types/session.types";

interface SessionControlsProps {
  className?: string;
  onSessionStart?: (session: WorkSession) => void;
  onSessionStop?: (session: WorkSession) => void;
  onSessionPause?: (session: WorkSession) => void;
  onSessionResume?: (session: WorkSession) => void;
  onError?: (error: string) => void;
  compact?: boolean;
}

interface SessionStats {
  keystrokes: number;
  mouseClicks: number;
  applications: number;
  screenshots: number;
}

// Custom hook for session management
function useSessionControls(
  onSessionStart?: (session: WorkSession) => void,
  onSessionStop?: (session: WorkSession) => void,
  onSessionPause?: (session: WorkSession) => void,
  onSessionResume?: (session: WorkSession) => void,
  onError?: (error: string) => void,
) {
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);
  const [sessionDuration, setSessionDuration] = useState<string>("00:00:00");
  const [sessionStats, setSessionStats] = useState<SessionStats>({
    keystrokes: 0,
    mouseClicks: 0,
    applications: 0,
    screenshots: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const sessionManager = new SessionManager();

  // Format duration from milliseconds to HH:MM:SS
  const formatDuration = useCallback((durationMs: number): string => {
    const totalSeconds = Math.floor(durationMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, []);

  // Update session duration every second for active sessions
  useEffect(() => {
    let interval: number;

    if (activeSession && activeSession.status === SessionStatus.Active) {
      interval = window.setInterval(() => {
        const duration = Date.now() - activeSession.startTime;
        setSessionDuration(formatDuration(duration));

        // Mock session stats updates (in real app, these would come from backend)
        setSessionStats((prev) => ({
          keystrokes: prev.keystrokes + Math.floor(Math.random() * 5),
          mouseClicks: prev.mouseClicks + Math.floor(Math.random() * 2),
          applications: prev.applications,
          screenshots: prev.screenshots + (Math.random() > 0.95 ? 1 : 0),
        }));
      }, 1000);
    }

    return () => {
      if (interval) {
        window.clearInterval(interval);
      }
    };
  }, [activeSession, formatDuration]);

  // Load active session on mount
  useEffect(() => {
    const loadActiveSession = async () => {
      try {
        setIsLoading(true);

        // Mock user ID - in real app this would come from auth context
        const userId = "user-1";

        // Get active sessions
        const activeSessions = await sessionManager.getActiveSessions(userId);
        if (activeSessions.length > 0) {
          const session = activeSessions[0];
          setActiveSession(session);
          const duration = Date.now() - session.startTime;
          setSessionDuration(formatDuration(duration));

          // Initialize mock stats based on session duration
          const durationMinutes = Math.floor(duration / 60000);
          setSessionStats({
            keystrokes: durationMinutes * 150 + Math.floor(Math.random() * 100),
            mouseClicks: durationMinutes * 45 + Math.floor(Math.random() * 50),
            applications: Math.min(Math.floor(durationMinutes / 10) + 1, 8),
            screenshots:
              Math.floor(durationMinutes / 5) + Math.floor(Math.random() * 5),
          });
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load session data";
        onError?.(errorMessage);
        console.error("Failed to load session data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadActiveSession();
  }, [formatDuration, onError, sessionManager.getActiveSessions]);

  const startSession = async () => {
    try {
      setIsProcessing(true);
      const userId = "user-1";
      const config = {
        captureScreen: true,
        captureKeystrokes: true,
        captureMouse: true,
        privacyFilters: [],
        qualitySettings: "high",
      };

      const newSession = await sessionManager.createSession(userId, config);
      setActiveSession(newSession);
      setSessionDuration("00:00:00");
      setSessionStats({
        keystrokes: 0,
        mouseClicks: 0,
        applications: 1,
        screenshots: 0,
      });

      onSessionStart?.(newSession);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to start session";
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const stopSession = async () => {
    if (!activeSession) return;

    try {
      setIsProcessing(true);
      await sessionManager.stopSession(activeSession.id);

      const stoppedSession = {
        ...activeSession,
        status: SessionStatus.Completed,
        endTime: Date.now(),
      };
      onSessionStop?.(stoppedSession);

      setActiveSession(null);
      setSessionDuration("00:00:00");
      setSessionStats({
        keystrokes: 0,
        mouseClicks: 0,
        applications: 0,
        screenshots: 0,
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to stop session";
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const pauseSession = async () => {
    if (!activeSession) return;

    try {
      setIsProcessing(true);
      await sessionManager.pauseSession(activeSession.id);
      const pausedSession = { ...activeSession, status: SessionStatus.Paused };
      setActiveSession(pausedSession);
      onSessionPause?.(pausedSession);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to pause session";
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const resumeSession = async () => {
    if (!activeSession) return;

    try {
      setIsProcessing(true);
      await sessionManager.resumeSession(activeSession.id);
      const resumedSession = { ...activeSession, status: SessionStatus.Active };
      setActiveSession(resumedSession);
      onSessionResume?.(resumedSession);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to resume session";
      onError?.(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    activeSession,
    sessionDuration,
    sessionStats,
    isLoading,
    isProcessing,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    formatDuration,
  };
}

export function SessionControls({
  className = "",
  onSessionStart,
  onSessionStop,
  onSessionPause,
  onSessionResume,
  onError,
  compact = false,
}: SessionControlsProps) {
  const {
    activeSession,
    sessionDuration,
    sessionStats,
    isLoading,
    isProcessing,
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
  } = useSessionControls(
    onSessionStart,
    onSessionStop,
    onSessionPause,
    onSessionResume,
    onError,
  );

  if (isLoading) {
    return (
      <div
        className={`p-4 flex items-center justify-center min-h-[200px] ${className}`}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Loading session...
          </p>
        </div>
      </div>
    );
  }

  // Compact view for tray dashboard
  if (compact) {
    return (
      <div className={`space-y-3 ${className}`}>
        {activeSession ? (
          <Card className="border-2 border-primary-200 bg-primary-50/50 dark:bg-primary-900/20">
            <CardBody className="py-3">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-3 h-3 rounded-full ${
                      activeSession.status === SessionStatus.Active
                        ? "bg-success-500 animate-pulse"
                        : "bg-warning-500"
                    }`}
                  />
                  <span className="text-sm font-medium">
                    {activeSession.status === SessionStatus.Active
                      ? "Recording"
                      : "Paused"}
                  </span>
                </div>
                <span className="text-sm font-mono">{sessionDuration}</span>
              </div>

              <div className="flex gap-2">
                {activeSession.status === SessionStatus.Active ? (
                  <>
                    <Button
                      type="button"
                      color="warning"
                      variant="flat"
                      size="sm"
                      onPress={pauseSession}
                      isLoading={isProcessing}
                      className="flex-1"
                    >
                      Pause
                    </Button>
                    <Button
                      type="button"
                      color="danger"
                      size="sm"
                      onPress={stopSession}
                      isLoading={isProcessing}
                      className="flex-1"
                    >
                      Stop
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      type="button"
                      color="success"
                      size="sm"
                      onPress={resumeSession}
                      isLoading={isProcessing}
                      className="flex-1"
                    >
                      Resume
                    </Button>
                    <Button
                      type="button"
                      color="danger"
                      variant="flat"
                      size="sm"
                      onPress={stopSession}
                      isLoading={isProcessing}
                      className="flex-1"
                    >
                      Stop
                    </Button>
                  </>
                )}
              </div>
            </CardBody>
          </Card>
        ) : (
          <Button
            type="button"
            color="primary"
            size="sm"
            onPress={startSession}
            isLoading={isProcessing}
            className="w-full"
          >
            Start New Session
          </Button>
        )}
      </div>
    );
  }

  // Full view for dedicated session controls page
  return (
    <div className={`p-4 space-y-4 max-w-[400px] ${className}`}>
      {/* Current Session Status */}
      {activeSession ? (
        <Card
          className={`border-2 ${
            activeSession.status === SessionStatus.Active
              ? "border-success-200 bg-success-50/50 dark:bg-success-900/20"
              : "border-warning-200 bg-warning-50/50 dark:bg-warning-900/20"
          }`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-4 h-4 rounded-full ${
                    activeSession.status === SessionStatus.Active
                      ? "bg-success-500 animate-pulse"
                      : "bg-warning-500"
                  }`}
                />
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-gray-100">
                    {activeSession.status === SessionStatus.Active
                      ? "Active Session"
                      : "Paused Session"}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Started:{" "}
                    {new Date(activeSession.startTime).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              <Chip
                color={
                  activeSession.status === SessionStatus.Active
                    ? "success"
                    : "warning"
                }
                variant="flat"
                size="sm"
              >
                {activeSession.status.toUpperCase()}
              </Chip>
            </div>
          </CardHeader>

          <CardBody className="pt-0 space-y-4">
            {/* Duration Display */}
            <div className="text-center">
              <div className="text-3xl font-mono font-bold text-gray-900 dark:text-gray-100">
                {sessionDuration}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Session Duration
              </p>
            </div>

            {/* Progress Indicator for Active Sessions */}
            {activeSession.status === SessionStatus.Active && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Session Progress
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">
                    Recording...
                  </span>
                </div>
                <Progress
                  size="sm"
                  isIndeterminate
                  color="success"
                  className="w-full"
                />
              </div>
            )}

            {/* Session Statistics */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  {sessionStats.keystrokes.toLocaleString()}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Keystrokes</p>
              </div>
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  {sessionStats.mouseClicks.toLocaleString()}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Mouse Clicks</p>
              </div>
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  {sessionStats.applications}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Applications</p>
              </div>
              <div className="text-center p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="font-bold text-lg text-gray-900 dark:text-gray-100">
                  {sessionStats.screenshots}
                </p>
                <p className="text-gray-600 dark:text-gray-400">Screenshots</p>
              </div>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody className="text-center py-8">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">⏸️</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-gray-100 text-lg">
                  No Active Session
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Start recording your work session
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Session Controls */}
      <div className="space-y-3">
        {activeSession ? (
          activeSession.status === SessionStatus.Active ? (
            <>
              <Button
                type="button"
                color="warning"
                variant="flat"
                size="lg"
                onPress={pauseSession}
                isLoading={isProcessing}
                className="w-full"
              >
                Pause Session
              </Button>
              <Button
                type="button"
                color="danger"
                size="lg"
                onPress={stopSession}
                isLoading={isProcessing}
                className="w-full"
              >
                Stop Session
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                color="success"
                size="lg"
                onPress={resumeSession}
                isLoading={isProcessing}
                className="w-full"
              >
                Resume Session
              </Button>
              <Button
                type="button"
                color="danger"
                variant="flat"
                size="lg"
                onPress={stopSession}
                isLoading={isProcessing}
                className="w-full"
              >
                Stop Session
              </Button>
            </>
          )
        ) : (
          <Button
            type="button"
            color="primary"
            size="lg"
            onPress={startSession}
            isLoading={isProcessing}
            className="w-full"
          >
            Start New Session
          </Button>
        )}
      </div>

      {/* Additional Actions */}
      {activeSession && (
        <Card className="bg-gray-50 dark:bg-gray-800">
          <CardBody className="py-3">
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3 text-sm">
              Session Actions
            </h4>
            <div className="space-y-2">
              <Button
                type="button"
                variant="flat"
                size="sm"
                className="w-full justify-start"
                isDisabled={isProcessing}
              >
                Add Marker
              </Button>
              <Button
                type="button"
                variant="flat"
                size="sm"
                className="w-full justify-start"
                isDisabled={isProcessing}
              >
                Take Screenshot
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
