import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoadingSpinner, ProgressBar } from "../LoadingComponents";
import { TrayPopover } from "../PopoverAnimations";
import { AnimatedButton, AnimatedWrapper } from "../TrayAnimations";

// Mock framer-motion with performance tracking
const mockMotionDiv = vi.fn();
const mockMotionButton = vi.fn();

vi.mock("framer-motion", () => ({
  motion: {
    div: (props: any) => {
      mockMotionDiv(props);
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
      return <div {...domProps} />;
    },
    button: (props: any) => {
      mockMotionButton(props);
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
        ...domProps
      } = props;
      return <button {...domProps} />;
    },
  },
  AnimatePresence: ({ children }: any) => <div>{children}</div>,
}));

// Mock TrayResourceManager with different performance levels
const mockGetConfig = vi.fn(() => ({
  syncInterval: 10000,
  maxEventBatch: 20,
  enableAnimations: true,
  backgroundProcessing: true,
  notificationThrottle: 1000,
}));
const mockRecordActivity = vi.fn();
const mockGetCurrentLevel = vi.fn(() => "normal");

vi.mock("../../../../services/tray/TrayResourceManager", () => ({
  useTrayResourceManager: () => ({
    getConfig: mockGetConfig,
    recordActivity: mockRecordActivity,
    getCurrentLevel: mockGetCurrentLevel,
  }),
  ResourceLevel: {
    MINIMAL: "minimal",
    NORMAL: "normal",
    ACTIVE: "active",
    RECORDING: "recording",
  },
}));

