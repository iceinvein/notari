import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Progress,
  useDisclosure,
} from "@heroui/react";
import { useEffect, useState } from "react";
import type { SessionStatus, WorkSession } from "../../types";
import { SessionCard } from "./SessionCard";
import { SessionConfigModal } from "./SessionConfigModal";
import { SessionControls } from "./SessionControls";

export function SessionManagement() {
  const [sessions, setSessions] = useState<WorkSession[]>([]);
  const [activeSession, setActiveSession] = useState<WorkSession | null>(null);

  const {
    isOpen: isConfigOpen,
    onOpen: onConfigOpen,
    onOpenChange: onConfigOpenChange,
  } = useDisclosure();

  // Mock data for demonstration
  useEffect(() => {
    const mockSessions: WorkSession[] = [
      {
        id: "session-1",
        userId: "user-1",
        startTime: Date.now() - 3600000, // 1 hour ago
        endTime: Date.now() - 1800000, // 30 minutes ago
        status: "completed" as SessionStatus,
        captureConfig: {
          captureScreen: true,
          captureKeystrokes: true,
          captureMouse: true,
          privacyFilters: [],
          qualitySettings: "high",
        },
        encryptedDataPath: "/path/to/encrypted/data",
        integrityHash: "abc123",
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now() - 1800000,
      },
      {
        id: "session-2",
        userId: "user-1",
        startTime: Date.now() - 7200000, // 2 hours ago
        endTime: Date.now() - 5400000, // 1.5 hours ago
        status: "completed" as SessionStatus,
        captureConfig: {
          captureScreen: true,
          captureKeystrokes: false,
          captureMouse: true,
          privacyFilters: ["passwords"],
          qualitySettings: "medium",
        },
        encryptedDataPath: "/path/to/encrypted/data2",
        integrityHash: "def456",
        createdAt: Date.now() - 7200000,
        updatedAt: Date.now() - 5400000,
      },
    ];
    setSessions(mockSessions);
  }, []);

  const handleStartSession = () => {
    onConfigOpen();
  };

  const handleStopSession = () => {
    if (activeSession) {
      setActiveSession(null);
      // Update session status to completed
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSession.id
            ? {
                ...session,
                status: "completed" as SessionStatus,
                endTime: Date.now(),
              }
            : session,
        ),
      );
    }
  };

  const handlePauseSession = () => {
    if (activeSession) {
      setActiveSession({ ...activeSession, status: "paused" as SessionStatus });
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSession.id
            ? { ...session, status: "paused" as SessionStatus }
            : session,
        ),
      );
    }
  };

  const handleResumeSession = () => {
    if (activeSession) {
      setActiveSession({ ...activeSession, status: "active" as SessionStatus });
      setSessions((prev) =>
        prev.map((session) =>
          session.id === activeSession.id
            ? { ...session, status: "active" as SessionStatus }
            : session,
        ),
      );
    }
  };

  const getSessionDuration = (session: WorkSession) => {
    const start = session.startTime;
    const end = session.endTime || Date.now();
    return Math.floor((end - start) / 1000 / 60); // minutes
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Work Sessions
          </h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            Capture and manage your work sessions with tamper-evident security
          </p>
        </div>
        <Button
          color="primary"
          size="lg"
          onPress={handleStartSession}
          isDisabled={!!activeSession}
          className="font-semibold"
        >
          {activeSession ? "Session Active" : "Start New Session"}
        </Button>
      </div>

      {/* Active Session Card */}
      {activeSession && (
        <Card className="border-2 border-primary-200 bg-primary-50/50 dark:bg-primary-900/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                <h3 className="text-lg font-semibold">Active Session</h3>
                <Chip
                  color={
                    activeSession.status === "active" ? "success" : "warning"
                  }
                  variant="flat"
                  size="sm"
                >
                  {activeSession.status.toUpperCase()}
                </Chip>
              </div>
              <div className="text-sm text-gray-500">
                Duration: {getSessionDuration(activeSession)} minutes
              </div>
            </div>
          </CardHeader>
          <CardBody className="pt-0">
            <div className="space-y-4">
              <Progress
                value={75}
                color="primary"
                className="w-full"
                label="Session Progress"
                showValueLabel
              />
              <SessionControls
                session={activeSession}
                onStop={handleStopSession}
                onPause={handlePauseSession}
                onResume={handleResumeSession}
              />
            </div>
          </CardBody>
        </Card>
      )}

      {/* Session Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-primary">
              {sessions.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Sessions
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-success">
              {sessions.reduce(
                (acc, session) => acc + getSessionDuration(session),
                0,
              )}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Minutes
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="text-center">
            <div className="text-2xl font-bold text-warning">
              {sessions.filter((s) => s.status === "completed").length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Completed
            </div>
          </CardBody>
        </Card>
      </div>

      <Divider />

      {/* Session History */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Session History
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sessions.map((session) => (
            <SessionCard key={session.id} session={session} />
          ))}
        </div>
      </div>

      {/* Session Configuration Modal */}
      <SessionConfigModal
        isOpen={isConfigOpen}
        onOpenChange={onConfigOpenChange}
        onStartSession={(config) => {
          const newSession: WorkSession = {
            id: `session-${Date.now()}`,
            userId: "user-1",
            startTime: Date.now(),
            status: "active" as SessionStatus,
            captureConfig: config,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          setActiveSession(newSession);
          setSessions((prev) => [newSession, ...prev]);
          onConfigOpenChange();
        }}
      />
    </div>
  );
}
