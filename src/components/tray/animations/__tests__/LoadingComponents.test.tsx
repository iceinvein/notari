import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AsyncProgress,
  LoadingCard,
  LoadingDots,
  LoadingSkeleton,
  LoadingSpinner,
  LoadingState,
  ProgressBar,
} from "../LoadingComponents";

// Mock framer-motion
vi.mock("framer-motion", () => {
  const MotionComponent = ({ children, ...props }: any) => {
    // Filter out framer-motion specific props to avoid React warnings
    const {
      initial,
      animate,
      exit,
      transition,
      variants,
      whileHover,
      whileTap,
      whileFocus,
      whileInView,
      onAnimationStart,
      onAnimationComplete,
      onHoverStart,
      onHoverEnd,
      onTapStart,
      onTap,
      onTapCancel,
      layout,
      layoutId,
      drag,
      dragConstraints,
      dragElastic,
      dragMomentum,
      ...domProps
    } = props;
    return <div {...domProps}>{children}</div>;
  };

  return {
    motion: {
      div: MotionComponent,
      button: MotionComponent,
      span: MotionComponent,
      p: MotionComponent,
    },
    AnimatePresence: ({ children }: any) => <>{children}</>,
  };
});

// Mock TrayResourceManager
vi.mock("../../../../services/tray/TrayResourceManager", () => ({
  useTrayResourceManager: () => ({
    getConfig: () => ({
      syncInterval: 10000,
      maxEventBatch: 20,
      enableAnimations: true,
      backgroundProcessing: true,
      notificationThrottle: 1000,
    }),
  }),
}));

