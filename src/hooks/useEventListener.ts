import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useEffect, useRef } from "react";
import type {
	BackendLogEvent,
	BlockchainAnchorCompletedEvent,
	BlockchainAnchorFailedEvent,
	BlockchainAnchorProgressEvent,
	BlockchainAnchorStartedEvent,
	RecordingErrorEvent,
	RecordingProgressEvent,
	RecordingStateChangedEvent,
	WindowListChangedEvent,
} from "../types/events";
import { EVENT_NAMES } from "../types/events";

/**
 * Hook to listen to recording state changes
 */
export function useRecordingStateChanged(
	callback: (event: RecordingStateChangedEvent) => void,
	enabled = true
) {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		if (!enabled) return;

		let unlisten: UnlistenFn | undefined;

		listen<RecordingStateChangedEvent>(EVENT_NAMES.RECORDING_STATE_CHANGED, (event) => {
			callbackRef.current(event.payload);
		}).then((fn) => {
			unlisten = fn;
		});

		return () => {
			unlisten?.();
		};
	}, [enabled]);
}

/**
 * Hook to listen to recording progress updates
 */
export function useRecordingProgress(
	callback: (event: RecordingProgressEvent) => void,
	enabled = true
) {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		if (!enabled) return;

		let unlisten: UnlistenFn | undefined;

		listen<RecordingProgressEvent>(EVENT_NAMES.RECORDING_PROGRESS, (event) => {
			callbackRef.current(event.payload);
		}).then((fn) => {
			unlisten = fn;
		});

		return () => {
			unlisten?.();
		};
	}, [enabled]);
}

/**
 * Hook to listen to recording errors
 */
export function useRecordingError(callback: (event: RecordingErrorEvent) => void, enabled = true) {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		if (!enabled) return;

		let unlisten: UnlistenFn | undefined;

		listen<RecordingErrorEvent>(EVENT_NAMES.RECORDING_ERROR, (event) => {
			callbackRef.current(event.payload);
		}).then((fn) => {
			unlisten = fn;
		});

		return () => {
			unlisten?.();
		};
	}, [enabled]);
}

/**
 * Hook to listen to blockchain anchor started events
 */
export function useBlockchainAnchorStarted(
	callback: (event: BlockchainAnchorStartedEvent) => void,
	enabled = true
) {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		if (!enabled) return;

		let unlisten: UnlistenFn | undefined;

		listen<BlockchainAnchorStartedEvent>(EVENT_NAMES.BLOCKCHAIN_ANCHOR_STARTED, (event) => {
			callbackRef.current(event.payload);
		}).then((fn) => {
			unlisten = fn;
		});

		return () => {
			unlisten?.();
		};
	}, [enabled]);
}

/**
 * Hook to listen to blockchain anchor progress events
 */
export function useBlockchainAnchorProgress(
	callback: (event: BlockchainAnchorProgressEvent) => void,
	enabled = true
) {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		if (!enabled) return;

		let unlisten: UnlistenFn | undefined;

		listen<BlockchainAnchorProgressEvent>(EVENT_NAMES.BLOCKCHAIN_ANCHOR_PROGRESS, (event) => {
			callbackRef.current(event.payload);
		}).then((fn) => {
			unlisten = fn;
		});

		return () => {
			unlisten?.();
		};
	}, [enabled]);
}

/**
 * Hook to listen to blockchain anchor completed events
 */
export function useBlockchainAnchorCompleted(
	callback: (event: BlockchainAnchorCompletedEvent) => void,
	enabled = true
) {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		if (!enabled) return;

		let unlisten: UnlistenFn | undefined;

		listen<BlockchainAnchorCompletedEvent>(EVENT_NAMES.BLOCKCHAIN_ANCHOR_COMPLETED, (event) => {
			callbackRef.current(event.payload);
		}).then((fn) => {
			unlisten = fn;
		});

		return () => {
			unlisten?.();
		};
	}, [enabled]);
}

/**
 * Hook to listen to blockchain anchor failed events
 */
export function useBlockchainAnchorFailed(
	callback: (event: BlockchainAnchorFailedEvent) => void,
	enabled = true
) {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		if (!enabled) return;

		let unlisten: UnlistenFn | undefined;

		listen<BlockchainAnchorFailedEvent>(EVENT_NAMES.BLOCKCHAIN_ANCHOR_FAILED, (event) => {
			callbackRef.current(event.payload);
		}).then((fn) => {
			unlisten = fn;
		});

		return () => {
			unlisten?.();
		};
	}, [enabled]);
}

/**
 * Hook to listen to window list changes
 */
export function useWindowListChanged(
	callback: (event: WindowListChangedEvent) => void,
	enabled = true
) {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		if (!enabled) return;

		let unlisten: UnlistenFn | undefined;

		listen<WindowListChangedEvent>(EVENT_NAMES.WINDOW_LIST_CHANGED, (event) => {
			callbackRef.current(event.payload);
		}).then((fn) => {
			unlisten = fn;
		});

		return () => {
			unlisten?.();
		};
	}, [enabled]);
}

/**
 * Hook to listen to backend log events
 */
export function useBackendLog(callback: (event: BackendLogEvent) => void, enabled = true) {
	const callbackRef = useRef(callback);
	callbackRef.current = callback;

	useEffect(() => {
		if (!enabled) return;

		let unlisten: UnlistenFn | undefined;

		listen<BackendLogEvent>(EVENT_NAMES.BACKEND_LOG, (event) => {
			callbackRef.current(event.payload);
		}).then((fn) => {
			unlisten = fn;
		});

		return () => {
			unlisten?.();
		};
	}, [enabled]);
}
