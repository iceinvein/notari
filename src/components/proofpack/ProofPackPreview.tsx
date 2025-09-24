import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Progress,
  Spinner,
} from "@heroui/react";
import { useState } from "react";
import type { ProofPack, WorkSession } from "../../types";

interface ProofPackConfig {
  title: string;
  description: string;
  tags: string[];
  includeAIAnalysis: boolean;
  includeTimeline: boolean;
  compressionLevel: "low" | "medium" | "high";
}

interface ProofPackPreviewProps {
  config: ProofPackConfig;
  selectedSessions: WorkSession[];
  onGenerate: (proofPack: ProofPack) => void;
}

export function ProofPackPreview({
  config,
  selectedSessions,
  onGenerate,
}: ProofPackPreviewProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (startTime: number, endTime?: number) => {
    const duration = (endTime || Date.now()) - startTime;
    const minutes = Math.floor(duration / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  const getTotalDuration = () => {
    return selectedSessions.reduce((total, session) => {
      const duration = (session.endTime || Date.now()) - session.startTime;
      return total + Math.floor(duration / 1000 / 60);
    }, 0);
  };

  const getDateRange = () => {
    if (selectedSessions.length === 0) return "";

    const startTimes = selectedSessions.map((s) => s.startTime);
    const earliest = Math.min(...startTimes);
    const latest = Math.max(...startTimes);

    if (earliest === latest) {
      return formatDate(earliest);
    }

    return `${formatDate(earliest)} - ${formatDate(latest)}`;
  };

  const simulateGeneration = async () => {
    setIsGenerating(true);
    setGenerationProgress(0);

    const steps = [
      { message: "Validating session data...", duration: 1000 },
      { message: "Encrypting sensitive information...", duration: 1500 },
      { message: "Generating AI analysis...", duration: 2000 },
      { message: "Creating timeline events...", duration: 1000 },
      { message: "Compressing data...", duration: 1500 },
      { message: "Generating cryptographic signatures...", duration: 1000 },
      { message: "Finalizing proof pack...", duration: 500 },
    ];

    let progress = 0;
    const progressIncrement = 100 / steps.length;

    for (const step of steps) {
      setCurrentStep(step.message);
      await new Promise((resolve) => setTimeout(resolve, step.duration));
      progress += progressIncrement;
      setGenerationProgress(Math.min(progress, 100));
    }

    // Generate mock proof pack
    const mockProofPack: ProofPack = {
      id: `proof-pack-${Date.now()}`,
      version: "1.0",
      metadata: {
        creator: "user-1",
        created: Date.now(),
        sessions: selectedSessions.map((s) => s.id),
        totalDuration: getTotalDuration() * 60 * 1000, // convert to milliseconds
        title: config.title,
        description: config.description,
        tags: config.tags,
      },
      evidence: {
        sessions: selectedSessions.map((session) => ({
          sessionId: session.id,
          encryptedContent: new ArrayBuffer(0), // Mock empty buffer
          contentHash: `hash-${session.id}`,
          timestamp: session.startTime,
        })),
        aiAnalysis: config.includeAIAnalysis
          ? [
              {
                sessionId: selectedSessions[0]?.id || "",
                contentType: "document",
                workPatterns: [],
                confidenceScore: 0.95,
                relevanceScores: [],
                potentialFlags: [],
                summary: {
                  overview:
                    "High-quality work session with consistent typing patterns",
                  keyActivities: [
                    "Focused work period",
                    "No suspicious activity detected",
                  ],
                  timeBreakdown: [],
                  productivity: {
                    activeTime: 3600,
                    idleTime: 300,
                    focusScore: 0.95,
                    taskSwitching: 2,
                  },
                  authenticity: {
                    overallScore: 95,
                    humanLikelihood: 0.98,
                    consistencyScore: 0.92,
                    flags: [],
                  },
                },
                timestamp: Date.now(),
              },
            ]
          : [],
        timeline: config.includeTimeline
          ? [
              {
                timestamp: Date.now(),
                type: "keystroke",
                data: { count: 1250 },
                sessionId: selectedSessions[0]?.id || "",
              },
            ]
          : [],
        systemContext: {
          operatingSystem: "macOS",
          platform: "darwin",
          deviceId: "device-123",
          timezone: "America/New_York",
          locale: "en-US",
          screenResolution: { width: 1920, height: 1080 },
        },
      },
      verification: {
        integrityHash: `integrity-${Date.now()}`,
        timestamp: Date.now(),
        version: "1.0",
      },
    };

    setCurrentStep("Complete!");
    await new Promise((resolve) => setTimeout(resolve, 500));

    setIsGenerating(false);
    onGenerate(mockProofPack);
  };

  if (isGenerating) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <Spinner size="lg" className="mb-4" />
          <h3 className="text-lg font-semibold mb-2">Generating Proof Pack</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{currentStep}</p>
          <Progress
            value={generationProgress}
            color="primary"
            className="w-full max-w-md mx-auto"
            showValueLabel
          />
          <p className="text-sm text-gray-500 mt-2">
            This may take a few minutes depending on the size of your sessions
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Proof Pack Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <h3 className="text-lg font-semibold">Proof Pack Preview</h3>
            <Button color="primary" size="lg" onPress={simulateGeneration}>
              Generate Proof Pack
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                {config.title || "Untitled Proof Pack"}
              </h4>
              {config.description && (
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {config.description}
                </p>
              )}
            </div>

            {config.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {config.tags.map((tag) => (
                  <Chip key={tag} variant="flat" color="primary" size="sm">
                    {tag}
                  </Chip>
                ))}
              </div>
            )}

            <Divider />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Sessions:
                </span>
                <div className="text-lg font-bold">
                  {selectedSessions.length}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Duration:
                </span>
                <div className="text-lg font-bold">
                  {Math.floor(getTotalDuration() / 60)}h{" "}
                  {getTotalDuration() % 60}m
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Date Range:
                </span>
                <div className="text-sm">{getDateRange()}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  Compression:
                </span>
                <div className="text-sm capitalize">
                  {config.compressionLevel}
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Session Details */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Included Sessions</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            {selectedSessions.map((session, index) => (
              <div
                key={session.id}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">
                      Session {session.id.slice(-4)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {formatDate(session.startTime)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium">
                    {formatDuration(session.startTime, session.endTime)}
                  </div>
                  <div className="flex space-x-1">
                    {session.captureConfig.captureScreen && (
                      <Chip size="sm" variant="flat" color="primary">
                        Screen
                      </Chip>
                    )}
                    {session.captureConfig.captureKeystrokes && (
                      <Chip size="sm" variant="flat" color="secondary">
                        Keys
                      </Chip>
                    )}
                    {session.captureConfig.captureMouse && (
                      <Chip size="sm" variant="flat" color="success">
                        Mouse
                      </Chip>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Content Options */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Content Included</h3>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center space-x-3">
              <div
                className={`w-4 h-4 rounded-full ${config.includeAIAnalysis ? "bg-green-500" : "bg-gray-300"}`}
              />
              <span
                className={
                  config.includeAIAnalysis
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-500"
                }
              >
                AI Analysis & Insights
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div
                className={`w-4 h-4 rounded-full ${config.includeTimeline ? "bg-green-500" : "bg-gray-300"}`}
              />
              <span
                className={
                  config.includeTimeline
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-500"
                }
              >
                Detailed Timeline
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full bg-green-500" />
              <span className="text-gray-900 dark:text-white">
                Cryptographic Signatures
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="w-4 h-4 rounded-full bg-green-500" />
              <span className="text-gray-900 dark:text-white">
                Integrity Verification
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Security Notice */}
      <Card className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <CardBody>
          <div className="flex items-start space-x-3">
            <div className="w-5 h-5 text-green-500 mt-0.5">
              <svg
                fill="currentColor"
                viewBox="0 0 20 20"
                role="img"
                aria-label="Success checkmark"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-green-900 dark:text-green-100">
                Ready for Generation
              </h4>
              <p className="text-sm text-green-700 dark:text-green-200 mt-1">
                Your proof pack will be cryptographically signed and ready for
                blockchain anchoring. All sensitive data will remain encrypted
                and tamper-evident.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
