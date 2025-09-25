import {
  motion,
  type TargetAndTransition,
  type Transition,
  type VariantLabels,
  type Variants,
} from "framer-motion";
import type React from "react";
import { useTrayResourceManager } from "../../../services/tray/TrayResourceManager";

/**
 * Animation variants for different tray components
 */
export const trayAnimationVariants = {
  // Popover show/hide animations
  popover: {
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
  } as Variants,

  // View transition animations
  slideLeft: {
    enter: {
      x: "100%",
      opacity: 0,
    },
    center: {
      x: 0,
      opacity: 1,
    },
    exit: {
      x: "-100%",
      opacity: 0,
    },
  } as Variants,

  slideRight: {
    enter: {
      x: "-100%",
      opacity: 0,
    },
    center: {
      x: 0,
      opacity: 1,
    },
    exit: {
      x: "100%",
      opacity: 0,
    },
  } as Variants,

  // Fade transitions for content
  fade: {
    hidden: {
      opacity: 0,
    },
    visible: {
      opacity: 1,
    },
    exit: {
      opacity: 0,
    },
  } as Variants,

  // Scale animations for buttons and cards
  scale: {
    rest: {
      scale: 1,
    },
    hover: {
      scale: 1.02,
    },
    tap: {
      scale: 0.98,
    },
  } as Variants,

  // Loading spinner animation
  spinner: {
    animate: {
      rotate: 360,
    },
  } as Variants,

  // Progress bar animation
  progress: {
    initial: {
      scaleX: 0,
      originX: 0,
    },
    animate: (progress: number) => ({
      scaleX: progress / 100,
      originX: 0,
    }),
  } as Variants,

  // Stagger animations for lists
  stagger: {
    hidden: {
      opacity: 0,
    },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  } as Variants,

  staggerItem: {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
    },
  } as Variants,
};

/**
 * Animation timing configurations based on performance level
 */
export const getAnimationConfig = (enableAnimations: boolean) => {
  if (!enableAnimations) {
    return {
      duration: 0,
      ease: "linear" as const,
      staggerDelay: 0,
    };
  }

  return {
    duration: 0.3,
    ease: "easeInOut" as const,
    staggerDelay: 0.1,
  };
};

/**
 * Enhanced motion wrapper that respects performance settings
 */
interface AnimatedWrapperProps {
  children: React.ReactNode;
  variants?: Variants;
  initial?: string | boolean | TargetAndTransition | VariantLabels;
  animate?: string | boolean | TargetAndTransition | VariantLabels;
  exit?: string | TargetAndTransition | VariantLabels;
  transition?: Transition;
  className?: string;
  custom?: any;
}

export function AnimatedWrapper({
  children,
  variants,
  initial = "hidden",
  animate = "visible",
  exit = "exit",
  transition,
  className = "",
  custom,
}: AnimatedWrapperProps) {
  const { getConfig } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };
  const animationConfig = getAnimationConfig(config.enableAnimations);

  const defaultTransition = {
    duration: animationConfig.duration,
    ease: animationConfig.ease,
    ...transition,
  };

  return (
    <motion.div
      variants={variants}
      initial={initial}
      animate={animate}
      exit={exit}
      transition={defaultTransition}
      className={className}
      custom={custom}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated button component with hover and tap effects
 */
interface AnimatedButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
}

export function AnimatedButton({
  children,
  onClick,
  disabled = false,
  className = "",
  variant = "primary",
}: AnimatedButtonProps) {
  const { getConfig } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };

  const baseClasses = "px-4 py-2 rounded-lg font-medium transition-colors";
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700",
    secondary:
      "bg-gray-200 text-gray-900 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600",
    ghost:
      "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800",
  };

  return (
    <motion.button
      type="button"
      variants={
        config.enableAnimations ? trayAnimationVariants.scale : undefined
      }
      initial="rest"
      whileHover={!disabled ? "hover" : undefined}
      whileTap={!disabled ? "tap" : undefined}
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
    >
      {children}
    </motion.button>
  );
}

/**
 * Animated card component with hover effects
 */
interface AnimatedCardProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  hoverable?: boolean;
}

export function AnimatedCard({
  children,
  onClick,
  className = "",
  hoverable = true,
}: AnimatedCardProps) {
  const { getConfig } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };

  return (
    <motion.div
      variants={
        config.enableAnimations && hoverable
          ? trayAnimationVariants.scale
          : undefined
      }
      initial="rest"
      whileHover={hoverable ? "hover" : undefined}
      whileTap={onClick ? "tap" : undefined}
      onClick={onClick}
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated list component with stagger effects
 */
interface AnimatedListProps {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedList({ children, className = "" }: AnimatedListProps) {
  const { getConfig } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };

  return (
    <motion.div
      variants={
        config.enableAnimations ? trayAnimationVariants.stagger : undefined
      }
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Animated list item component
 */
interface AnimatedListItemProps {
  children: React.ReactNode;
  className?: string;
}

export function AnimatedListItem({
  children,
  className = "",
}: AnimatedListItemProps) {
  const { getConfig } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };

  return (
    <motion.div
      variants={
        config.enableAnimations ? trayAnimationVariants.staggerItem : undefined
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}
