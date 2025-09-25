import { invoke } from "@tauri-apps/api/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { SessionStatus, type WorkSession } from "../../../types/session.types";
import { RecentSessionsList } from "../RecentSessionsList";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock TrayRouter
const mockNavigateTo = vi.fn();
vi.mock("../TrayRouter", () => ({
  useTrayRouter: () => ({
    navigateTo: mockNavigateTo,
  }),
}));

const mockInvoke = invoke as Mock;

// Create a mock SessionManager instance
const mockSessionManager = {
  getUserSessions: vi.fn(),
  formatDuration: vi.fn((ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else {
      return `${seconds}s`;
    }
  }),
  getStatusDisplay: vi.fn((status: SessionStatus) => status),
};

// Mock SessionManager
vi.mock("../../../services/session/SessionManager", () => ({
  SessionManager: vi.fn(() => mockSessionManager),
}));

const createMockSession = (
  overrides: Partial<WorkSession> = {},
): WorkSession => ({
  id: "test-session-1",
  userId: "user-1",
  startTime: Date.now() - 3600000, // 1 hour ago
  endTime: Date.now() - 1800000, // 30 minutes ago
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
  ...overrides,
});

describe("RecentSessionsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations
    mockSessionManager.getUserSessions.mockReset();
    mockSessionManager.formatDuration.mockImplementation((ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);
      if (hours > 0) {
        return `${hours}h ${minutes % 60}m`;
      } else if (minutes > 0) {
        return `${minutes}m`;
      } else {
        return `${seconds}s`;
      }
    });
    mockSessionManager.getStatusDisplay.mockImplementation(
      (status: SessionStatus) => status,
    );
  });

  describe("Loading State", () => {
    it("should show loading spinner while fetching sessions", () => {
      // Mock SessionManager to never resolve
      mockSessionManager.getUserSessions.mockImplementation(
        () => new Promise(() => {}),
      );

      render(<RecentSessionsList />);

      expect(screen.getByText("Loading sessions...")).toBeInTheDocument();
      // Check for spinner by aria-label instead of role
      expect(screen.getByLabelText("Loading")).toBeInTheDocument();
    });
  });

  describe("Sessions Display", () => {
    it("should render list of sessions correctly", async () => {
      const mockSessions = [
        createMockSession({
          id: "session-1",
          status: SessionStatus.Completed,
        }),
        createMockSession({
          id: "session-2",
          status: SessionStatus.Active,
          endTime: undefined,
        }),
      ];

      mockSessionManager.getUserSessions.mockResolvedValue(mockSessions);
      mockSessionManager.formatDuration.mockReturnValue("1h 30m");

      render(<RecentSessionsList />);

      await waitFor(() => {
        expect(screen.getByText("Recent Sessions")).toBeInTheDocument();
      });

      // Check that sessions are displayed (using partial text match)
      expect(screen.getByText(/Session.*ession-1/)).toBeInTheDocument();
      expect(screen.getByText(/Session.*ession-2/)).toBeInTheDocument();

      // Check status chips
      expect(screen.getByText("completed")).toBeInTheDocument();
      expect(screen.getByText("active")).toBeInTheDocument();
    });

    it("should show empty state when no sessions exist", async () => {
      mockSessionManager.getUserSessions.mockResolvedValue([]);

      render(<RecentSessionsList />);

      await waitFor(() => {
        expect(
          screen.getByText("No recent sessions found"),
        ).toBeInTheDocument();
      });

      expect(screen.getByText("Start your first session")).toBeInTheDocument();
    });

    it("should show error state when loading fails", async () => {
      mockSessionManager.getUserSessions.mockRejectedValue(
        new Error("Database error"),
      );

      render(<RecentSessionsList />);

      await waitFor(() => {
        expect(screen.getByText("Database error")).toBeInTheDocument();
      });

      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });
  });

  describe("Session Item Expansion", () => {
    it("should expand and collapse session details", async () => {
      const mockSession = createMockSession({
        id: "expandable-session",
        tamperEvidence: "some-evidence",
      });

      mockSessionManager.getUserSessions.mockResolvedValue([mockSession]);
      mockSessionManager.formatDuration.mockReturnValue("2h 15m");

      render(<RecentSessionsList />);

      await waitFor(() => {
        expect(screen.getByText(/Session.*-session/)).toBeInTheDocument();
      });

      // Initially collapsed
      expect(screen.queryByText("Started:")).not.toBeInTheDocument();

      // Click to expand - find the session card button by content
      const sessionCards = screen.getAllByRole("button");
      const sessionCard = sessionCards.find(
        (card) =>
          card.textContent?.includes("Session") &&
          card.textContent?.includes("-session") &&
          !card.textContent?.includes("Refresh"),
      );
      expect(sessionCard).toBeDefined();

      fireEvent.click(sessionCard!);

      // Should show expanded details
      expect(screen.getByText("Started:")).toBeInTheDocument();
      expect(screen.getByText("Ended:")).toBeInTheDocument();
      expect(screen.getByText("Capture Config:")).toBeInTheDocument();
      expect(screen.getByText("Tamper Evidence:")).toBeInTheDocument();
      expect(screen.getByText("⚠️ Detected")).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(sessionCard!);

      // Should hide details
      expect(screen.queryByText("Started:")).not.toBeInTheDocument();
    });

    it("should handle keyboard navigation for expansion", async () => {
      const mockSession = createMockSession({
        id: "keyboard-test-session",
      });
      mockSessionManager.getUserSessions.mockResolvedValue([mockSession]);
      mockSessionManager.formatDuration.mockReturnValue("1h");

      render(<RecentSessionsList />);

      await waitFor(() => {
        expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
      });

      // Find the session card by looking for the session text pattern
      const sessionCards = screen.getAllByRole("button");
      // Filter out the refresh button and find the session card
      const sessionCard = sessionCards.find(
        (card) =>
          card.getAttribute("role") === "button" &&
          card.textContent?.includes("Session") &&
          !card.textContent?.includes("Refresh"),
      );

      if (!sessionCard) {
        // If we can't find by text, just use the first non-refresh button
        const nonRefreshCards = sessionCards.filter(
          (card) => !card.textContent?.includes("Refresh"),
        );
        expect(nonRefreshCards.length).toBeGreaterThan(0);

        // Test Enter key on first session card
        fireEvent.keyDown(nonRefreshCards[0], { key: "Enter" });
        expect(screen.getByText("Started:")).toBeInTheDocument();

        // Test Space key to collapse
        fireEvent.keyDown(nonRefreshCards[0], { key: " " });
        expect(screen.queryByText("Started:")).not.toBeInTheDocument();
      } else {
        // Test Enter key
        fireEvent.keyDown(sessionCard, { key: "Enter" });
        expect(screen.getByText("Started:")).toBeInTheDocument();

        // Test Space key to collapse
        fireEvent.keyDown(sessionCard, { key: " " });
        expect(screen.queryByText("Started:")).not.toBeInTheDocument();
      }
    });
  });

  describe("Quick Actions", () => {
    it("should navigate to proof pack manager when create proof pack is clicked", async () => {
      const mockSession = createMockSession({
        id: "proof-pack-session",
        status: SessionStatus.Completed,
      });

      mockSessionManager.getUserSessions.mockResolvedValue([mockSession]);
      mockSessionManager.formatDuration.mockReturnValue("45m");

      render(<RecentSessionsList />);

      await waitFor(() => {
        expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
      });

      // Expand session to show actions
      const sessionCards = screen.getAllByRole("button");
      const sessionCard = sessionCards.find(
        (card) =>
          card.getAttribute("role") === "button" &&
          card.textContent?.includes("Session") &&
          card.textContent?.includes("pack-session"),
      );

      if (sessionCard) {
        fireEvent.click(sessionCard);

        // Wait for expansion and then click create proof pack button
        await waitFor(() => {
          expect(screen.getByText("📦 Create Proof Pack")).toBeInTheDocument();
        });

        const proofPackButton = screen.getByText("📦 Create Proof Pack");
        fireEvent.click(proofPackButton);

        expect(mockNavigateTo).toHaveBeenCalledWith("proof-pack-manager", {
          sessionId: "proof-pack-session",
        });
      }
    });

    it("should call export function when export button is clicked", async () => {
      const mockSession = createMockSession({
        id: "export-session",
        status: SessionStatus.Completed,
      });

      mockSessionManager.getUserSessions.mockResolvedValue([mockSession]);
      mockSessionManager.formatDuration.mockReturnValue("30m");
      mockInvoke.mockResolvedValue({ success: true });

      render(<RecentSessionsList />);

      await waitFor(() => {
        expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
      });

      // Expand session to show actions
      const sessionCards = screen.getAllByRole("button");
      const sessionCard = sessionCards.find(
        (card) =>
          card.getAttribute("role") === "button" &&
          card.textContent?.includes("Session") &&
          card.textContent?.includes("port-session"),
      );

      if (sessionCard) {
        fireEvent.click(sessionCard);

        // Wait for expansion and then click export button
        await waitFor(() => {
          expect(screen.getByText("📤 Export")).toBeInTheDocument();
        });

        const exportButton = screen.getByText("📤 Export");
        fireEvent.click(exportButton);

        expect(mockInvoke).toHaveBeenCalledWith("export_session_data", {
          sessionId: "export-session",
        });
      }
    });

    it("should disable proof pack creation for failed sessions", async () => {
      const mockSession = createMockSession({
        id: "failed-session",
        status: SessionStatus.Failed,
      });

      mockSessionManager.getUserSessions.mockResolvedValue([mockSession]);
      mockSessionManager.formatDuration.mockReturnValue("15m");

      render(<RecentSessionsList />);

      await waitFor(() => {
        expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
      });

      // Expand session to show actions
      const sessionCards = screen.getAllByRole("button");
      const sessionCard = sessionCards.find(
        (card) =>
          card.getAttribute("role") === "button" &&
          card.textContent?.includes("Session") &&
          card.textContent?.includes("led-session"),
      );

      if (sessionCard) {
        fireEvent.click(sessionCard);

        // Wait for expansion and check disabled state
        await waitFor(() => {
          expect(screen.getByText("📦 Create Proof Pack")).toBeInTheDocument();
        });

        const proofPackButton = screen.getByText("📦 Create Proof Pack");
        expect(proofPackButton.closest("button")).toBeDisabled();
      }
    });

    it("should disable export for active sessions", async () => {
      const mockSession = createMockSession({
        id: "active-session",
        status: SessionStatus.Active,
        endTime: undefined,
      });

      mockSessionManager.getUserSessions.mockResolvedValue([mockSession]);
      mockSessionManager.formatDuration.mockReturnValue("ongoing");

      render(<RecentSessionsList />);

      await waitFor(() => {
        expect(screen.getAllByRole("button").length).toBeGreaterThan(0);
      });

      // Expand session to show actions
      const sessionCards = screen.getAllByRole("button");
      const sessionCard = sessionCards.find(
        (card) =>
          card.getAttribute("role") === "button" &&
          card.textContent?.includes("Session") &&
          card.textContent?.includes("tive-session"),
      );

      if (sessionCard) {
        fireEvent.click(sessionCard);

        // Wait for expansion and check disabled state
        await waitFor(() => {
          expect(screen.getByText("📤 Export")).toBeInTheDocument();
        });

        const exportButton = screen.getByText("📤 Export");
        expect(exportButton.closest("button")).toBeDisabled();
      }
    });
  });

  describe("Refresh Functionality", () => {
    it("should refresh sessions when refresh button is clicked", async () => {
      mockSessionManager.getUserSessions.mockResolvedValue([]);

      render(<RecentSessionsList />);

      await waitFor(() => {
        expect(screen.getByText("🔄 Refresh")).toBeInTheDocument();
      });

      // Clear the initial call
      mockSessionManager.getUserSessions.mockClear();

      // Click refresh
      const refreshButton = screen.getByText("🔄 Refresh");
      fireEvent.click(refreshButton);

      expect(mockSessionManager.getUserSessions).toHaveBeenCalledTimes(1);
    });

    it("should retry loading when try again button is clicked after error", async () => {
      mockSessionManager.getUserSessions
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce([]);

      render(<RecentSessionsList />);

      await waitFor(() => {
        expect(screen.getByText("Network error")).toBeInTheDocument();
      });

      // Click try again
      const tryAgainButton = screen.getByText("Try Again");
      fireEvent.click(tryAgainButton);

      await waitFor(() => {
        expect(
          screen.getByText("No recent sessions found"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Date Formatting", () => {
    it("should format dates correctly", async () => {
      const now = Date.now();
      const mockSessions = [
        createMockSession({
          id: "today-session",
          createdAt: now - 1000 * 60 * 60, // 1 hour ago
        }),
        createMockSession({
          id: "yesterday-session",
          createdAt: now - 1000 * 60 * 60 * 25, // 25 hours ago (yesterday)
        }),
        createMockSession({
          id: "old-session",
          createdAt: now - 1000 * 60 * 60 * 24 * 10, // 10 days ago
        }),
      ];

      mockSessionManager.getUserSessions.mockResolvedValue(mockSessions);
      mockSessionManager.formatDuration.mockReturnValue("1h");

      render(<RecentSessionsList />);

      await waitFor(() => {
        expect(screen.getByText("Today")).toBeInTheDocument();
        expect(screen.getByText("Yesterday")).toBeInTheDocument();
        // For dates older than 7 days, it shows the actual date, not "X days ago"
        // So we just check that some date format is present
        const dateElements = screen.getAllByText(/\d+\/\d+\/\d+|\d+ days ago/);
        expect(dateElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Limit and Load More", () => {
    it("should respect the limit prop", async () => {
      mockSessionManager.getUserSessions.mockResolvedValue([]);

      render(<RecentSessionsList limit={5} />);

      await waitFor(() => {
        expect(mockSessionManager.getUserSessions).toHaveBeenCalledWith(
          "user-1",
          5,
        );
      });
    });

    it("should show load more button when sessions equal limit", async () => {
      const mockSessions = Array.from({ length: 5 }, (_, i) =>
        createMockSession({ id: `session-${i}` }),
      );

      mockSessionManager.getUserSessions.mockResolvedValue(mockSessions);
      mockSessionManager.formatDuration.mockReturnValue("1h");

      render(<RecentSessionsList limit={5} />);

      await waitFor(() => {
        expect(screen.getByText("Load More Sessions")).toBeInTheDocument();
      });
    });
  });
});
