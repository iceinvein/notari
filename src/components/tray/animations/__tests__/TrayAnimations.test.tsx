import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AnimatedButton,
  AnimatedCard,
  AnimatedList,
  AnimatedListItem,
  AnimatedWrapper,
  getAnimationConfig,
  trayAnimationVariants,
} from "../TrayAnimations";

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
      button: ({ children, ...props }: any) => {
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
        return <button {...domProps}>{children}</button>;
      },
      ul: MotionComponent,
      li: MotionComponent,
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
    recordActivity: vi.fn(),
  }),
}));

describe("TrayAnimations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("Animation Variants", () => {
    it("should have correct popover animation variants", () => {
      expect(trayAnimationVariants.popover).toEqual({
        hidden: {
          opacity: 0,
          scale: 0.95,
          y: -10,
        },
        visible: {
          opacity: 1,
          scale: 1,
          y: 0,
        },
        exit: {
          opacity: 0,
          scale: 0.95,
          y: -10,
        },
      });
    });

    it("should have correct slide animation variants", () => {
      expect(trayAnimationVariants.slideLeft.enter).toEqual({
        x: "100%",
        opacity: 0,
      });
      expect(trayAnimationVariants.slideLeft.center).toEqual({
        x: 0,
        opacity: 1,
      });
      expect(trayAnimationVariants.slideLeft.exit).toEqual({
        x: "-100%",
        opacity: 0,
      });
    });

    it("should have correct scale animation variants", () => {
      expect(trayAnimationVariants.scale).toEqual({
        rest: { scale: 1 },
        hover: { scale: 1.02 },
        tap: { scale: 0.98 },
      });
    });
  });

  describe("getAnimationConfig", () => {
    it("should return animation config when animations enabled", () => {
      const config = getAnimationConfig(true);
      expect(config).toEqual({
        duration: 0.3,
        ease: "easeInOut",
        staggerDelay: 0.1,
      });
    });

    it("should return disabled config when animations disabled", () => {
      const config = getAnimationConfig(false);
      expect(config).toEqual({
        duration: 0,
        ease: "linear",
        staggerDelay: 0,
      });
    });
  });

  describe("AnimatedWrapper", () => {
    it("should render children correctly", () => {
      render(
        <AnimatedWrapper>
          <div>Test Content</div>
        </AnimatedWrapper>,
      );

      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      render(
        <AnimatedWrapper className="custom-class">
          <div>Test Content</div>
        </AnimatedWrapper>,
      );

      const wrapper = screen.getByText("Test Content").parentElement;
      expect(wrapper).toHaveClass("custom-class");
    });

    it("should handle custom variants", () => {
      const customVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
      };

      render(
        <AnimatedWrapper variants={customVariants}>
          <div>Test Content</div>
        </AnimatedWrapper>,
      );

      expect(screen.getByText("Test Content")).toBeInTheDocument();
    });
  });

  describe("AnimatedButton", () => {
    it("should render button with children", () => {
      render(<AnimatedButton>Click me</AnimatedButton>);

      expect(
        screen.getByRole("button", { name: "Click me" }),
      ).toBeInTheDocument();
    });

    it("should handle click events", () => {
      const handleClick = vi.fn();
      render(<AnimatedButton onClick={handleClick}>Click me</AnimatedButton>);

      fireEvent.click(screen.getByRole("button"));
      expect(handleClick).toHaveBeenCalledOnce();
    });

    it("should be disabled when disabled prop is true", () => {
      render(<AnimatedButton disabled>Click me</AnimatedButton>);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toHaveClass("opacity-50", "cursor-not-allowed");
    });

    it("should apply variant classes correctly", () => {
      const { rerender } = render(
        <AnimatedButton variant="primary">Primary Button</AnimatedButton>,
      );

      let button = screen.getByRole("button");
      expect(button).toHaveClass("bg-blue-600", "text-white");

      rerender(
        <AnimatedButton variant="secondary">Secondary Button</AnimatedButton>,
      );

      button = screen.getByRole("button");
      expect(button).toHaveClass("bg-gray-200", "text-gray-900");

      rerender(<AnimatedButton variant="ghost">Ghost Button</AnimatedButton>);

      button = screen.getByRole("button");
      expect(button).toHaveClass("text-gray-600");
    });
  });

  describe("AnimatedCard", () => {
    it("should render children correctly", () => {
      render(
        <AnimatedCard>
          <div>Card Content</div>
        </AnimatedCard>,
      );

      expect(screen.getByText("Card Content")).toBeInTheDocument();
    });

    it("should handle click events when onClick is provided", () => {
      const handleClick = vi.fn();
      render(
        <AnimatedCard onClick={handleClick}>
          <div>Clickable Card</div>
        </AnimatedCard>,
      );

      fireEvent.click(screen.getByText("Clickable Card").parentElement!);
      expect(handleClick).toHaveBeenCalledOnce();
    });

    it("should apply cursor-pointer class when onClick is provided", () => {
      render(
        <AnimatedCard onClick={() => {}}>
          <div>Clickable Card</div>
        </AnimatedCard>,
      );

      const card = screen.getByText("Clickable Card").parentElement;
      expect(card).toHaveClass("cursor-pointer");
    });

    it("should not apply cursor-pointer class when onClick is not provided", () => {
      render(
        <AnimatedCard>
          <div>Non-clickable Card</div>
        </AnimatedCard>,
      );

      const card = screen.getByText("Non-clickable Card").parentElement;
      expect(card).not.toHaveClass("cursor-pointer");
    });
  });

  describe("AnimatedList", () => {
    it("should render children correctly", () => {
      render(
        <AnimatedList>
          <div>List Item 1</div>
          <div>List Item 2</div>
        </AnimatedList>,
      );

      expect(screen.getByText("List Item 1")).toBeInTheDocument();
      expect(screen.getByText("List Item 2")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      render(
        <AnimatedList className="custom-list">
          <div>List Item</div>
        </AnimatedList>,
      );

      const list = screen.getByText("List Item").parentElement;
      expect(list).toHaveClass("custom-list");
    });
  });

  describe("AnimatedListItem", () => {
    it("should render children correctly", () => {
      render(
        <AnimatedListItem>
          <div>List Item Content</div>
        </AnimatedListItem>,
      );

      expect(screen.getByText("List Item Content")).toBeInTheDocument();
    });

    it("should apply custom className", () => {
      render(
        <AnimatedListItem className="custom-item">
          <div>List Item Content</div>
        </AnimatedListItem>,
      );

      const item = screen.getByText("List Item Content").parentElement;
      expect(item).toHaveClass("custom-item");
    });
  });

  describe("Performance Considerations", () => {
    it("should respect animation settings from resource manager", () => {
      render(<AnimatedButton>Test Button</AnimatedButton>);

      expect(screen.getByRole("button")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should maintain proper button semantics", () => {
      render(<AnimatedButton>Accessible Button</AnimatedButton>);

      const button = screen.getByRole("button", { name: "Accessible Button" });
      expect(button).toHaveAttribute("type", "button");
    });

    it("should support disabled state properly", () => {
      render(<AnimatedButton disabled>Disabled Button</AnimatedButton>);

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("disabled");
    });
  });
});
