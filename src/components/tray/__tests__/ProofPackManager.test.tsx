import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import { proofPackAssembler } from "../../../services/proofPack/ProofPackAssembler";
import { SessionManager } from "../../../services/session/SessionManager";
import type { WorkSession } from "../../../types";
import { SessionStatus } from "../../../types/session.types";
import { ProofPackManager } from "../ProofPackManager";

// Mock the services
vi.mock("../../../services/session/SessionManager");
vi.mock("../../../services/proofPack/ProofPackAssembler");
vi.mock("../../../services/redaction/RedactionEngine");

// Mock AI processor to prevent initialization errors
vi.mock("../../../services/ai/AIProcessor", () => ({
  aiProcessor: {
    initialize: vi.fn().mockResolvedValue(undefined),
    analyzeSession: vi.fn().mockResolvedValue({
      summary: "Test analysis",
      keyEvents: [],
      productivity: 0.8,
    }),
    cleanup: vi.fn(),
  },
}));

// Mock Tauri API properly
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue({}),
}));

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const { initial, animate, exit, transition, ...restProps } = props;
      return <div {...restProps}>{children}</div>;
    },
  },
  AnimatePresence: ({ children, mode, ...props }: any) => (
    <div {...props}>{children}</div>
  ),
}));

// Mock the TrayRouter
const mockNavigateTo = vi.fn();
vi.mock("../TrayRouter", () => ({
  useTrayRouter: () => ({
    navigateTo: mockNavigateTo,
  }),
  TrayRouterProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TrayRouterOutlet: () => <div>Router Outlet</div>,
}));

const mockSessions: WorkSession[] = [
  {
    id: "session-1",
    userId: "user-1",
    startTime: Date.now() - 7200000, // 2 hours ago
    endTime: Date.now() - 3600000, // 1 hour ago
    status: SessionStatus.Completed,
    captureConfig: {
      captureScreen: true,
      captureKeystrokes: true,
      captureMouse: true,
      privacyFilters: [],
      qualitySettings: "high",
    },
    integrityHash: "hash-1",
    createdAt: Date.now() - 7200000,
    updatedAt: Date.now() - 3600000,
  },
  {
    id: "session-2",
    userId: "user-1",
    startTime: Date.now() - 14400000, // 4 hours ago
    endTime: Date.now() - 10800000, // 3 hours ago
    status: SessionStatus.Completed,
    captureConfig: {
      captureScreen: true,
      captureKeystrokes: false,
      captureMouse: true,
      privacyFilters: [],
      qualitySettings: "medium",
    },
    integrityHash: "hash-2",
    createdAt: Date.now() - 14400000,
    updatedAt: Date.now() - 10800000,
  },
];

const mockProofPack = {
  id: "proof-pack-1",
  version: "1.0",
  metadata: {
    creator: "user-1",
    created: Date.now(),
    sessions: ["session-1"],
    totalDuration: 3600000, // 1 hour
    title: "Test Proof Pack",
    description: "Test description",
    tags: [],
  },
  evidence: {
    sessions: [],
    aiAnalysis: [],
    timeline: [],
    systemContext: {
      operatingSystem: "macOS",
      platform: "darwin",
      deviceId: "test-device",
      timezone: "UTC",
      locale: "en-US",
      screenResolution: { width: 1920, height: 1080 },
    },
  },
  verification: {
    integrityHash: "test-hash",
    timestamp: Date.now(),
    version: "1.0",
  },
};