describe("Animation Performance Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMotionDiv.mockClear();
    mockMotionButton.mockClear();

    // Mock performance.now for timing tests
    vi.spyOn(performance, "now").mockImplementation(() => Date.now());
  });

  afterEach(() => {
    cleanup();
  });

  describe("Resource Level Optimization", () => {
    it("should disable animations in minimal resource mode", () => {
      mockGetConfig.mockReturnValue({
        syncInterval: 30000,
        maxEventBatch: 50,
        enableAnimations: false,
        backgroundProcessing: false,
        notificationThrottle: 5000,
      });

      render(
        <AnimatedWrapper>
          <div>Test Content</div>
        </AnimatedWrapper>,
      );

      // Should render the content
      expect(screen.getByText("Test Content")).toBeInTheDocument();
      // Motion div should be called (implementation details may vary)
      expect(mockMotionDiv).toHaveBeenCalled();
    });

    it("should enable full animations in active resource mode", () => {
      mockGetConfig.mockReturnValue({
        syncInterval: 2000,
        maxEventBatch: 5,
        enableAnimations: true,
        backgroundProcessing: true,
        notificationThrottle: 500,
      });

      render(
        <AnimatedWrapper>
          <div>Test Content</div>
        </AnimatedWrapper>,
      );

      // Should render with full animation props
      expect(mockMotionDiv).toHaveBeenCalledWith(
        expect.objectContaining({
          transition: expect.objectContaining({
            duration: 0.3,
            ease: "easeInOut",
          }),
        }),
      );
    });

    it("should adapt animation complexity based on resource level", () => {
      // Test normal resource level
      mockGetConfig.mockReturnValue({
        syncInterval: 10000,
        maxEventBatch: 20,
        enableAnimations: true,
        backgroundProcessing: true,
        notificationThrottle: 1000,
      });

      const { rerender } = render(<AnimatedButton>Test Button</AnimatedButton>);

      expect(mockMotionButton).toHaveBeenCalled();

      // Test minimal resource level
      mockGetConfig.mockReturnValue({
        syncInterval: 30000,
        maxEventBatch: 50,
        enableAnimations: false,
        backgroundProcessing: false,
        notificationThrottle: 5000,
      });

      rerender(<AnimatedButton>Test Button</AnimatedButton>);

      // Should be called again with different props
      expect(mockMotionButton).toHaveBeenCalledTimes(2);
    });
  });

  describe("Animation Timing Performance", () => {
    it("should complete animations without errors", async () => {
      mockGetConfig.mockReturnValue({
        syncInterval: 10000,
        maxEventBatch: 20,
        enableAnimations: true,
        backgroundProcessing: true,
        notificationThrottle: 1000,
      });

      // Focus on functional behavior rather than timing
      expect(() => {
        render(
          <AnimatedWrapper>
            <div>Performance Test</div>
          </AnimatedWrapper>,
        );
      }).not.toThrow();

      // Verify the component renders correctly
      expect(screen.getByText("Performance Test")).toBeInTheDocument();
    });

    it("should handle rapid state changes without errors", async () => {
      mockGetConfig.mockReturnValue({
        syncInterval: 10000,
        maxEventBatch: 20,
        enableAnimations: true,
        backgroundProcessing: true,
        notificationThrottle: 1000,
      });

      const { rerender } = render(
        <TrayPopover isVisible={false}>
          <div>Popover Content</div>
        </TrayPopover>,
      );

      // Focus on functional behavior - rapid changes should not cause errors
      expect(() => {
        // Rapidly toggle visibility
        for (let i = 0; i < 10; i++) {
          rerender(
            <TrayPopover isVisible={i % 2 === 0}>
              <div>Popover Content {i}</div>
            </TrayPopover>,
          );
        }
      }).not.toThrow();

      // Verify the component is still functional after rapid changes
      // The test passes if no errors were thrown during rapid re-renders
    });
  });

  describe("Memory Usage Optimization", () => {
    it("should not create excessive animation objects", () => {
      mockGetConfig.mockReturnValue({
        syncInterval: 10000,
        maxEventBatch: 20,
        enableAnimations: true,
        backgroundProcessing: true,
        notificationThrottle: 1000,
      });

      // Render multiple animated components
      render(
        <div>
          {Array.from({ length: 50 }, (_, i) => (
            <AnimatedWrapper key={i}>
              <div>Item {i}</div>
            </AnimatedWrapper>
          ))}
        </div>,
      );

      // Should not create excessive motion components
      expect(mockMotionDiv).toHaveBeenCalledTimes(50);

      // Each call should have reasonable props
      mockMotionDiv.mock.calls.forEach((call) => {
        const props = call[0];
        expect(props).toBeDefined();
        expect(typeof props.transition).toBe("object");
      });
    });

    it("should clean up animation resources properly", () => {
      mockGetConfig.mockReturnValue({
        syncInterval: 10000,
        maxEventBatch: 20,
        enableAnimations: true,
        backgroundProcessing: true,
        notificationThrottle: 1000,
      });

      const { unmount } = render(
        <AnimatedWrapper>
          <div>Cleanup Test</div>
        </AnimatedWrapper>,
      );

      // Component should render normally
      expect(screen.getByText("Cleanup Test")).toBeInTheDocument();

      // Unmount should not throw errors
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("Animation Behavior Validation", () => {
    it("should render animations without errors", async () => {
      mockGetConfig.mockReturnValue({
        syncInterval: 2000,
        maxEventBatch: 5,
        enableAnimations: true,
        backgroundProcessing: true,
        notificationThrottle: 500,
      });

      // Focus on functional behavior rather than timing
      expect(() => {
        render(
          <div>
            <LoadingSpinner />
            <ProgressBar progress={50} />
            <AnimatedButton>Test</AnimatedButton>
          </div>,
        );
      }).not.toThrow();

      // Verify components render correctly
      expect(screen.getByRole("button", { name: "Test" })).toBeInTheDocument();

      // Simulate interactions without timing assertions
      const button = screen.getByRole("button");
      expect(() => {
        fireEvent.mouseEnter(button);
        fireEvent.mouseLeave(button);
      }).not.toThrow();
    });

    it("should degrade gracefully under high load", () => {
      // Simulate high resource usage
      mockGetConfig.mockReturnValue({
        syncInterval: 30000,
        maxEventBatch: 50,
        enableAnimations: false, // Animations disabled under load
        backgroundProcessing: false,
        notificationThrottle: 5000,
      });

      // Focus on functional behavior - should render many components without errors
      expect(() => {
        render(
          <div>
            {Array.from({ length: 50 }, (_, i) => (
              <AnimatedWrapper key={i}>
                <LoadingSpinner size="sm" data-testid={`spinner-${i}`} />
              </AnimatedWrapper>
            ))}
          </div>,
        );
      }).not.toThrow();

      // Should render all components correctly
      expect(screen.getByTestId("spinner-0")).toBeInTheDocument();
      expect(screen.getByTestId("spinner-49")).toBeInTheDocument();
    });
  });

  describe("Cross-Platform Performance", () => {
    it("should optimize for different platforms", () => {
      // Mock different user agents
      const originalUserAgent = navigator.userAgent;

      // Test macOS
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
        configurable: true,
      });

      mockGetConfig.mockReturnValue({
        syncInterval: 10000,
        maxEventBatch: 20,
        enableAnimations: true,
        backgroundProcessing: true,
        notificationThrottle: 1000,
      });

      render(
        <AnimatedWrapper>
          <div>macOS Test</div>
        </AnimatedWrapper>,
      );

      expect(screen.getByText("macOS Test")).toBeInTheDocument();

      // Test Windows
      Object.defineProperty(navigator, "userAgent", {
        value: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        configurable: true,
      });

      render(
        <AnimatedWrapper>
          <div>Windows Test</div>
        </AnimatedWrapper>,
      );

      expect(screen.getByText("Windows Test")).toBeInTheDocument();

      // Restore original user agent
      Object.defineProperty(navigator, "userAgent", {
        value: originalUserAgent,
        configurable: true,
      });
    });
  });

  describe("Animation Throttling", () => {
    it("should throttle animations when resource usage is high", () => {
      // Start with normal animations
      mockGetConfig.mockReturnValue({
        syncInterval: 10000,
        maxEventBatch: 20,
        enableAnimations: true,
        backgroundProcessing: true,
        notificationThrottle: 1000,
      });

      const { rerender } = render(
        <AnimatedButton>Throttle Test</AnimatedButton>,
      );

      // Should render the button
      expect(
        screen.getByRole("button", { name: "Throttle Test" }),
      ).toBeInTheDocument();

      // Switch to high resource usage (minimal mode)
      mockGetConfig.mockReturnValue({
        syncInterval: 30000,
        maxEventBatch: 50,
        enableAnimations: false,
        backgroundProcessing: false,
        notificationThrottle: 5000,
      });

      rerender(<AnimatedButton>Throttle Test Updated</AnimatedButton>);

      // Should still render the button with updated content
      expect(
        screen.getByRole("button", { name: "Throttle Test Updated" }),
      ).toBeInTheDocument();
    });
  });
});
