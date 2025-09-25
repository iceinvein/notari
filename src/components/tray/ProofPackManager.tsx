import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useId, useState } from "react";
import type { PackConfig } from "../../services/proofPack/ProofPackAssembler";
import { proofPackAssembler } from "../../services/proofPack/ProofPackAssembler";
import { SessionManager } from "../../services/session/SessionManager";
import type { ProofPack, WorkSession } from "../../types";
import { useTrayRouter } from "./TrayRouter";

interface ProofPackManagerProps {
  sessionId?: string;
  className?: string;
}

interface ProofPackCreationState {
  step:
    | "select"
    | "configure"
    | "creating"
    | "redacting"
    | "complete"
    | "error";
  selectedSessions: string[];
  config: Partial<PackConfig>;
  createdPack?: ProofPack;
  error?: string;
  progress: number;
}

interface RecentProofPack {
  id: string;
  name: string;
  created: number;
  sessionCount: number;
  size: number;
}

export function ProofPackManager({
  sessionId,
  className = "",
}: ProofPackManagerProps) {
  useTrayRouter(); // For future navigation features
  const [sessionManager] = useState(() => new SessionManager());
  const titleId = useId();
  const descriptionId = useId();

  const [state, setState] = useState<ProofPackCreationState>({
    step: sessionId ? "configure" : "select",
    selectedSessions: sessionId ? [sessionId] : [],
    config: {
      includeScreenshots: true,
      includeTimeline: true,
      includeAIAnalysis: true,
      compressionLevel: 5,
    },
    progress: 0,
  });

  const [availableSessions, setAvailableSessions] = useState<WorkSession[]>([]);
  const [recentProofPacks, setRecentProofPacks] = useState<RecentProofPack[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);

  // Load available sessions and recent proof packs
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load recent completed sessions
        const sessions = await sessionManager.getUserSessions(
          "current-user",
          10,
        );
        const completedSessions = sessions.filter(
          (s) => s.status === "completed",
        );
        setAvailableSessions(completedSessions);

        // Load recent proof packs (mock data for now)
        setRecentProofPacks([
          {
            id: "pack-1",
            name: "Writing Project Proof",
            created: Date.now() - 86400000,
            sessionCount: 2,
            size: 1024 * 1024 * 5, // 5MB
          },
          {
            id: "pack-2",
            name: "Code Review Evidence",
            created: Date.now() - 172800000,
            sessionCount: 1,
            size: 1024 * 1024 * 2, // 2MB
          },
        ]);
      } catch (error) {
        console.error("Failed to load data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [sessionManager]);

  const handleSessionToggle = useCallback((sessionId: string) => {
    setState((prev) => ({
      ...prev,
      selectedSessions: prev.selectedSessions.includes(sessionId)
        ? prev.selectedSessions.filter((id) => id !== sessionId)
        : [...prev.selectedSessions, sessionId],
    }));
  }, []);

  const handleConfigChange = useCallback(
    (key: keyof PackConfig, value: unknown) => {
      setState((prev) => ({
        ...prev,
        config: { ...prev.config, [key]: value },
      }));
    },
    [],
  );

  const handleCreateProofPack = useCallback(async () => {
    if (state.selectedSessions.length === 0) {
      setState((prev) => ({
        ...prev,
        error: "Please select at least one session",
      }));
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        step: "creating",
        progress: 0,
        error: undefined,
      }));

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setState((prev) => ({
          ...prev,
          progress: Math.min(prev.progress + 10, 90),
        }));
      }, 200);

      const config: PackConfig = {
        title:
          state.config.title ||
          `Proof Pack - ${new Date().toLocaleDateString()}`,
        description: state.config.description,
        includeScreenshots: state.config.includeScreenshots ?? true,
        includeTimeline: state.config.includeTimeline ?? true,
        includeAIAnalysis: state.config.includeAIAnalysis ?? true,
        compressionLevel: state.config.compressionLevel ?? 5,
        userId: "current-user",
      };

      const proofPack = await proofPackAssembler.createProofPack(
        state.selectedSessions,
        config,
      );

      clearInterval(progressInterval);
      setState((prev) => ({
        ...prev,
        step: "complete",
        createdPack: proofPack,
        progress: 100,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        step: "error",
        error:
          error instanceof Error
            ? error.message
            : "Failed to create proof pack",
      }));
    }
  }, [state.selectedSessions, state.config]);

  const handlePreviewAndRedact = useCallback(() => {
    if (!state.createdPack) return;

    setState((prev) => ({ ...prev, step: "redacting" }));
    // In a real implementation, this would open the redaction interface
    // For now, we'll simulate it
    setTimeout(() => {
      setState((prev) => ({ ...prev, step: "complete" }));
    }, 1000);
  }, [state.createdPack]);

  const handleExportProofPack = useCallback(
    async (format: "pdf" | "json") => {
      if (!state.createdPack) return;

      try {
        if (format === "pdf") {
          const pdfBuffer = await proofPackAssembler.exportToPDF(
            state.createdPack,
          );
          // Trigger download
          const blob = new Blob([pdfBuffer], { type: "application/pdf" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${state.createdPack.metadata.title || "proof-pack"}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        } else {
          const jsonString = await proofPackAssembler.exportToJSON(
            state.createdPack,
          );
          const blob = new Blob([jsonString], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${state.createdPack.metadata.title || "proof-pack"}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error("Export failed:", error);
      }
    },
    [state.createdPack],
  );

  const formatFileSize = (bytes: number): string => {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    return `${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className={`p-4 flex items-center justify-center ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          <span className="text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 space-y-4 ${className}`}>
      <AnimatePresence mode="wait">
        {state.step === "select" && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Select Sessions
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Choose sessions to include in your proof pack
              </p>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {availableSessions.map((session) => (
                <label
                  key={session.id}
                  className="flex items-center p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={state.selectedSessions.includes(session.id)}
                    onChange={() => handleSessionToggle(session.id)}
                    className="mr-3 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        Session {session.id.slice(-8)}
                      </p>
                      <span className="text-xs text-gray-500">
                        {formatDuration(
                          (session.endTime || Date.now()) - session.startTime,
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(session.startTime).toLocaleDateString()}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() =>
                setState((prev) => ({ ...prev, step: "configure" }))
              }
              disabled={state.selectedSessions.length === 0}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Continue ({state.selectedSessions.length} selected)
            </button>
          </motion.div>
        )}

        {state.step === "configure" && (
          <motion.div
            key="configure"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Configure Proof Pack
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Customize your proof pack settings
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor={titleId}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Proof Pack Name
                </label>
                <input
                  id={titleId}
                  type="text"
                  value={state.config.title || ""}
                  onChange={(e) => handleConfigChange("title", e.target.value)}
                  placeholder="Enter proof pack name..."
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                />
              </div>

              <div>
                <label
                  htmlFor={descriptionId}
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  Description (Optional)
                </label>
                <textarea
                  id={descriptionId}
                  value={state.config.description || ""}
                  onChange={(e) =>
                    handleConfigChange("description", e.target.value)
                  }
                  placeholder="Describe the purpose of this proof pack..."
                  rows={2}
                  className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
                />
              </div>

              <div>
                <fieldset>
                  <legend className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Include Components
                  </legend>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={state.config.includeTimeline ?? true}
                        onChange={(e) =>
                          handleConfigChange(
                            "includeTimeline",
                            e.target.checked,
                          )
                        }
                        className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Session timeline
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={state.config.includeScreenshots ?? true}
                        onChange={(e) =>
                          handleConfigChange(
                            "includeScreenshots",
                            e.target.checked,
                          )
                        }
                        className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Screenshots
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={state.config.includeAIAnalysis ?? true}
                        onChange={(e) =>
                          handleConfigChange(
                            "includeAIAnalysis",
                            e.target.checked,
                          )
                        }
                        className="mr-2 h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        AI analysis
                      </span>
                    </label>
                  </div>
                </fieldset>
              </div>
            </div>

            <div className="flex space-x-2">
              {!sessionId && (
                <button
                  type="button"
                  onClick={() =>
                    setState((prev) => ({ ...prev, step: "select" }))
                  }
                  className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Back
                </button>
              )}
              <button
                type="button"
                onClick={handleCreateProofPack}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Create Proof Pack
              </button>
            </div>
          </motion.div>
        )}

        {state.step === "creating" && (
          <motion.div
            key="creating"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Creating Proof Pack
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Processing sessions and generating cryptographic proofs...
              </p>
            </div>

            <div className="space-y-2">
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${state.progress}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-600 dark:text-gray-400">
                {state.progress}% complete
              </p>
            </div>
          </motion.div>
        )}

        {state.step === "complete" && state.createdPack && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Success checkmark</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Proof Pack Created
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {state.createdPack.metadata.title}
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Sessions:
                </span>
                <span className="text-gray-900 dark:text-gray-100">
                  {state.createdPack.metadata.sessions.length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Duration:
                </span>
                <span className="text-gray-900 dark:text-gray-100">
                  {formatDuration(state.createdPack.metadata.totalDuration)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Created:
                </span>
                <span className="text-gray-900 dark:text-gray-100">
                  {new Date(
                    state.createdPack.metadata.created,
                  ).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={handlePreviewAndRedact}
                className="w-full bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Preview & Redact
              </button>

              <div className="flex space-x-2">
                <button
                  type="button"
                  onClick={() => handleExportProofPack("pdf")}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Export PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleExportProofPack("json")}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
                >
                  Export JSON
                </button>
              </div>

              <button
                type="button"
                onClick={() =>
                  setState({
                    step: sessionId ? "configure" : "select",
                    selectedSessions: sessionId ? [sessionId] : [],
                    config: {
                      includeScreenshots: true,
                      includeTimeline: true,
                      includeAIAnalysis: true,
                      compressionLevel: 5,
                    },
                    progress: 0,
                  })
                }
                className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Create Another
              </button>
            </div>
          </motion.div>
        )}

        {state.step === "error" && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-4"
          >
            <div className="text-center">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Error X mark</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Creation Failed
              </h2>
              <p className="text-sm text-red-600 dark:text-red-400">
                {state.error}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setState((prev) => ({
                  ...prev,
                  step: "configure",
                  error: undefined,
                }))
              }
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
            >
              Try Again
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent Proof Packs */}
      {(state.step === "select" || state.step === "configure") &&
        recentProofPacks.length > 0 && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Recent Proof Packs
            </h3>
            <div className="space-y-1">
              {recentProofPacks.map((pack) => (
                <div
                  key={pack.id}
                  className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                      {pack.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {pack.sessionCount} sessions • {formatFileSize(pack.size)}{" "}
                      • {new Date(pack.created).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline ml-2"
                  >
                    Export
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
    </div>
  );
}
