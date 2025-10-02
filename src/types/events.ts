/**
 * Event types emitted from the Rust backend
 * These match the event structures defined in src-tauri/src/events.rs
 */

export const EVENT_NAMES = {
	RECORDING_STATE_CHANGED: "recording:state-changed",
	RECORDING_PROGRESS: "recording:progress",
	RECORDING_ERROR: "recording:error",
	BLOCKCHAIN_ANCHOR_STARTED: "blockchain:anchor-started",
	BLOCKCHAIN_ANCHOR_PROGRESS: "blockchain:anchor-progress",
	BLOCKCHAIN_ANCHOR_COMPLETED: "blockchain:anchor-completed",
	BLOCKCHAIN_ANCHOR_FAILED: "blockchain:anchor-failed",
	WINDOW_LIST_CHANGED: "windows:list-changed",
	BACKEND_LOG: "backend:log",
} as const;

export type RecordingStateChangedEvent = {
	sessionId: string;
	status: "Recording" | "Paused" | "Stopped" | "Processing";
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