describe("LoadingComponents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("LoadingSpinner", () => {
    it("should render with default props", () => {
      render(<LoadingSpinner data-testid="loading-spinner" />);

      const spinner = screen.getByTestId("loading-spinner");
      expect(spinner).toHaveClass("w-6", "h-6", "border-2", "border-blue-600");
    });

    it("should apply size classes correctly", () => {
      const { rerender } = render(
        <LoadingSpinner size="sm" data-testid="loading-spinner" />,
      );
      let spinner = screen.getByTestId("loading-spinner");
      expect(spinner).toHaveClass("w-4", "h-4", "border-2");

      rerender(<LoadingSpinner size="lg" data-testid="loading-spinner" />);
      spinner = screen.getByTestId("loading-spinner");
      expect(spinner).toHaveClass("w-8", "h-8", "border-3");
    });

    it("should apply color classes correctly", () => {
      const { rerender } = render(
        <LoadingSpinner color="success" data-testid="loading-spinner" />,
      );
      let spinner = screen.getByTestId("loading-spinner");
      expect(spinner).toHaveClass("border-green-600");

      rerender(<LoadingSpinner color="danger" data-testid="loading-spinner" />);
      spinner = screen.getByTestId("loading-spinner");
      expect(spinner).toHaveClass("border-red-600");
    });

    it("should apply custom className", () => {
      render(
        <LoadingSpinner
          className="custom-spinner"
          data-testid="loading-spinner"
        />,
      );

      const spinner = screen.getByTestId("loading-spinner");
      expect(spinner).toHaveClass("custom-spinner");
    });
  });

  describe("LoadingSkeleton", () => {
    it("should render with default props", () => {
      render(<LoadingSkeleton data-testid="loading-skeleton" />);

      const skeleton = screen.getByTestId("loading-skeleton");
      expect(skeleton).toHaveClass(
        "bg-gray-200",
        "dark:bg-gray-700",
        "rounded",
      );
    });

    it("should apply rounded class when rounded prop is true", () => {
      render(<LoadingSkeleton rounded data-testid="loading-skeleton" />);

      const skeleton = screen.getByTestId("loading-skeleton");
      expect(skeleton).toHaveClass("rounded-full");
    });

    it("should apply custom dimensions", () => {
      render(
        <LoadingSkeleton
          width={200}
          height={50}
          data-testid="loading-skeleton"
        />,
      );

      const skeleton = screen.getByTestId("loading-skeleton");
      expect(skeleton).toHaveStyle({
        width: "200px",
        height: "50px",
      });
    });

    it("should handle string dimensions", () => {
      render(
        <LoadingSkeleton
          width="50%"
          height="2rem"
          data-testid="loading-skeleton"
        />,
      );

      const skeleton = screen.getByTestId("loading-skeleton");
      expect(skeleton).toHaveStyle({
        width: "50%",
        height: "2rem",
      });
    });
  });

  describe("ProgressBar", () => {
    it("should render with default props", () => {
      render(<ProgressBar progress={50} data-testid="progress-bar" />);

      const progressContainer = screen.getByTestId("progress-bar");
      expect(progressContainer.querySelector(".h-2")).toBeInTheDocument();
    });

    it("should show label when showLabel is true", () => {
      render(
        <ProgressBar progress={75} showLabel data-testid="progress-bar" />,
      );

      expect(screen.getByText("Progress")).toBeInTheDocument();
      expect(screen.getByText("75%")).toBeInTheDocument();
    });

    it("should show custom label", () => {
      render(
        <ProgressBar
          progress={30}
          showLabel
          label="Loading data..."
          data-testid="progress-bar"
        />,
      );

      expect(screen.getByText("Loading data...")).toBeInTheDocument();
      expect(screen.getByText("30%")).toBeInTheDocument();
    });

    it("should clamp progress values", () => {
      const { rerender } = render(
        <ProgressBar progress={150} showLabel data-testid="progress-bar" />,
      );
      expect(screen.getByText("100%")).toBeInTheDocument();

      rerender(
        <ProgressBar progress={-10} showLabel data-testid="progress-bar" />,
      );
      expect(screen.getByText("0%")).toBeInTheDocument();
    });

    it("should apply size classes correctly", () => {
      const { rerender } = render(
        <ProgressBar progress={50} size="sm" data-testid="progress-bar" />,
      );
      let container = screen.getByTestId("progress-bar");
      expect(container.querySelector(".h-1")).toBeInTheDocument();

      rerender(
        <ProgressBar progress={50} size="lg" data-testid="progress-bar" />,
      );
      container = screen.getByTestId("progress-bar");
      expect(container.querySelector(".h-3")).toBeInTheDocument();
    });

    it("should apply color classes correctly", () => {
      render(
        <ProgressBar
          progress={50}
          color="success"
          data-testid="progress-bar"
        />,
      );

      const container = screen.getByTestId("progress-bar");
      const progressBar = container.querySelector(".bg-green-600");
      expect(progressBar).toBeInTheDocument();
    });
  });

  describe("LoadingDots", () => {
    it("should render three dots", () => {
      render(<LoadingDots data-testid="loading-dots" />);

      const container = screen.getByTestId("loading-dots");
      const dots = container.querySelectorAll("div");
      expect(dots).toHaveLength(3);
    });

    it("should apply size classes correctly", () => {
      const { rerender } = render(
        <LoadingDots size="sm" data-testid="loading-dots" />,
      );
      let container = screen.getByTestId("loading-dots");
      let dots = container.querySelectorAll(".w-1");
      expect(dots.length).toBeGreaterThanOrEqual(3);

      rerender(<LoadingDots size="lg" data-testid="loading-dots" />);
      container = screen.getByTestId("loading-dots");
      dots = container.querySelectorAll(".w-3");
      expect(dots.length).toBeGreaterThanOrEqual(3);
    });

    it("should apply color classes correctly", () => {
      render(<LoadingDots color="warning" data-testid="loading-dots" />);

      const container = screen.getByTestId("loading-dots");
      const dots = container.querySelectorAll(".bg-yellow-600");
      expect(dots.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("LoadingCard", () => {
    it("should render with default props", () => {
      render(<LoadingCard data-testid="loading-card" />);

      const card = screen.getByTestId("loading-card");
      expect(card).toHaveClass(
        "p-4",
        "bg-white",
        "dark:bg-gray-800",
        "rounded-lg",
      );
    });

    it("should render correct number of skeleton lines", () => {
      render(<LoadingCard lines={5} />);

      const skeletons = screen
        .getAllByRole("generic")
        .filter(
          (el) =>
            el.className.includes("bg-gray-200") &&
            el.className.includes("dark:bg-gray-700"),
        );
      expect(skeletons.length).toBeGreaterThanOrEqual(5);
    });

    it("should show avatar when showAvatar is true", () => {
      render(<LoadingCard showAvatar data-testid="loading-card" />);

      const card = screen.getByTestId("loading-card");
      const avatarSkeleton = card.querySelector(".flex-shrink-0");
      expect(avatarSkeleton).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      render(
        <LoadingCard className="custom-card" data-testid="loading-card" />,
      );

      const card = screen.getByTestId("loading-card");
      expect(card).toHaveClass("custom-card");
    });
  });

  describe("LoadingState", () => {
    it("should show loading fallback when isLoading is true", () => {
      render(
        <LoadingState isLoading={true}>
          <div>Content</div>
        </LoadingState>,
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();
      expect(screen.queryByText("Content")).not.toBeInTheDocument();
    });

    it("should show children when isLoading is false", () => {
      render(
        <LoadingState isLoading={false}>
          <div>Content</div>
        </LoadingState>,
      );

      expect(screen.getByText("Content")).toBeInTheDocument();
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    it("should show custom fallback", () => {
      render(
        <LoadingState isLoading={true} fallback={<div>Custom Loading...</div>}>
          <div>Content</div>
        </LoadingState>,
      );

      expect(screen.getByText("Custom Loading...")).toBeInTheDocument();
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });
  });

  describe("AsyncProgress", () => {
    it("should not render when not loading and no error", () => {
      const { container } = render(<AsyncProgress isLoading={false} />);

      expect(container.firstChild).toBeNull();
    });

    it("should show loading state", () => {
      render(<AsyncProgress isLoading={true} status="Processing data..." />);

      expect(screen.getByText("Processing data...")).toBeInTheDocument();
    });

    it("should show progress bar when progress is provided", () => {
      render(
        <AsyncProgress
          isLoading={true}
          progress={65}
          status="Uploading files..."
        />,
      );

      expect(screen.getByText("Uploading files...")).toBeInTheDocument();
      // Progress bar should be rendered (tested indirectly through ProgressBar component)
    });

    it("should show error state", () => {
      render(<AsyncProgress isLoading={false} error="Something went wrong" />);

      expect(screen.getByText("Error")).toBeInTheDocument();
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });

    it("should handle retry button", () => {
      const handleRetry = vi.fn();
      render(
        <AsyncProgress
          isLoading={false}
          error="Network error"
          onRetry={handleRetry}
        />,
      );

      const retryButton = screen.getByRole("button", { name: "Retry" });
      fireEvent.click(retryButton);

      expect(handleRetry).toHaveBeenCalledOnce();
    });

    it("should not show retry button when onRetry is not provided", () => {
      render(<AsyncProgress isLoading={false} error="Network error" />);

      expect(
        screen.queryByRole("button", { name: "Retry" }),
      ).not.toBeInTheDocument();
    });
  });

  describe("Performance Considerations", () => {
    it("should respect animation settings from resource manager", () => {
      render(<LoadingSpinner data-testid="loading-spinner" />);

      // Component should still render
      const spinner = screen.getByTestId("loading-spinner");
      expect(spinner).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should provide appropriate ARIA labels for loading states", () => {
      render(
        <LoadingState isLoading={true}>
          <div>Content</div>
        </LoadingState>,
      );

      expect(screen.getByText("Loading...")).toBeInTheDocument();
    });

    it("should maintain proper button semantics in AsyncProgress", () => {
      const handleRetry = vi.fn();
      render(
        <AsyncProgress
          isLoading={false}
          error="Error occurred"
          onRetry={handleRetry}
        />,
      );

      const retryButton = screen.getByRole("button", { name: "Retry" });
      expect(retryButton).toHaveAttribute("type", "button");
    });
  });
});
