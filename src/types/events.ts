/**
 * Event types emitted from the Rust backend
 * These match the event structures defined in src-tauri/src/events.rs
 */

export const EVENT_NAMES = {
	RECORDING_STATE_CHANGED: "recording:state-changed",
	RECORDING_PROGRESS: "recording:progress",
	RECORDING_ERROR: "recording:error",
	PIPELINE_STARTED: "pipeline:started",
	PIPELINE_STAGE_STARTED: "pipeline:stage-started",
	PIPELINE_STAGE_COMPLETED: "pipeline:stage-completed",
	PIPELINE_STAGE_SKIPPED: "pipeline:stage-skipped",
	PIPELINE_COMPLETED: "pipeline:completed",
	PIPELINE_FAILED: "pipeline:failed",
	BLOCKCHAIN_ANCHOR_STARTED: "blockchain:anchor-started",
	BLOCKCHAIN_ANCHOR_PROGRESS: "blockchain:anchor-progress",
	BLOCKCHAIN_ANCHOR_COMPLETED: "blockchain:anchor-completed",
	BLOCKCHAIN_ANCHOR_FAILED: "blockchain:anchor-failed",
	WINDOW_LIST_CHANGED: "windows:list-changed",
	BACKEND_LOG: "backend:log",
} as const;

export type RecordingStateChangedEvent = {
	sessionId: string;
	status: "Idle" | "Preparing" | "Recording" | "Stopping" | "Processing" | "Completed" | "Failed";
	timestamp: string;
};

export type RecordingProgressEvent = {
	sessionId: string;
	durationSeconds: number;
	fileSizeBytes: number;
	timestamp: string;
};

export type RecordingErrorEvent = {
	sessionId?: string;
	error: string;
	timestamp: string;
};

export type PipelineStartedEvent = {
	sessionId: string;
	pipelineName: string;
	totalStages: number;
	timestamp: string;
};

export type PipelineStageStartedEvent = {
	sessionId: string;
	pipelineName: string;
	stageName: string;
	stageIndex: number;
	totalStages: number;
	timestamp: string;
};

export type PipelineStageCompletedEvent = {
	sessionId: string;
	pipelineName: string;
	stageName: string;
	stageIndex: number;
	totalStages: number;
	durationMs: number;
	timestamp: string;
};

export type PipelineStageSkippedEvent = {
	sessionId: string;
	pipelineName: string;
	stageName: string;
	stageIndex: number;
	totalStages: number;
	timestamp: string;
};

export type PipelineCompletedEvent = {
	sessionId: string;
	pipelineName: string;
	totalDurationMs: number;
	stagesCompleted: number;
	stagesSkipped: number;
	timestamp: string;
};

export type PipelineFailedEvent = {
	sessionId: string;
	pipelineName: string;
	failedStage: string;
	error: string;
	timestamp: string;
};

export type BlockchainAnchorStartedEvent = {
	sessionId: string;
	hash: string;
	timestamp: string;
};

export type BlockchainAnchorProgressEvent = {
	sessionId: string;
	status: "Submitting" | "Confirming" | "Confirmed";
	txHash?: string;
	timestamp: string;
};

export type BlockchainAnchorCompletedEvent = {
	sessionId: string;
	txHash: string;
	blockNumber: number;
	explorerUrl: string;
	timestamp: string;
};

export type BlockchainAnchorFailedEvent = {
	sessionId: string;
	error: string;
	timestamp: string;
};

export type WindowListChangedEvent = {
	timestamp: string;
};

export type BackendLogEvent = {
	level: string;
	message: string;
	source: string;
	timestamp: string;
};
