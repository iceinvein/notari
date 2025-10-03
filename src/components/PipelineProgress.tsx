import { listen } from "@tauri-apps/api/event";
import { AlertCircle, CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
	EVENT_NAMES,
	type PipelineCompletedEvent,
	type PipelineFailedEvent,
	type PipelineStageCompletedEvent,
	type PipelineStageSkippedEvent,
	type PipelineStageStartedEvent,
	type PipelineStartedEvent,
} from "../types/events";

type PipelineStage = {
	name: string;
	status: "pending" | "running" | "completed" | "skipped" | "failed";
	durationMs?: number;
};

type PipelineProgressProps = {
	sessionId: string;
	onComplete?: () => void;
	onError?: (error: string) => void;
};

export function PipelineProgress({ sessionId, onComplete, onError }: PipelineProgressProps) {
	const [pipelineName, setPipelineName] = useState<string>("");
	const [stages, setStages] = useState<PipelineStage[]>([]);
	const [currentStageIndex, setCurrentStageIndex] = useState<number>(-1);
	const [isComplete, setIsComplete] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [totalDurationMs, setTotalDurationMs] = useState<number>(0);

	useEffect(() => {
		const unlistenPromises: Promise<() => void>[] = [];

		// Listen for pipeline started
		unlistenPromises.push(
			listen<PipelineStartedEvent>(EVENT_NAMES.PIPELINE_STARTED, (event) => {
				if (event.payload.sessionId === sessionId) {
					setPipelineName(event.payload.pipelineName);
					// Initialize stages as pending
					const initialStages: PipelineStage[] = Array.from(
						{ length: event.payload.totalStages },
						() => ({
							name: "",
							status: "pending",
						})
					);
					setStages(initialStages);
				}
			})
		);

		// Listen for stage started
		unlistenPromises.push(
			listen<PipelineStageStartedEvent>(EVENT_NAMES.PIPELINE_STAGE_STARTED, (event) => {
				if (event.payload.sessionId === sessionId) {
					setCurrentStageIndex(event.payload.stageIndex);
					setStages((prev) => {
						const updated = [...prev];
						updated[event.payload.stageIndex] = {
							name: event.payload.stageName,
							status: "running",
						};
						return updated;
					});
				}
			})
		);

		// Listen for stage completed
		unlistenPromises.push(
			listen<PipelineStageCompletedEvent>(EVENT_NAMES.PIPELINE_STAGE_COMPLETED, (event) => {
				if (event.payload.sessionId === sessionId) {
					setStages((prev) => {
						const updated = [...prev];
						updated[event.payload.stageIndex] = {
							name: event.payload.stageName,
							status: "completed",
							durationMs: event.payload.durationMs,
						};
						return updated;
					});
				}
			})
		);

		// Listen for stage skipped
		unlistenPromises.push(
			listen<PipelineStageSkippedEvent>(EVENT_NAMES.PIPELINE_STAGE_SKIPPED, (event) => {
				if (event.payload.sessionId === sessionId) {
					setStages((prev) => {
						const updated = [...prev];
						updated[event.payload.stageIndex] = {
							name: event.payload.stageName,
							status: "skipped",
						};
						return updated;
					});
				}
			})
		);

		// Listen for pipeline completed
		unlistenPromises.push(
			listen<PipelineCompletedEvent>(EVENT_NAMES.PIPELINE_COMPLETED, (event) => {
				if (event.payload.sessionId === sessionId) {
					setIsComplete(true);
					setTotalDurationMs(event.payload.totalDurationMs);
					onComplete?.();
				}
			})
		);

		// Listen for pipeline failed
		unlistenPromises.push(
			listen<PipelineFailedEvent>(EVENT_NAMES.PIPELINE_FAILED, (event) => {
				if (event.payload.sessionId === sessionId) {
					setError(event.payload.error);
					// Mark the failed stage
					setStages((prev) => {
						const updated = [...prev];
						const failedIndex = updated.findIndex((s) => s.name === event.payload.failedStage);
						if (failedIndex !== -1) {
							updated[failedIndex].status = "failed";
						}
						return updated;
					});
					onError?.(event.payload.error);
				}
			})
		);

		// Cleanup listeners
		return () => {
			Promise.all(unlistenPromises).then((unlisteners) => {
				unlisteners.forEach((unlisten) => {
					unlisten();
				});
			});
		};
	}, [sessionId, onComplete, onError]);

	const progress = stages.length > 0 ? ((currentStageIndex + 1) / stages.length) * 100 : 0;

	const getStageIcon = (stage: PipelineStage) => {
		switch (stage.status) {
			case "completed":
				return <CheckCircle2 className="w-5 h-5 text-green-500" />;
			case "running":
				return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
			case "skipped":
				return <Circle className="w-5 h-5 text-gray-400" />;
			case "failed":
				return <XCircle className="w-5 h-5 text-red-500" />;
			default:
				return <Circle className="w-5 h-5 text-gray-300" />;
		}
	};

	const formatDuration = (ms: number) => {
		if (ms < 1000) return `${ms}ms`;
		return `${(ms / 1000).toFixed(2)}s`;
	};

	if (error) {
		return (
			<div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
				<div className="flex items-start gap-3">
					<AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
					<div className="flex-1">
						<h3 className="font-semibold text-red-900 dark:text-red-100">Processing Failed</h3>
						<p className="text-sm text-red-700 dark:text-red-300 mt-1">{error}</p>
					</div>
				</div>
			</div>
		);
	}

	if (isComplete) {
		return (
			<div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
				<div className="flex items-start gap-3">
					<CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
					<div className="flex-1">
						<h3 className="font-semibold text-green-900 dark:text-green-100">
							Processing Complete
						</h3>
						<p className="text-sm text-green-700 dark:text-green-300 mt-1">
							Completed in {formatDuration(totalDurationMs)}
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
			<div className="mb-4">
				<div className="flex items-center justify-between mb-2">
					<h3 className="font-semibold text-gray-900 dark:text-gray-100">
						Processing Recording
						{pipelineName && <span className="text-sm text-gray-500 ml-2">({pipelineName})</span>}
					</h3>
					<span className="text-sm text-gray-600 dark:text-gray-400">
						{currentStageIndex + 1} / {stages.length}
					</span>
				</div>

				{/* Progress bar */}
				<div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
					<div
						className="bg-blue-500 h-full transition-all duration-300 ease-out"
						style={{ width: `${progress}%` }}
					/>
				</div>
			</div>

			{/* Stage list */}
			<div className="space-y-2">
				{stages.map((stage) => (
					<div
						key={stage.name}
						className={`flex items-center gap-3 p-2 rounded ${
							stage.status === "running"
								? "bg-blue-50 dark:bg-blue-900/20"
								: stage.status === "failed"
									? "bg-red-50 dark:bg-red-900/20"
									: ""
						}`}
					>
						{getStageIcon(stage)}
						<div className="flex-1">
							<div className="text-sm font-medium text-gray-900 dark:text-gray-100">
								{stage.name}
							</div>
							{stage.durationMs !== undefined && (
								<div className="text-xs text-gray-500 dark:text-gray-400">
									{formatDuration(stage.durationMs)}
								</div>
							)}
						</div>
						{stage.status === "skipped" && (
							<span className="text-xs text-gray-500 dark:text-gray-400">Skipped</span>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
