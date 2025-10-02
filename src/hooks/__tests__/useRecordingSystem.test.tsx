import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ActiveRecording, RecordingPreferences } from "../../types/recording";
import {
	useActiveRecordingSessionQuery,
	useHasActiveRecordingQuery,
	usePauseRecordingMutation,
	useRecordingPreferencesQuery,
	useRecordingsQuery,
	useResumeRecordingMutation,
	useStartRecordingMutation,
	useStopRecordingMutation,
} from "../useRecordingSystem";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
	invoke: vi.fn(),
}));

const createWrapper = () => {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	});

	return ({ children }: { children: ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
};

describe("useRecordingPreferencesQuery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should fetch recording preferences", async () => {
		const mockPreferences: RecordingPreferences = {
			video_quality: "High",
			include_audio: true,
			save_directory: "/path/to/save",
			filename_pattern: "{timestamp}_{title}",
		};

		vi.mocked(invoke).mockResolvedValue(mockPreferences);

		const { result } = renderHook(() => useRecordingPreferencesQuery(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual(mockPreferences);
		expect(invoke).toHaveBeenCalledWith("get_recording_preferences");
	});

	it("should handle fetch error", async () => {
		vi.mocked(invoke).mockRejectedValue(new Error("Failed to fetch preferences"));

		const { result } = renderHook(() => useRecordingPreferencesQuery(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isError).toBe(true));

		expect(result.current.error).toBeDefined();
	});
});

describe("useActiveRecordingSessionQuery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should fetch active recording session", async () => {
		const mockSession: ActiveRecording = {
			session_id: "test-session-123",
			window_id: "window-456",
			start_time: "2024-01-15T10:00:00Z",
			output_path: "/path/to/output.notari",
			status: "Recording",
			preferences: {
				filename_pattern: "notari_recording_{timestamp}",
				include_audio: false,
				video_quality: "High",
			},
		};

		vi.mocked(invoke).mockResolvedValue(mockSession);

		const { result } = renderHook(() => useActiveRecordingSessionQuery(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual(mockSession);
		expect(invoke).toHaveBeenCalledWith("get_active_recording_session");
	});

	it("should return null when no active session", async () => {
		vi.mocked(invoke).mockResolvedValue(null);

		const { result } = renderHook(() => useActiveRecordingSessionQuery(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toBeNull();
	});
});

describe("useHasActiveRecordingQuery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should return true when recording is active", async () => {
		vi.mocked(invoke).mockResolvedValue(true);

		const { result } = renderHook(() => useHasActiveRecordingQuery(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toBe(true);
		expect(invoke).toHaveBeenCalledWith("has_active_recording");
	});

	it("should return false when no recording is active", async () => {
		vi.mocked(invoke).mockResolvedValue(false);

		const { result } = renderHook(() => useHasActiveRecordingQuery(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toBe(false);
	});
});

describe("useStartRecordingMutation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should start recording with window ID", async () => {
		const mockSession: ActiveRecording = {
			session_id: "new-session-123",
			window_id: "window-789",
			start_time: "2024-01-15T11:00:00Z",
			output_path: "/path/to/new-output.notari",
			status: "Recording",
			preferences: {
				filename_pattern: "notari_recording_{timestamp}",
				include_audio: false,
				video_quality: "High",
			},
		};

		vi.mocked(invoke).mockResolvedValue(mockSession);

		const { result } = renderHook(() => useStartRecordingMutation(), {
			wrapper: createWrapper(),
		});

		await result.current.mutateAsync({
			windowId: "window-789",
		});

		expect(invoke).toHaveBeenCalledWith("start_window_recording", {
			windowId: "window-789",
			preferences: undefined,
			encryptionPassword: undefined,
			recordingTitle: null,
			recordingDescription: null,
			recordingTags: null,
		});
	});

	it("should start recording with encryption password", async () => {
		const mockSession: ActiveRecording = {
			session_id: "encrypted-session",
			window_id: "window-123",
			start_time: "2024-01-15T12:00:00Z",
			output_path: "/path/to/encrypted.notari",
			status: "Recording",
			preferences: {
				filename_pattern: "notari_recording_{timestamp}",
				include_audio: false,
				video_quality: "High",
			},
		};

		vi.mocked(invoke).mockResolvedValue(mockSession);

		const { result } = renderHook(() => useStartRecordingMutation(), {
			wrapper: createWrapper(),
		});

		await result.current.mutateAsync({
			windowId: "window-123",
			encryptionPassword: "SecurePassword123!",
			recordingTitle: "Test Recording",
			recordingDescription: "Test description",
			recordingTags: ["test", "demo"],
		});

		expect(invoke).toHaveBeenCalledWith("start_window_recording", {
			windowId: "window-123",
			preferences: undefined,
			encryptionPassword: "SecurePassword123!",
			recordingTitle: "Test Recording",
			recordingDescription: "Test description",
			recordingTags: ["test", "demo"],
		});
	});
});

describe("useStopRecordingMutation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should stop recording", async () => {
		const sessionId = "test-session-123";
		vi.mocked(invoke).mockResolvedValue(undefined);

		const { result } = renderHook(() => useStopRecordingMutation(), {
			wrapper: createWrapper(),
		});

		await result.current.mutateAsync(sessionId);

		expect(invoke).toHaveBeenCalledWith("stop_recording", { sessionId });
	});
});

describe("usePauseRecordingMutation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should pause recording", async () => {
		const sessionId = "test-session-123";
		vi.mocked(invoke).mockResolvedValue(undefined);

		const { result } = renderHook(() => usePauseRecordingMutation(), {
			wrapper: createWrapper(),
		});

		await result.current.mutateAsync(sessionId);

		expect(invoke).toHaveBeenCalledWith("pause_recording", { sessionId });
	});
});

describe("useResumeRecordingMutation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should resume recording", async () => {
		const sessionId = "test-session-123";
		vi.mocked(invoke).mockResolvedValue(undefined);

		const { result } = renderHook(() => useResumeRecordingMutation(), {
			wrapper: createWrapper(),
		});

		await result.current.mutateAsync(sessionId);

		expect(invoke).toHaveBeenCalledWith("resume_recording", { sessionId });
	});
});

describe("useRecordingsQuery", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should fetch recordings list", async () => {
		const mockRecordings = [
			{
				video_path: "/path/to/recording1.notari",
				manifest_path: "/path/to/recording1.json",
				filename: "recording1.notari",
				created_at: "2024-01-15T10:00:00Z",
				file_size_bytes: 1024000,
				is_encrypted: true,
				has_manifest: true,
				title: "Test Recording 1",
				description: "First test recording",
				tags: ["test", "demo"],
			},
			{
				video_path: "/path/to/recording2.notari",
				manifest_path: "/path/to/recording2.json",
				filename: "recording2.notari",
				created_at: "2024-01-15T11:00:00Z",
				file_size_bytes: 2048000,
				is_encrypted: false,
				has_manifest: true,
			},
		];

		vi.mocked(invoke).mockResolvedValue(mockRecordings);

		const { result } = renderHook(() => useRecordingsQuery(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual(mockRecordings);
		expect(result.current.data).toHaveLength(2);
		expect(invoke).toHaveBeenCalledWith("list_recordings");
	});

	it("should return empty array when no recordings", async () => {
		vi.mocked(invoke).mockResolvedValue([]);

		const { result } = renderHook(() => useRecordingsQuery(), {
			wrapper: createWrapper(),
		});

		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		expect(result.current.data).toEqual([]);
	});
});
