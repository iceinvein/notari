import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TrayView } from "../../../types/tray.types";
import {
  TrayNavigationHeader,
  TrayRouterOutlet,
  TrayRouterProvider,
  useTrayRouter,
} from "../TrayRouter";

// Mock all external dependencies to prevent memory leaks
vi.mock("../../../services/tray/TrayResourceManager", () => ({
  trayResourceManager: {
    recordActivity: vi.fn(),
    getConfig: vi.fn(() => ({
      enableAnimations: false, // Disable animations in tests
      syncInterval: 1000,
      maxEventBatch: 10,
      backgroundProcessing: false,
      notificationThrottle: 100,
    })),
  },
}));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="animate-presence">{children}</div>
  ),
  motion: {
    div: ({ children, ...props }: any) => {
      const {
        initial,
        animate,
        exit,
        transition,
        variants,
        custom,
        ...domProps
      } = props;
      return <div {...domProps}>{children}</div>;
    },
    p: ({ children, ...props }: any) => {
      const { initial, animate, transition, ...domProps } = props;
      return <p {...domProps}>{children}</p>;
    },
  },
}));

vi.mock("../../../hooks/useOptimizedEventHandling", () => ({
  useOptimizedKeyboardEvents: vi.fn(),
}));

// Simple test components
const TestViewA = () => <div data-testid="view-a">View A</div>;
const TestViewB = () => <div data-testid="view-b">View B</div>;

const testViews: TrayView[] = [
  {
    id: "view-a",
    component: TestViewA,
    title: "View A",
    canGoBack: false,
  },
  {
    id: "view-b",
    component: TestViewB,
    title: "View B",
    canGoBack: true,
  },
];

// Minimal test component that doesn't cause infinite loops
function SimpleTestComponent() {
  const { navigateTo, getCurrentView, registerView } = useTrayRouter();
  const [isRegistered, setIsRegistered] = React.useState(false);

  React.useEffect(() => {
    if (!isRegistered) {
      testViews.forEach((view) => registerView(view));
      setIsRegistered(true);
    }
  }, [registerView, isRegistered]);

  const currentView = getCurrentView();

  return (
    <div>
      <div data-testid="current-view-id">{currentView?.id || "none"}</div>
      <button
        type="button"
        data-testid="nav-to-a"
        onClick={() => navigateTo("view-a")}
      >
        Navigate to A
      </button>
      <button
        type="button"
        data-testid="nav-to-b"
        onClick={() => navigateTo("view-b")}
      >
        Navigate to B
      </button>
      <TrayRouterOutlet />
    </div>
  );
}

describe("TrayRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
  });

  describe("Basic Functionality", () => {
    it("should render without crashing", () => {
      render(
        <TrayRouterProvider>
          <div>Test</div>
        </TrayRouterProvider>,
      );

      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("should show no view message initially", () => {
      render(
        <TrayRouterProvider>
          <TrayRouterOutlet />
        </TrayRouterProvider>,
      );

      expect(screen.getByText("No view to display")).toBeInTheDocument();
    });

    it("should navigate to a view", () => {
      render(
        <TrayRouterProvider>
          <SimpleTestComponent />
        </TrayRouterProvider>,
      );

      // Initially no view
      expect(screen.getByTestId("current-view-id")).toHaveTextContent("none");

      // Navigate to view A
      fireEvent.click(screen.getByTestId("nav-to-a"));

      // Should show view A
      expect(screen.getByTestId("current-view-id")).toHaveTextContent("view-a");
      expect(screen.getByTestId("view-a")).toBeInTheDocument();
    });

    it("should switch between views", () => {
      render(
        <TrayRouterProvider>
          <SimpleTestComponent />
        </TrayRouterProvider>,
      );

      // Navigate to view A
      fireEvent.click(screen.getByTestId("nav-to-a"));
      expect(screen.getByTestId("view-a")).toBeInTheDocument();

      // Navigate to view B
      fireEvent.click(screen.getByTestId("nav-to-b"));
      expect(screen.getByTestId("view-b")).toBeInTheDocument();
      expect(screen.queryByTestId("view-a")).not.toBeInTheDocument();
    });

    it("should handle initial view prop", () => {
      const initialView = testViews[0];

      render(
        <TrayRouterProvider initialView={initialView}>
          <SimpleTestComponent />
        </TrayRouterProvider>,
      );

      expect(screen.getByTestId("current-view-id")).toHaveTextContent("view-a");
    });
  });

  describe("TrayNavigationHeader", () => {
    it("should display default title when no view", () => {
      render(
        <TrayRouterProvider>
          <TrayNavigationHeader />
        </TrayRouterProvider>,
      );

      expect(
        screen.getByRole("heading", { name: "Notari" }),
      ).toBeInTheDocument();
    });

    it("should use custom title when provided", () => {
      render(
        <TrayRouterProvider>
          <TrayNavigationHeader title="Custom Title" />
        </TrayRouterProvider>,
      );

      expect(
        screen.getByRole("heading", { name: "Custom Title" }),
      ).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("should throw error when useTrayRouter is used outside provider", () => {
      // Suppress console.error for this test
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      expect(() => {
        render(<SimpleTestComponent />);
      }).toThrow("useTrayRouter must be used within a TrayRouterProvider");

      consoleSpy.mockRestore();
    });
  });

  describe("Router State Management", () => {
    it("should maintain navigation history", () => {
      render(
        <TrayRouterProvider>
          <SimpleTestComponent />
        </TrayRouterProvider>,
      );

      // Navigate to view A
      fireEvent.click(screen.getByTestId("nav-to-a"));
      expect(screen.getByTestId("view-a")).toBeInTheDocument();

      // Navigate to view B
      fireEvent.click(screen.getByTestId("nav-to-b"));
      expect(screen.getByTestId("view-b")).toBeInTheDocument();

      // Should be able to go back (though we don't test the actual back functionality here)
      expect(screen.getByTestId("current-view-id")).toHaveTextContent("view-b");
    });

    it("should handle view registration", () => {
      render(
        <TrayRouterProvider>
          <SimpleTestComponent />
        </TrayRouterProvider>,
      );

      // Views should be registered and navigation should work
      fireEvent.click(screen.getByTestId("nav-to-a"));
      expect(screen.getByTestId("view-a")).toBeInTheDocument();
    });
  });
});
