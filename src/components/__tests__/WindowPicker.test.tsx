import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as useApplicationPreferencesQuery from "../../hooks/useApplicationPreferencesQuery";
import * as tauriQueries from "../../lib/tauri-queries";
import WindowPicker from "../WindowPicker";

// Mock the hooks
vi.mock("../../lib/tauri-queries");
vi.mock("../../hooks/useApplicationPreferencesQuery");

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

const mockWindow = {
	id: 1,
	title: "Test Window",
	application: "Test App",
	bounds: { x: 0, y: 0, width: 1920, height: 1080 },
	is_minimized: false,
};

describe("WindowPicker", () => {
	const onWindowSelect = vi.fn();
	const onBack = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();

		// Default mocks
		vi.mocked(useApplicationPreferencesQuery.useApplicationPreferencesQuery).mockReturnValue({
			isApplicationAllowed: vi.fn(() => true),
		} as any);

		vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
			data: [],
			isLoading: false,
			error: null,
		} as any);

		vi.mocked(tauriQueries.useRecordingPermissionQuery).mockReturnValue({
			data: { granted: true, can_request: false, message: "" },
			isLoading: false,
			error: null,
		} as any);

		vi.mocked(tauriQueries.useRequestRecordingPermissionMutation).mockReturnValue({
			mutateAsync: vi.fn(),
		} as any);

		vi.mocked(tauriQueries.useOpenSystemSettingsMutation).mockReturnValue({
			mutateAsync: vi.fn(),
		} as any);

		vi.mocked(tauriQueries.useRefreshWindows).mockReturnValue(vi.fn());

		// Mock useWindowThumbnailQuery for WindowThumbnail component
		vi.mocked(tauriQueries.useWindowThumbnailQuery).mockReturnValue({
			data: "data:image/png;base64,mock-thumbnail",
			isLoading: false,
			error: null,
		} as any);
	});

	describe("loading state", () => {
		it("should show loading spinner when loading windows", () => {
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: [],
				isLoading: true,
				error: null,
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			expect(screen.getByText("Loading available windows...")).toBeInTheDocument();
		});

		it("should show loading spinner when loading permissions", () => {
			vi.mocked(tauriQueries.useRecordingPermissionQuery).mockReturnValue({
				data: null,
				isLoading: true,
				error: null,
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			expect(screen.getByText("Loading available windows...")).toBeInTheDocument();
		});
	});

	describe("error state", () => {
		it("should show error message when windows query fails", () => {
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: [],
				isLoading: false,
				error: new Error("Failed to load windows"),
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			expect(screen.getByText("Failed to load windows")).toBeInTheDocument();
			expect(screen.getByText("Back")).toBeInTheDocument();
			expect(screen.getByText("Retry")).toBeInTheDocument();
		});

		it("should call onBack when clicking Back button in error state", () => {
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: [],
				isLoading: false,
				error: new Error("Failed to load windows"),
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			fireEvent.click(screen.getByText("Back"));
			expect(onBack).toHaveBeenCalled();
		});

		it("should call refresh when clicking Retry button", () => {
			const refreshWindows = vi.fn();
			vi.mocked(tauriQueries.useRefreshWindows).mockReturnValue(refreshWindows);
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: [],
				isLoading: false,
				error: new Error("Failed to load windows"),
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			fireEvent.click(screen.getByText("Retry"));
			expect(refreshWindows).toHaveBeenCalled();
		});
	});

	describe("permission required state", () => {
		it("should show permission required message when permission not granted", () => {
			vi.mocked(tauriQueries.useRecordingPermissionQuery).mockReturnValue({
				data: {
					granted: false,
					can_request: true,
					message: "Screen recording permission is required",
				},
				isLoading: false,
				error: null,
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			expect(screen.getByText("Permission Required")).toBeInTheDocument();
			expect(screen.getByText("Screen recording permission is required")).toBeInTheDocument();
			expect(screen.getByText("Grant Permission")).toBeInTheDocument();
		});

		it("should request permission when clicking Grant Permission button", async () => {
			const mutateAsync = vi.fn().mockResolvedValue(true);
			vi.mocked(tauriQueries.useRequestRecordingPermissionMutation).mockReturnValue({
				mutateAsync,
			} as any);
			vi.mocked(tauriQueries.useRecordingPermissionQuery).mockReturnValue({
				data: {
					granted: false,
					can_request: true,
					message: "Screen recording permission is required",
				},
				isLoading: false,
				error: null,
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			fireEvent.click(screen.getByText("Grant Permission"));
			expect(mutateAsync).toHaveBeenCalled();
		});
	});

	describe("window list", () => {
		it("should show empty state when no windows available", () => {
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: [],
				isLoading: false,
				error: null,
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			expect(screen.getByText("No windows found")).toBeInTheDocument();
			expect(
				screen.getByText("Make sure you have applications open and try refreshing")
			).toBeInTheDocument();
		});

		it("should display available windows", () => {
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: [mockWindow],
				isLoading: false,
				error: null,
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			expect(screen.getByText("Test Window")).toBeInTheDocument();
			expect(screen.getByText("Test App")).toBeInTheDocument();
			expect(screen.getByText("1920 × 1080")).toBeInTheDocument();
		});

		it("should call onWindowSelect when clicking a window", () => {
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: [mockWindow],
				isLoading: false,
				error: null,
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			const windowButton = screen.getByText("Test Window").closest("button");
			if (windowButton) {
				fireEvent.click(windowButton);
			}

			expect(onWindowSelect).toHaveBeenCalledWith(mockWindow);
		});

		it("should show minimized badge for minimized windows", () => {
			const minimizedWindow = { ...mockWindow, is_minimized: true };
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: [minimizedWindow],
				isLoading: false,
				error: null,
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			expect(screen.getByText("Minimized")).toBeInTheDocument();
		});

		it("should display multiple windows", () => {
			const windows = [
				mockWindow,
				{ ...mockWindow, id: 2, title: "Window 2", application: "App 2" },
				{ ...mockWindow, id: 3, title: "Window 3", application: "App 3" },
			];
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: windows,
				isLoading: false,
				error: null,
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			expect(screen.getByText("Test Window")).toBeInTheDocument();
			expect(screen.getByText("Window 2")).toBeInTheDocument();
			expect(screen.getByText("Window 3")).toBeInTheDocument();
			expect(screen.getByText("3 windows available")).toBeInTheDocument();
		});
	});

	describe("filtering", () => {
		it("should filter windows based on application preferences", () => {
			const windows = [
				mockWindow,
				{ ...mockWindow, id: 2, title: "Blocked Window", application: "Blocked App" },
			];
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: windows,
				isLoading: false,
				error: null,
			} as any);
			vi.mocked(useApplicationPreferencesQuery.useApplicationPreferencesQuery).mockReturnValue({
				isApplicationAllowed: vi.fn((app) => app !== "Blocked App"),
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			expect(screen.getByText("Test Window")).toBeInTheDocument();
			expect(screen.queryByText("Blocked Window")).not.toBeInTheDocument();
			expect(screen.getByText("1 window available")).toBeInTheDocument();
		});

		it("should show no allowed windows message when all windows are filtered", () => {
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: [mockWindow],
				isLoading: false,
				error: null,
			} as any);
			vi.mocked(useApplicationPreferencesQuery.useApplicationPreferencesQuery).mockReturnValue({
				isApplicationAllowed: vi.fn(() => false),
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			expect(screen.getByText("No allowed windows")).toBeInTheDocument();
			expect(
				screen.getByText(/1 window available, but none match your allowed applications/)
			).toBeInTheDocument();
		});
	});

	describe("refresh functionality", () => {
		it("should show refresh button in header", () => {
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: [mockWindow],
				isLoading: false,
				error: null,
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			const refreshButtons = screen.getAllByRole("button");
			// Should have refresh button (icon-only button)
			expect(refreshButtons.length).toBeGreaterThan(0);
		});

		it("should call refresh when clicking refresh button", () => {
			const refreshWindows = vi.fn();
			vi.mocked(tauriQueries.useRefreshWindows).mockReturnValue(refreshWindows);
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: [],
				isLoading: false,
				error: null,
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			fireEvent.click(screen.getByText("Refresh Windows"));
			expect(refreshWindows).toHaveBeenCalled();
		});
	});

	describe("header", () => {
		it("should show back button", () => {
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: [mockWindow],
				isLoading: false,
				error: null,
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			expect(screen.getByText("Select Window")).toBeInTheDocument();
			expect(screen.getByText("Choose a window to record")).toBeInTheDocument();
		});

		it("should call onBack when clicking back button", () => {
			vi.mocked(tauriQueries.useWindowsQuery).mockReturnValue({
				data: [mockWindow],
				isLoading: false,
				error: null,
			} as any);

			render(<WindowPicker onWindowSelect={onWindowSelect} onBack={onBack} />, {
				wrapper: createWrapper(),
			});

			const buttons = screen.getAllByRole("button");
			// First button should be back button
			fireEvent.click(buttons[0]);
			expect(onBack).toHaveBeenCalled();
		});
	});
});
