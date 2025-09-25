import { AnimatePresence, motion } from "framer-motion";
import type React from "react";
import { useEffect, useRef } from "react";
import { useTrayResourceManager } from "../../../services/tray/TrayResourceManager";
import { getAnimationConfig, trayAnimationVariants } from "./TrayAnimations";

/**
 * Enhanced popover wrapper with smooth show/hide animations
 */
interface AnimatedPopoverProps {
  isVisible: boolean;
  children: React.ReactNode;
  onAnimationComplete?: (visible: boolean) => void;
  className?: string;
  position?: "top" | "bottom" | "left" | "right" | "center";
}

export function AnimatedPopover({
  isVisible,
  children,
  onAnimationComplete,
  className = "",
  position = "center",
}: AnimatedPopoverProps) {
  const { getConfig } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };
  const animationConfig = getAnimationConfig(config.enableAnimations);

  // Position-specific animation variants
  const positionVariants = {
    top: {
      hidden: { opacity: 0, scale: 0.95, y: -20 },
      visible: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 0.95, y: -20 },
    },
    bottom: {
      hidden: { opacity: 0, scale: 0.95, y: 20 },
      visible: { opacity: 1, scale: 1, y: 0 },
      exit: { opacity: 0, scale: 0.95, y: 20 },
    },
    left: {
      hidden: { opacity: 0, scale: 0.95, x: -20 },
      visible: { opacity: 1, scale: 1, x: 0 },
      exit: { opacity: 0, scale: 0.95, x: -20 },
    },
    right: {
      hidden: { opacity: 0, scale: 0.95, x: 20 },
      visible: { opacity: 1, scale: 1, x: 0 },
      exit: { opacity: 0, scale: 0.95, x: 20 },
    },
    center: trayAnimationVariants.popover,
  };

  const variants = positionVariants[position];

  return (
    <AnimatePresence
      mode="wait"
      onExitComplete={() => onAnimationComplete?.(false)}
    >
      {isVisible && (
        <motion.div
          className={`fixed inset-0 z-50 ${className}`}
          initial="hidden"
          animate="visible"
          exit="exit"
          onAnimationComplete={() => onAnimationComplete?.(true)}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: animationConfig.duration * 0.8,
              ease: animationConfig.ease,
            }}
          />

          {/* Popover content */}
          <div className="flex items-center justify-center min-h-full p-4">
            <motion.div
              className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full max-h-[90vh] overflow-hidden"
              variants={variants}
              transition={{
                duration: animationConfig.duration,
                ease: animationConfig.ease,
              }}
            >
              {children}
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Tray-specific popover with optimized animations
 */
interface TrayPopoverProps {
  isVisible: boolean;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  width?: number;
  height?: number;
}

export function TrayPopover({
  isVisible,
  children,
  onClose,
  className = "",
  width = 400,
  height = 600,
}: TrayPopoverProps) {
  const { getConfig, recordActivity } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };
  const animationConfig = getAnimationConfig(config.enableAnimations);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onClose?.();
      }
    };

    if (isVisible) {
      document.addEventListener("mousedown", handleClickOutside);
      recordActivity();
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isVisible, onClose, recordActivity]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose?.();
      }
    };

    if (isVisible) {
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isVisible, onClose]);

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          className={`fixed inset-0 z-50 flex items-start justify-center pt-16 ${className}`}
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={trayAnimationVariants.fade}
          transition={{
            duration: animationConfig.duration,
            ease: animationConfig.ease,
          }}
        >
          <motion.div
            ref={popoverRef}
            className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
            style={{ width, height }}
            variants={trayAnimationVariants.popover}
            transition={{
              duration: animationConfig.duration,
              ease: animationConfig.ease,
              type: "spring",
              stiffness: 300,
              damping: 30,
            }}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Slide-in notification component
 */
interface SlideNotificationProps {
  isVisible: boolean;
  children: React.ReactNode;
  position?: "top" | "bottom";
  duration?: number;
  onClose?: () => void;
  className?: string;
}

export function SlideNotification({
  isVisible,
  children,
  position = "top",
  duration = 3000,
  onClose,
  className = "",
}: SlideNotificationProps) {
  const { getConfig } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };
  const animationConfig = getAnimationConfig(config.enableAnimations);

  const slideVariants = {
    top: {
      hidden: { opacity: 0, y: -100 },
      visible: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -100 },
    },
    bottom: {
      hidden: { opacity: 0, y: 100 },
      visible: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: 100 },
    },
  };

  // Auto-close after duration
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  return (
    <AnimatePresence mode="wait">
      {isVisible && (
        <motion.div
          className={`fixed ${position === "top" ? "top-4" : "bottom-4"} left-1/2 transform -translate-x-1/2 z-50 ${className}`}
          variants={slideVariants[position]}
          initial="hidden"
          animate="visible"
          exit="exit"
          transition={{
            duration: animationConfig.duration,
            ease: animationConfig.ease,
            type: "spring",
            stiffness: 400,
            damping: 25,
          }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 max-w-sm">
            {children}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Expandable content component with smooth height animation
 */
interface ExpandableContentProps {
  isExpanded: boolean;
  children: React.ReactNode;
  className?: string;
}

export function ExpandableContent({
  isExpanded,
  children,
  className = "",
}: ExpandableContentProps) {
  const { getConfig } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };
  const animationConfig = getAnimationConfig(config.enableAnimations);

  return (
    <motion.div
      className={`overflow-hidden ${className}`}
      initial={false}
      animate={{
        height: isExpanded ? "auto" : 0,
        opacity: isExpanded ? 1 : 0,
      }}
      transition={{
        duration: animationConfig.duration,
        ease: animationConfig.ease,
      }}
    >
      <div className="p-1">{children}</div>
    </motion.div>
  );
}

/**
 * Floating action button with ripple effect
 */
interface FloatingActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  size?: "sm" | "md" | "lg";
  color?: "primary" | "secondary" | "success" | "warning" | "danger";
}

export function FloatingActionButton({
  children,
  onClick,
  className = "",
  size = "md",
  color = "primary",
}: FloatingActionButtonProps) {
  const { getConfig } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };

  const sizeClasses = {
    sm: "w-10 h-10 text-sm",
    md: "w-12 h-12 text-base",
    lg: "w-14 h-14 text-lg",
  };

  const colorClasses = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-gray-600 hover:bg-gray-700 text-white",
    success: "bg-green-600 hover:bg-green-700 text-white",
    warning: "bg-yellow-600 hover:bg-yellow-700 text-white",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };

  return (
    <motion.button
      type="button"
      className={`fixed bottom-4 right-4 rounded-full shadow-lg flex items-center justify-center transition-colors ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      onClick={onClick}
      whileHover={config.enableAnimations ? { scale: 1.1 } : undefined}
      whileTap={config.enableAnimations ? { scale: 0.95 } : undefined}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      transition={{
        type: "spring",
        stiffness: 400,
        damping: 25,
      }}
    >
      {children}
    </motion.button>
  );
}
