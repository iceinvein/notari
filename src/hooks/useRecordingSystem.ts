import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type {
	ActiveRecording,
	RecordingInfo,
	RecordingPreferences,
	RecordingSystemStatus,
} from "../types/recording";
import { recordingLogger } from "../utils/logger";

// Query keys
const RECORDING_QUERY_KEYS = {
	preferences: ["recording", "preferences"] as const,
	activeSession: ["recording", "activeSession"] as const,
	systemStatus: ["recording", "systemStatus"] as const,
	recordingInfo: (sessionId: string) => ["recording", "info", sessionId] as const,
	hasActiveRecording: ["recording", "hasActive"] as const,
	recordings: ["recordings", "list"] as const,
};

// Recording preferences hooks
export function useRecordingPreferencesQuery() {
	return useQuery({
		queryKey: RECORDING_QUERY_KEYS.preferences,
		queryFn: async (): Promise<RecordingPreferences> => {
			return await invoke("get_recording_preferences");
		},
		staleTime: 1000 * 60 * 5, // 5 minutes
	});
}

export function useUpdateRecordingPreferencesMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (preferences: RecordingPreferences) => {
			return await invoke("update_recording_preferences", { preferences });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: RECORDING_QUERY_KEYS.preferences });
			queryClient.invalidateQueries({ queryKey: RECORDING_QUERY_KEYS.systemStatus });
		},
	});
}

// Recording session hooks
export function useActiveRecordingSessionQuery() {
	return useQuery({
		queryKey: RECORDING_QUERY_KEYS.activeSession,
		queryFn: async (): Promise<ActiveRecording | null> => {
			return await invoke("get_active_recording_session");
		},
		refetchInterval: 2000, // Poll every 2 seconds when there's an active recording
	});
}

export function useHasActiveRecordingQuery() {
	return useQuery({
		queryKey: RECORDING_QUERY_KEYS.hasActiveRecording,
		queryFn: async (): Promise<boolean> => {
			return await invoke("has_active_recording");
		},
		refetchInterval: 1000, // Poll every second
	});
}

export function useRecordingInfoQuery(sessionId: string | null) {
	return useQuery({
		queryKey: RECORDING_QUERY_KEYS.recordingInfo(sessionId || ""),
		queryFn: async (): Promise<RecordingInfo> => {
			if (!sessionId) throw new Error("Session ID is required");
			return await invoke("get_recording_info", { sessionId });
		},
		enabled: !!sessionId,
		refetchInterval: 1000, // Update every second during recording
	});
}

export function useRecordingSystemStatusQuery() {
	return useQuery({
		queryKey: RECORDING_QUERY_KEYS.systemStatus,
		queryFn: async (): Promise<RecordingSystemStatus> => {
			return await invoke("get_recording_system_status");
		},
		refetchInterval: 5000, // Poll every 5 seconds
	});
}

// Recording control mutations
export function useStartRecordingMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			windowId,
			preferences,
			encryptionPassword,
		}: {
			windowId: string;
			preferences?: RecordingPreferences;
			encryptionPassword?: string | null;
		}) => {
			return await invoke<ActiveRecording>("start_window_recording", {
				windowId,
				preferences,
				encryptionPassword,
			});
		},
		onSuccess: () => {
			// Invalidate all recording-related queries
			queryClient.invalidateQueries({ queryKey: ["recording"] });
		},
	});
}

export function useStopRecordingMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (sessionId: string) => {
			return await invoke("stop_recording", { sessionId });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["recording"] });
		},
	});
}

export function usePauseRecordingMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (sessionId: string) => {
			return await invoke("pause_recording", { sessionId });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["recording"] });
		},
	});
}

export function useResumeRecordingMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (sessionId: string) => {
			return await invoke("resume_recording", { sessionId });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["recording"] });
		},
	});
}

export function useClearActiveRecordingMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			return await invoke("clear_active_recording");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["recording"] });
		},
	});
}

// File management hooks
export function useSelectSaveDirectoryMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			await invoke("popover_guard_push");
			try {
				return await invoke<string | null>("select_save_directory");
			} finally {
				await invoke("popover_guard_pop").catch(() => {});
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: RECORDING_QUERY_KEYS.preferences });
		},
		onError: (error) => {
			recordingLogger.error(
				"Mutation failed",
				error instanceof Error ? error : new Error(String(error))
			);
		},
	});
}

export function useValidateSaveDirectoryMutation() {
	return useMutation({
		mutationFn: async (path: string) => {
			return await invoke<boolean>("validate_save_directory", { path });
		},
	});
}

export function useGetDefaultSaveDirectoryQuery() {
	return useQuery({
		queryKey: ["recording", "defaultSaveDirectory"],
		queryFn: async (): Promise<string> => {
			return await invoke("get_default_save_directory");
		},
		staleTime: 1000 * 60 * 10, // 10 minutes
	});
}

// System maintenance hooks
export function useCheckRecordingHealthMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			return await invoke("check_recording_health");
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["recording"] });
		},
	});
}

export function useCleanupOrphanedRecordingsMutation() {
	return useMutation({
		mutationFn: async () => {
			return await invoke("cleanup_orphaned_recordings");
		},
	});
}

export function useValidateRecordingWindowMutation() {
	return useMutation({
		mutationFn: async (windowId: string) => {
			return await invoke<boolean>("validate_recording_window", { windowId });
		},
	});
}

// Recordings library hooks
export type RecordingEntry = {
	video_path: string;
	manifest_path: string;
	filename: string;
	created_at: string;
	file_size_bytes: number;
	is_encrypted: boolean;
	has_manifest: boolean;
};

export function useRecordingsQuery() {
	return useQuery({
		queryKey: RECORDING_QUERY_KEYS.recordings,
		queryFn: async (): Promise<RecordingEntry[]> => {
			return await invoke("list_recordings");
		},
		staleTime: 1000 * 30, // 30 seconds
		refetchOnWindowFocus: true,
	});
}

export function useDeleteRecordingMutation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			videoPath,
			manifestPath,
		}: {
			videoPath: string;
			manifestPath?: string;
		}) => {
			// Delete video file
			await invoke("delete_file", { path: videoPath });

			// Delete manifest file if provided
			if (manifestPath) {
				await invoke("delete_file", { path: manifestPath });
			}
		},
		onSuccess: () => {
			// Invalidate recordings list to trigger refetch
			queryClient.invalidateQueries({ queryKey: RECORDING_QUERY_KEYS.recordings });
		},
		onError: (error) => {
			recordingLogger.error(
				"Delete recording failed",
				error instanceof Error ? error : new Error(String(error))
			);
		},
	});
}
