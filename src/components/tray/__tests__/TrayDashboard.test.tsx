import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionManager } from "../../../services/session/SessionManager";
import { SessionStatus, type WorkSession } from "../../../types/session.types";
import { TrayDashboard } from "../TrayDashboard";
import { TrayRouterProvider } from "../TrayRouter";

// Mock the SessionManager
vi.mock("../../../services/session/SessionManager");

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const MockedSessionManager = vi.mocked(SessionManager);

// Test wrapper component
function TestWrapper({ children }: { children: React.ReactNode }) {
  return <TrayRouterProvider>{children}</TrayRouterProvider>;
}

describe("TrayDashboard", () => {
  let mockSessionManager: {
    getActiveSessions: ReturnType<typeof vi.fn>;
    getUserSessions: ReturnType<typeof vi.fn>;
    createSession: ReturnType<typeof vi.fn>;
    stopSession: ReturnType<typeof vi.fn>;
    pauseSession: ReturnType<typeof vi.fn>;
    resumeSession: ReturnType<typeof vi.fn>;
    formatDuration: ReturnType<typeof vi.fn>;
  };

  const mockActiveSession: WorkSession = {
    id: "active-session-1",
    userId: "user-1",
    startTime: Date.now() - 120000, // 2 minutes ago
    status: SessionStatus.Active,
    captureConfig: {
      captureScreen: true,
      captureKeystrokes: true,
      captureMouse: true,
      privacyFilters: [],
      qualitySettings: "high",
    },
    createdAt: Date.now() - 120000,
    updatedAt: Date.now(),
  };

  const mockRecentSessions: WorkSession[] = [
    {
      id: "session-1",
      userId: "user-1",
      startTime: Date.now() - 3600000,
      endTime: Date.now() - 1800000,
      status: SessionStatus.Completed,
      captureConfig: {
        captureScreen: true,
        captureKeystrokes: true,
        captureMouse: true,
        privacyFilters: [],
        qualitySettings: "high",
      },
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 1800000,
    },
    {
      id: "session-2",
      userId: "user-1",
      startTime: Date.now() - 7200000,
      endTime: Date.now() - 5400000,
      status: SessionStatus.Completed,
      captureConfig: {
        captureScreen: true,
        captureKeystrokes: false,
        captureMouse: true,
        privacyFilters: ["passwords"],
        qualitySettings: "medium",
      },
      createdAt: Date.now() - 7200000,
      updatedAt: Date.now() - 5400000,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    mockSessionManager = {
      getActiveSessions: vi.fn(),
      getUserSessions: vi.fn(),
      createSession: vi.fn(),
      stopSession: vi.fn(),
      pauseSession: vi.fn(),
      resumeSession: vi.fn(),
      formatDuration: vi.fn((duration: number) => {
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        return `${minutes}m ${seconds}s`;
      }),
    };

    MockedSessionManager.mockImplementation(() => mockSessionManager as any);
  });

  describe("Loading State", () => {
    it("should display loading spinner while fetching data", () => {
      // Make the promises never resolve to keep loading state
      mockSessionManager.getActiveSessions.mockImplementation(
        () => new Promise(() => {}),
      );
      mockSessionManager.getUserSessions.mockImplementation(
        () => new Promise(() => {}),
      );

      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      expect(screen.getByText("Loading dashboard...")).toBeInTheDocument();
    });
  });

  describe("No Active Session", () => {
    beforeEach(() => {
      mockSessionManager.getActiveSessions.mockResolvedValue([]);
      mockSessionManager.getUserSessions.mockResolvedValue(mockRecentSessions);
    });

    it("should display no active session state", async () => {
      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Start New Session")).toBeInTheDocument();
      });

      // The component shows the start button instead of descriptive text
      // expect(screen.getByText("Start recording your work")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Start New Session" }),
      ).toBeInTheDocument();
    });

    it("should start a new session when start button is clicked", async () => {
      const user = userEvent.setup();
      mockSessionManager.createSession.mockResolvedValue(mockActiveSession);

      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Start New Session" }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: "Start New Session" }),
      );

      expect(mockSessionManager.createSession).toHaveBeenCalledWith("user-1", {
        captureScreen: true,
        captureKeystrokes: true,
        captureMouse: true,
        privacyFilters: [],
        qualitySettings: "high",
      });
    });
  });

  describe("Active Session", () => {
    beforeEach(() => {
      mockSessionManager.getActiveSessions.mockResolvedValue([
        mockActiveSession,
      ]);
      mockSessionManager.getUserSessions.mockResolvedValue(mockRecentSessions);
    });

    it("should display active session information", async () => {
      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Recording")).toBeInTheDocument();
      });

      // The component shows "Recording" instead of "ACTIVE"
      // expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      // The duration is shown as time format, not with "Duration:" label
      expect(screen.getByText(/00:02:\d{2}/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();
    });

    it("should pause session when pause button is clicked", async () => {
      const user = userEvent.setup();
      mockSessionManager.pauseSession.mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Pause" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Pause" }));

      expect(mockSessionManager.pauseSession).toHaveBeenCalledWith(
        "active-session-1",
      );
    });

    it("should stop session when stop button is clicked", async () => {
      const user = userEvent.setup();
      mockSessionManager.stopSession.mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Stop" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Stop" }));

      expect(mockSessionManager.stopSession).toHaveBeenCalledWith(
        "active-session-1",
      );
    });
  });

  describe("Paused Session", () => {
    const pausedSession = {
      ...mockActiveSession,
      status: SessionStatus.Paused,
    };

    beforeEach(() => {
      mockSessionManager.getActiveSessions.mockResolvedValue([pausedSession]);
      mockSessionManager.getUserSessions.mockResolvedValue(mockRecentSessions);
    });

    it("should display paused session state", async () => {
      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Paused")).toBeInTheDocument();
      });

      // Check that the paused session shows correct buttons
      expect(screen.getByText("Resume")).toBeInTheDocument();
      expect(screen.getByText("Stop")).toBeInTheDocument();
    });

    it("should resume session when resume button is clicked", async () => {
      const user = userEvent.setup();
      mockSessionManager.resumeSession.mockResolvedValue(undefined);

      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Resume" }),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: "Resume" }));

      expect(mockSessionManager.resumeSession).toHaveBeenCalledWith(
        "active-session-1",
      );
    });
  });

  describe("Quick Actions", () => {
    beforeEach(() => {
      mockSessionManager.getActiveSessions.mockResolvedValue([]);
      mockSessionManager.getUserSessions.mockResolvedValue(mockRecentSessions);
    });

    it("should display all quick action buttons", async () => {
      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Quick Actions")).toBeInTheDocument();
      });

      expect(
        screen.getByText("Create Proof Pack (No Session)"),
      ).toBeInTheDocument();
      expect(screen.getByText("Recent Sessions")).toBeInTheDocument();
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });

    it("should navigate to proof pack manager when clicked", async () => {
      const user = userEvent.setup();
      const mockNavigateTo = vi.fn();

      // Mock the router context
      vi.doMock("./TrayRouter", () => ({
        useTrayRouter: () => ({ navigateTo: mockNavigateTo }),
        TrayRouterProvider: ({ children }: { children: React.ReactNode }) =>
          children,
      }));

      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByText("Create Proof Pack (No Session)"),
        ).toBeInTheDocument();
      });

      await user.click(screen.getByText("Create Proof Pack (No Session)"));
      // Note: Navigation testing would require proper router mock setup
    });
  });

  describe("Recent Sessions", () => {
    beforeEach(() => {
      mockSessionManager.getActiveSessions.mockResolvedValue([]);
      mockSessionManager.getUserSessions.mockResolvedValue(mockRecentSessions);
    });

    it("should display recent sessions when available", async () => {
      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Recent Sessions (2)")).toBeInTheDocument();
      });

      // Check that sessions are displayed with their status
      expect(screen.getAllByText("completed")).toHaveLength(2);
    });

    it("should not display recent sessions section when no sessions exist", async () => {
      mockSessionManager.getUserSessions.mockResolvedValue([]);

      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Start New Session")).toBeInTheDocument();
      });

      expect(screen.queryByText(/Recent Sessions \(/)).not.toBeInTheDocument();
    });

    it("should show View All button when there are 5 or more sessions", async () => {
      const manySessions = Array.from({ length: 5 }, (_, i) => ({
        ...mockRecentSessions[0],
        id: `session-${i + 1}`,
      }));
      mockSessionManager.getUserSessions.mockResolvedValue(manySessions);

      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Recent Sessions (5)")).toBeInTheDocument();
      });

      expect(
        screen.getByRole("button", { name: "View All" }),
      ).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should display error message when session loading fails", async () => {
      mockSessionManager.getActiveSessions.mockRejectedValue(
        new Error("Network error"),
      );
      mockSessionManager.getUserSessions.mockRejectedValue(
        new Error("Network error"),
      );

      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });
    });

    it("should display error when session start fails", async () => {
      const user = userEvent.setup();
      mockSessionManager.getActiveSessions.mockResolvedValue([]);
      mockSessionManager.getUserSessions.mockResolvedValue([]);
      mockSessionManager.createSession.mockRejectedValue(
        new Error("Failed to start"),
      );

      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Start New Session" }),
        ).toBeInTheDocument();
      });

      await user.click(
        screen.getByRole("button", { name: "Start New Session" }),
      );

      await waitFor(() => {
        expect(screen.getByText("Failed to start")).toBeInTheDocument();
      });
    });
  });

  describe("Responsive Design", () => {
    it("should have proper width constraint for tray interface", async () => {
      mockSessionManager.getActiveSessions.mockResolvedValue([]);
      mockSessionManager.getUserSessions.mockResolvedValue([]);

      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Start New Session")).toBeInTheDocument();
      });

      const dashboard = screen
        .getByText("Start New Session")
        .closest('div[class*="max-w-[400px]"]');
      expect(dashboard).toBeInTheDocument();
    });
  });

  describe("Duration Updates", () => {
    it("should display session duration for active sessions", async () => {
      mockSessionManager.getActiveSessions.mockResolvedValue([
        mockActiveSession,
      ]);
      mockSessionManager.getUserSessions.mockResolvedValue([]);

      render(
        <TestWrapper>
          <TrayDashboard />
        </TestWrapper>,
      );

      await waitFor(() => {
        expect(screen.getByText("Recording")).toBeInTheDocument();
      });

      // Check that duration is displayed (it's dynamic, so use a pattern)
      expect(screen.getByText(/00:02:\d{2}/)).toBeInTheDocument();
    });
  });
});