describe("ProofPackManager", () => {
  let mockSessionManager: {
    getUserSessions: Mock;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockSessionManager = {
      getUserSessions: vi.fn().mockResolvedValue(mockSessions),
    };

    (SessionManager as any).mockImplementation(() => mockSessionManager);

    (proofPackAssembler.createProofPack as Mock).mockResolvedValue(
      mockProofPack,
    );
    (proofPackAssembler.exportToPDF as Mock).mockResolvedValue(
      new ArrayBuffer(1024),
    );
    (proofPackAssembler.exportToJSON as Mock).mockResolvedValue(
      JSON.stringify(mockProofPack),
    );
  });

  describe("Component Definition", () => {
    it("should be defined and importable", () => {
      expect(ProofPackManager).toBeDefined();
      expect(typeof ProofPackManager).toBe("function");
    });

    it("should render without crashing with props", () => {
      expect(() => {
        render(
          <ProofPackManager sessionId="test-session" className="test-class" />,
        );
      }).not.toThrow();
    });

    it("should render without crashing with minimal props", () => {
      expect(() => {
        render(<ProofPackManager />);
      }).not.toThrow();
    });

    it("should accept different sessionId formats", () => {
      const testCases = [
        "short",
        "session-with-dashes",
        "session_with_underscores",
        "sessionWithCamelCase",
        "session123",
      ];

      testCases.forEach((sessionId) => {
        expect(() => {
          render(<ProofPackManager sessionId={sessionId} />);
        }).not.toThrow();
      });
    });

    it("should accept different className formats", () => {
      const testCases = [
        "simple",
        "class-with-dashes",
        "class_with_underscores",
        "classWithCamelCase",
        "multiple classes here",
      ];

      testCases.forEach((className) => {
        expect(() => {
          render(<ProofPackManager className={className} />);
        }).not.toThrow();
      });
    });
  });

  describe("Session Selection", () => {
    it("should render session selection step when no sessionId provided", async () => {
      render(<ProofPackManager />);

      await waitFor(() => {
        expect(screen.getByText("Select Sessions")).toBeInTheDocument();
        expect(
          screen.getByText("Choose sessions to include in your proof pack"),
        ).toBeInTheDocument();
      });
    });

    it("should load and display available sessions", async () => {
      render(<ProofPackManager />);

      await waitFor(() => {
        expect(screen.getByText(/Session.*ession-1/)).toBeInTheDocument();
        expect(screen.getByText(/Session.*ession-2/)).toBeInTheDocument();
      });

      expect(mockSessionManager.getUserSessions).toHaveBeenCalledWith(
        "current-user",
        10,
      );
    });

    it("should allow selecting and deselecting sessions", async () => {
      render(<ProofPackManager />);

      await waitFor(() => {
        expect(screen.getByText(/Session.*ession-1/)).toBeInTheDocument();
      });

      const checkboxes = screen.getAllByRole("checkbox");
      const checkbox1 = checkboxes[0];
      const checkbox2 = checkboxes[1];
      const continueButton = screen.getByRole("button", {
        name: /Continue \(0 selected\)/,
      });

      expect(continueButton).toBeDisabled();

      // Select first session
      fireEvent.click(checkbox1);
      expect(
        screen.getByRole("button", { name: /Continue \(1 selected\)/ }),
      ).not.toBeDisabled();

      // Select second session
      fireEvent.click(checkbox2);
      expect(
        screen.getByRole("button", { name: /Continue \(2 selected\)/ }),
      ).not.toBeDisabled();

      // Deselect first session
      fireEvent.click(checkbox1);
      expect(
        screen.getByRole("button", { name: /Continue \(1 selected\)/ }),
      ).not.toBeDisabled();
    });

    it("should proceed to configuration step when sessions are selected", async () => {
      render(<ProofPackManager />);

      await waitFor(() => {
        expect(screen.getByText(/Session.*ession-1/)).toBeInTheDocument();
      });

      const checkbox = screen.getAllByRole("checkbox")[0];
      const continueButton = screen.getByRole("button", { name: /Continue/ });

      fireEvent.click(checkbox);
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText("Configure Proof Pack")).toBeInTheDocument();
      });
    });
  });

  describe("Configuration Step", () => {
    it("should skip to configuration when sessionId is provided", async () => {
      render(<ProofPackManager sessionId="session-1" />);

      await waitFor(() => {
        expect(screen.getByText("Configure Proof Pack")).toBeInTheDocument();
        expect(screen.queryByText("Select Sessions")).not.toBeInTheDocument();
      });
    });

    it("should allow configuring proof pack settings", async () => {
      render(<ProofPackManager sessionId="session-1" />);

      await waitFor(() => {
        expect(screen.getByText("Configure Proof Pack")).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText("Proof Pack Name");
      const descriptionInput = screen.getByLabelText("Description (Optional)");
      const timelineCheckbox = screen.getByLabelText("Session timeline");
      const screenshotsCheckbox = screen.getByLabelText("Screenshots");
      const aiAnalysisCheckbox = screen.getByLabelText("AI analysis");

      // Test input changes
      fireEvent.change(titleInput, {
        target: { value: "My Custom Proof Pack" },
      });
      fireEvent.change(descriptionInput, {
        target: { value: "Custom description" },
      });

      expect(titleInput).toHaveValue("My Custom Proof Pack");
      expect(descriptionInput).toHaveValue("Custom description");

      // Test checkbox toggles
      expect(timelineCheckbox).toBeChecked();
      expect(screenshotsCheckbox).toBeChecked();
      expect(aiAnalysisCheckbox).toBeChecked();

      fireEvent.click(timelineCheckbox);
      expect(timelineCheckbox).not.toBeChecked();
    });

    it("should show back button when not started with sessionId", async () => {
      render(<ProofPackManager />);

      // Navigate to configuration step
      await waitFor(() => {
        expect(screen.getByText(/Session.*ession-1/)).toBeInTheDocument();
      });

      const checkbox = screen.getAllByRole("checkbox")[0];
      const continueButton = screen.getByRole("button", { name: /Continue/ });

      fireEvent.click(checkbox);
      fireEvent.click(continueButton);

      await waitFor(() => {
        expect(screen.getByText("Configure Proof Pack")).toBeInTheDocument();
        expect(
          screen.getByRole("button", { name: "Back" }),
        ).toBeInTheDocument();
      });
    });

    it("should not show back button when started with sessionId", async () => {
      render(<ProofPackManager sessionId="session-1" />);

      await waitFor(() => {
        expect(screen.getByText("Configure Proof Pack")).toBeInTheDocument();
        expect(
          screen.queryByRole("button", { name: "Back" }),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Proof Pack Creation", () => {
    it("should create proof pack with selected configuration", async () => {
      render(<ProofPackManager sessionId="session-1" />);

      await waitFor(() => {
        expect(screen.getByText("Configure Proof Pack")).toBeInTheDocument();
      });

      const titleInput = screen.getByLabelText("Proof Pack Name");
      const createButton = screen.getByRole("button", {
        name: "Create Proof Pack",
      });

      fireEvent.change(titleInput, { target: { value: "Test Pack" } });
      fireEvent.click(createButton);

      // Should show creating state
      await waitFor(() => {
        expect(screen.getByText("Creating Proof Pack")).toBeInTheDocument();
        expect(
          screen.getByText(
            "Processing sessions and generating cryptographic proofs...",
          ),
        ).toBeInTheDocument();
      });

      // Should eventually show completion
      await waitFor(
        () => {
          expect(screen.getByText("Proof Pack Created")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      expect(proofPackAssembler.createProofPack).toHaveBeenCalledWith(
        ["session-1"],
        expect.objectContaining({
          title: "Test Pack",
          includeScreenshots: true,
          includeTimeline: true,
          includeAIAnalysis: true,
          userId: "current-user",
        }),
      );
    });

    it("should show progress during creation", async () => {
      // Mock a delayed response to show progress
      let resolveProofPack: (value: any) => void;
      const proofPackPromise = new Promise((resolve) => {
        resolveProofPack = resolve;
      });
      (proofPackAssembler.createProofPack as Mock).mockReturnValue(
        proofPackPromise,
      );

      render(<ProofPackManager sessionId="session-1" />);

      await waitFor(() => {
        expect(screen.getByText("Configure Proof Pack")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", {
        name: "Create Proof Pack",
      });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText("Creating Proof Pack")).toBeInTheDocument();
      });

      // Check for progress indication (loading state)
      expect(screen.getByText("Creating Proof Pack")).toBeInTheDocument();

      // Resolve the promise to complete the creation
      resolveProofPack!(mockProofPack);

      await waitFor(() => {
        expect(screen.getByText("Proof Pack Created")).toBeInTheDocument();
      });
    });

    it("should handle creation errors", async () => {
      (proofPackAssembler.createProofPack as Mock).mockRejectedValue(
        new Error("Creation failed"),
      );

      render(<ProofPackManager sessionId="session-1" />);

      await waitFor(() => {
        expect(screen.getByText("Configure Proof Pack")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", {
        name: "Create Proof Pack",
      });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText("Creation Failed")).toBeInTheDocument();
        expect(screen.getByText("Creation failed")).toBeInTheDocument();
      });

      const tryAgainButton = screen.getByRole("button", { name: "Try Again" });
      expect(tryAgainButton).toBeInTheDocument();
    });
  });

  describe("Completion and Export", () => {
    beforeEach(() => {
      // Mock URL.createObjectURL and related functions
      Object.defineProperty(globalThis, "URL", {
        value: {
          createObjectURL: vi.fn(() => "mock-url"),
          revokeObjectURL: vi.fn(),
        },
        writable: true,
      });

      // Mock document.createElement for download links
      const originalCreateElement = document.createElement;
      vi.spyOn(document, "createElement").mockImplementation(
        (tagName: string) => {
          if (tagName === "a") {
            const mockAnchor = {
              href: "",
              download: "",
              click: vi.fn(),
              style: {},
              setAttribute: vi.fn(),
              getAttribute: vi.fn(),
              removeAttribute: vi.fn(),
            };
            return mockAnchor as any;
          }
          return originalCreateElement.call(document, tagName);
        },
      );
    });

    it("should show completion state with proof pack details", async () => {
      render(<ProofPackManager sessionId="session-1" />);

      await waitFor(() => {
        expect(screen.getByText("Configure Proof Pack")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", {
        name: "Create Proof Pack",
      });
      fireEvent.click(createButton);

      await waitFor(
        () => {
          expect(screen.getByText("Proof Pack Created")).toBeInTheDocument();
          expect(screen.getByText("Test Proof Pack")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      // Check proof pack details
      expect(screen.getByText("Sessions:")).toBeInTheDocument();
      expect(screen.getByText("Duration:")).toBeInTheDocument();
      expect(screen.getByText("Created:")).toBeInTheDocument();
    });

    it("should export proof pack as PDF", async () => {
      render(<ProofPackManager sessionId="session-1" />);

      // Navigate to completion state
      await waitFor(() => {
        expect(screen.getByText("Configure Proof Pack")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", {
        name: "Create Proof Pack",
      });
      fireEvent.click(createButton);

      await waitFor(
        () => {
          expect(screen.getByText("Proof Pack Created")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      const exportPdfButton = screen.getByRole("button", {
        name: "Export PDF",
      });
      fireEvent.click(exportPdfButton);

      expect(proofPackAssembler.exportToPDF).toHaveBeenCalledWith(
        mockProofPack,
      );
    });

    it("should export proof pack as JSON", async () => {
      render(<ProofPackManager sessionId="session-1" />);

      // Navigate to completion state
      await waitFor(() => {
        expect(screen.getByText("Configure Proof Pack")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", {
        name: "Create Proof Pack",
      });
      fireEvent.click(createButton);

      await waitFor(
        () => {
          expect(screen.getByText("Proof Pack Created")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      const exportJsonButton = screen.getByRole("button", {
        name: "Export JSON",
      });
      fireEvent.click(exportJsonButton);

      expect(proofPackAssembler.exportToJSON).toHaveBeenCalledWith(
        mockProofPack,
      );
    });

    it("should allow creating another proof pack", async () => {
      render(<ProofPackManager sessionId="session-1" />);

      // Navigate to completion state
      await waitFor(() => {
        expect(screen.getByText("Configure Proof Pack")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", {
        name: "Create Proof Pack",
      });
      fireEvent.click(createButton);

      await waitFor(
        () => {
          expect(screen.getByText("Proof Pack Created")).toBeInTheDocument();
        },
        { timeout: 5000 },
      );

      const createAnotherButton = screen.getByRole("button", {
        name: "Create Another",
      });
      fireEvent.click(createAnotherButton);

      await waitFor(() => {
        expect(screen.getByText("Configure Proof Pack")).toBeInTheDocument();
      });
    });
  });

  describe("Recent Proof Packs", () => {
    it("should display recent proof packs in selection and configuration steps", async () => {
      render(<ProofPackManager />);

      await waitFor(() => {
        expect(screen.getByText("Recent Proof Packs")).toBeInTheDocument();
        expect(screen.getByText("Writing Project Proof")).toBeInTheDocument();
        expect(screen.getByText("Code Review Evidence")).toBeInTheDocument();
      });
    });

    it("should show proof pack details in recent list", async () => {
      render(<ProofPackManager />);

      await waitFor(() => {
        expect(screen.getByText("Recent Proof Packs")).toBeInTheDocument();
      });

      // Check for session count and file size
      expect(screen.getByText(/2 sessions • 5\.0 MB/)).toBeInTheDocument();
      expect(screen.getByText(/1 sessions • 2\.0 MB/)).toBeInTheDocument();
    });

    it("should not show recent proof packs during creation or completion", async () => {
      render(<ProofPackManager sessionId="session-1" />);

      await waitFor(() => {
        expect(screen.getByText("Configure Proof Pack")).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", {
        name: "Create Proof Pack",
      });
      fireEvent.click(createButton);

      await waitFor(() => {
        expect(screen.getByText("Creating Proof Pack")).toBeInTheDocument();
        expect(
          screen.queryByText("Recent Proof Packs"),
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Loading States", () => {
    it("should show loading spinner while loading data", async () => {
      // Make getUserSessions return a pending promise
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockSessionManager.getUserSessions.mockReturnValue(pendingPromise);

      render(<ProofPackManager />);

      expect(screen.getByText("Loading...")).toBeInTheDocument();

      // Clean up by resolving the promise
      resolvePromise!(mockSessions);
      await waitFor(() => {
        expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper form labels", async () => {
      render(<ProofPackManager sessionId="session-1" />);

      await waitFor(() => {
        expect(screen.getByLabelText("Proof Pack Name")).toBeInTheDocument();
        expect(
          screen.getByLabelText("Description (Optional)"),
        ).toBeInTheDocument();
        expect(screen.getByLabelText("Session timeline")).toBeInTheDocument();
        expect(screen.getByLabelText("Screenshots")).toBeInTheDocument();
        expect(screen.getByLabelText("AI analysis")).toBeInTheDocument();
      });
    });

    it("should have proper button types", async () => {
      render(<ProofPackManager sessionId="session-1" />);

      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: "Create Proof Pack" }),
        ).toHaveAttribute("type", "button");
      });
    });
  });
});
