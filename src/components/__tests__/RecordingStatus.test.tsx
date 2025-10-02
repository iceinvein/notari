import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as useRecordingSystem from "../../hooks/useRecordingSystem";
import RecordingStatus from "../RecordingStatus";

// Mock the hooks
vi.mock("../../hooks/useRecordingSystem");

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

describe("RecordingStatus", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("no active session", () => {
		it("should render nothing when no active session", () => {
			vi.mocked(useRecordingSystem.useActiveRecordingSessionQuery).mockReturnValue({
				data: null,
			} as any);
			vi.mocked(useRecordingSystem.useRecordingInfoQuery).mockReturnValue({
				data: null,
			} as any);

			const { container } = render(<RecordingStatus />, { wrapper: createWrapper() });
			expect(container.firstChild).toBeNull();
		});
	});

	describe("compact mode", () => {
		it("should render compact status chip", () => {
			vi.mocked(useRecordingSystem.useActiveRecordingSessionQuery).mockReturnValue({
				data: {
					session_id: "test-session",
					status: "Recording",
					start_time: new Date().toISOString(),
				},
			} as any);
			vi.mocked(useRecordingSystem.useRecordingInfoQuery).mockReturnValue({
				data: { duration_seconds: 10, file_size_bytes: 1024 },
			} as any);

			render(<RecordingStatus compact={true} />, { wrapper: createWrapper() });

			expect(screen.getByText("Recording")).toBeInTheDocument();
		});

		it("should show duration in compact mode when recording", () => {
			vi.mocked(useRecordingSystem.useActiveRecordingSessionQuery).mockReturnValue({
				data: {
					session_id: "test-session",
					status: "Recording",
					start_time: new Date().toISOString(),
				},
			} as any);
			vi.mocked(useRecordingSystem.useRecordingInfoQuery).mockReturnValue({
				data: { duration_seconds: 65, file_size_bytes: 1024 },
			} as any);

			render(<RecordingStatus compact={true} />, { wrapper: createWrapper() });

			// Should show formatted duration (1:05)
			expect(screen.getByText(/1:05/)).toBeInTheDocument();
		});
	});

	describe("full mode - recording states", () => {
		it("should render recording status with controls", () => {
			vi.mocked(useRecordingSystem.useActiveRecordingSessionQuery).mockReturnValue({
				data: {
					session_id: "test-session",
					status: "Recording",
					start_time: new Date().toISOString(),
				},
			} as any);
			vi.mocked(useRecordingSystem.useRecordingInfoQuery).mockReturnValue({
				data: { duration_seconds: 10, file_size_bytes: 1024 },
			} as any);
			vi.mocked(useRecordingSystem.useStopRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.usePauseRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useResumeRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useClearActiveRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);

			render(<RecordingStatus />, { wrapper: createWrapper() });

			expect(screen.getByText("Recording")).toBeInTheDocument();
			expect(screen.getByLabelText("Pause")).toBeInTheDocument();
			expect(screen.getByLabelText("Stop")).toBeInTheDocument();
		});

		it("should show pause and stop buttons when recording", () => {
			vi.mocked(useRecordingSystem.useActiveRecordingSessionQuery).mockReturnValue({
				data: {
					session_id: "test-session",
					status: "Recording",
					start_time: new Date().toISOString(),
				},
			} as any);
			vi.mocked(useRecordingSystem.useRecordingInfoQuery).mockReturnValue({
				data: { duration_seconds: 10, file_size_bytes: 1024 },
			} as any);
			vi.mocked(useRecordingSystem.useStopRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.usePauseRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useResumeRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useClearActiveRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);

			render(<RecordingStatus />, { wrapper: createWrapper() });

			expect(screen.getByLabelText("Pause")).toBeInTheDocument();
			expect(screen.getByLabelText("Stop")).toBeInTheDocument();
		});

		it("should show resume button when paused", () => {
			vi.mocked(useRecordingSystem.useActiveRecordingSessionQuery).mockReturnValue({
				data: {
					session_id: "test-session",
					status: "Paused",
					start_time: new Date().toISOString(),
				},
			} as any);
			vi.mocked(useRecordingSystem.useRecordingInfoQuery).mockReturnValue({
				data: { duration_seconds: 10, file_size_bytes: 1024 },
			} as any);
			vi.mocked(useRecordingSystem.useStopRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.usePauseRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useResumeRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useClearActiveRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);

			render(<RecordingStatus />, { wrapper: createWrapper() });

			expect(screen.getByText("Paused")).toBeInTheDocument();
			// When paused, only Resume button is shown (Stop is only shown for active recordings)
			const buttons = screen.getAllByRole("button");
			const resumeButton = buttons.find((btn) => btn.getAttribute("aria-label") === "Resume");

			expect(resumeButton).toBeDefined();
			// Stop button is NOT shown when paused (only for Recording/Preparing states)
			const stopButton = buttons.find((btn) => btn.getAttribute("aria-label") === "Stop");
			expect(stopButton).toBeUndefined();
		});

		it("should show open and clear buttons when stopped", () => {
			vi.mocked(useRecordingSystem.useActiveRecordingSessionQuery).mockReturnValue({
				data: {
					session_id: "test-session",
					status: "Stopped",
					start_time: new Date().toISOString(),
					output_path: "/path/to/video.mp4",
				},
			} as any);
			vi.mocked(useRecordingSystem.useRecordingInfoQuery).mockReturnValue({
				data: { duration_seconds: 10, file_size_bytes: 1024 },
			} as any);
			vi.mocked(useRecordingSystem.useStopRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.usePauseRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useResumeRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useClearActiveRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);

			render(<RecordingStatus />, { wrapper: createWrapper() });

			expect(screen.getByText("Stopped")).toBeInTheDocument();
			expect(screen.getByLabelText("Open Video")).toBeInTheDocument();
			expect(screen.getByLabelText("Clear")).toBeInTheDocument();
		});
	});

	describe("metadata display", () => {
		it("should display recording title", () => {
			vi.mocked(useRecordingSystem.useActiveRecordingSessionQuery).mockReturnValue({
				data: {
					session_id: "test-session",
					status: "Recording",
					start_time: new Date().toISOString(),
					recording_title: "Test Recording",
				},
			} as any);
			vi.mocked(useRecordingSystem.useRecordingInfoQuery).mockReturnValue({
				data: { duration_seconds: 10, file_size_bytes: 1024 },
			} as any);
			vi.mocked(useRecordingSystem.useStopRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.usePauseRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useResumeRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useClearActiveRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);

			render(<RecordingStatus />, { wrapper: createWrapper() });

			expect(screen.getByText("Test Recording")).toBeInTheDocument();
		});

		it("should display recording description", () => {
			vi.mocked(useRecordingSystem.useActiveRecordingSessionQuery).mockReturnValue({
				data: {
					session_id: "test-session",
					status: "Recording",
					start_time: new Date().toISOString(),
					recording_description: "Test description",
				},
			} as any);
			vi.mocked(useRecordingSystem.useRecordingInfoQuery).mockReturnValue({
				data: { duration_seconds: 10, file_size_bytes: 1024 },
			} as any);
			vi.mocked(useRecordingSystem.useStopRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.usePauseRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useResumeRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useClearActiveRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);

			render(<RecordingStatus />, { wrapper: createWrapper() });

			expect(screen.getByText("Test description")).toBeInTheDocument();
		});

		it("should display recording tags", () => {
			vi.mocked(useRecordingSystem.useActiveRecordingSessionQuery).mockReturnValue({
				data: {
					session_id: "test-session",
					status: "Recording",
					start_time: new Date().toISOString(),
					recording_tags: ["tag1", "tag2"],
				},
			} as any);
			vi.mocked(useRecordingSystem.useRecordingInfoQuery).mockReturnValue({
				data: { duration_seconds: 10, file_size_bytes: 1024 },
			} as any);
			vi.mocked(useRecordingSystem.useStopRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.usePauseRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useResumeRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useClearActiveRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);

			render(<RecordingStatus />, { wrapper: createWrapper() });

			expect(screen.getByText("tag1")).toBeInTheDocument();
			expect(screen.getByText("tag2")).toBeInTheDocument();
		});
	});

	describe("error handling", () => {
		it("should display error message for error status", () => {
			vi.mocked(useRecordingSystem.useActiveRecordingSessionQuery).mockReturnValue({
				data: {
					session_id: "test-session",
					status: { Error: "Recording failed" },
					start_time: new Date().toISOString(),
				},
			} as any);
			vi.mocked(useRecordingSystem.useRecordingInfoQuery).mockReturnValue({
				data: { duration_seconds: 10, file_size_bytes: 1024 },
			} as any);
			vi.mocked(useRecordingSystem.useStopRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.usePauseRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useResumeRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useClearActiveRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);

			render(<RecordingStatus />, { wrapper: createWrapper() });

			expect(screen.getByText("Recording failed")).toBeInTheDocument();
		});
	});

	describe("duration counter", () => {
		it("should update duration counter for active recording", async () => {
			const startTime = new Date(Date.now() - 5000).toISOString(); // 5 seconds ago

			vi.mocked(useRecordingSystem.useActiveRecordingSessionQuery).mockReturnValue({
				data: {
					session_id: "test-session",
					status: "Recording",
					start_time: startTime,
				},
			} as any);
			vi.mocked(useRecordingSystem.useRecordingInfoQuery).mockReturnValue({
				data: null,
			} as any);
			vi.mocked(useRecordingSystem.useStopRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.usePauseRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useResumeRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);
			vi.mocked(useRecordingSystem.useClearActiveRecordingMutation).mockReturnValue({
				mutate: vi.fn(),
				isPending: false,
			} as any);

			render(<RecordingStatus />, { wrapper: createWrapper() });

			// Should show duration (format is "0:05" or "0:06" - around 5-6 seconds)
			await waitFor(
				() => {
					// Look for text containing duration pattern like "0:05 •" or "0:06 •"
					const text = screen.getByText(/0:0[456789]\s*•/);
					expect(text).toBeInTheDocument();
				},
				{ timeout: 2000 }
			);
		});
	});
});
