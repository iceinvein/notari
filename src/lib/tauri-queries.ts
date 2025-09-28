import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type { PermissionStatus, WindowInfo } from "@/types/window";

// Query Keys - centralized for consistency
export const queryKeys = {
	windows: ["windows"] as const,
	windowThumbnail: (windowId: string) => ["windows", "thumbnail", windowId] as const,
	preferences: ["preferences"] as const,
	recordingPermission: ["recording-permission"] as const,
} as const;

// Windows Queries
export const useWindowsQuery = () => {
	return useQuery({
		queryKey: queryKeys.windows,
		queryFn: async (): Promise<WindowInfo[]> => {
			return await invoke<WindowInfo[]>("get_available_windows");
		},
	});
};

export const useWindowThumbnailQuery = (windowId: string, enabled = true) => {
	return useQuery({
		queryKey: queryKeys.windowThumbnail(windowId),
		queryFn: async (): Promise<string | null> => {
			return await invoke<string | null>("get_window_thumbnail", { windowId });
		},
		enabled: enabled && !!windowId,
		// Thumbnails don't change often, cache them longer
		staleTime: 1000 * 60 * 10, // 10 minutes
	});
};


// Recording Permission Queries
export const useRecordingPermissionQuery = () => {
	return useQuery({
		queryKey: queryKeys.recordingPermission,
		queryFn: async (): Promise<PermissionStatus> => {
			return await invoke<PermissionStatus>("check_recording_permission");
		},
		// Permission status doesn't change often, but we want to check periodically
		staleTime: 1000 * 60 * 2, // 2 minutes
	});
};

export const useRequestRecordingPermissionMutation = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			return await invoke<boolean>("request_recording_permission");
		},
		onSuccess: () => {
			// Invalidate permission status to get updated state
			queryClient.invalidateQueries({ queryKey: queryKeys.recordingPermission });
		},
	});
};

export const useOpenSystemSettingsMutation = () => {
	return useMutation({
		mutationFn: async () => {
			return await invoke<void>("open_system_settings");
		},
	});
};

// Utility hook for refreshing windows (useful for manual refresh buttons)
export const useRefreshWindows = () => {
	const queryClient = useQueryClient();

	return () => {
		queryClient.invalidateQueries({ queryKey: queryKeys.windows });
		// Also invalidate all thumbnails since windows might have changed
		queryClient.invalidateQueries({
			predicate: (query) => query.queryKey[0] === "windows" && query.queryKey[1] === "thumbnail",
		});
	};
};
