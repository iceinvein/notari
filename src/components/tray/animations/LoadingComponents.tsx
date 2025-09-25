import { motion } from "framer-motion";
import type React from "react";
import { useTrayResourceManager } from "../../../services/tray/TrayResourceManager";
import { getAnimationConfig } from "./TrayAnimations";

/**
 * Enhanced loading spinner with smooth animations
 */
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: "primary" | "secondary" | "success" | "warning" | "danger";
  className?: string;
  "data-testid"?: string;
}

export function LoadingSpinner({
  size = "md",
  color = "primary",
  className = "",
  "data-testid": dataTestId,
}: LoadingSpinnerProps) {
  const { getConfig } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };

  const sizeClasses = {
    sm: "w-4 h-4 border-2",
    md: "w-6 h-6 border-2",
    lg: "w-8 h-8 border-3",
  };

  const colorClasses = {
    primary: "border-blue-600 border-t-transparent",
    secondary: "border-gray-600 border-t-transparent",
    success: "border-green-600 border-t-transparent",
    warning: "border-yellow-600 border-t-transparent",
    danger: "border-red-600 border-t-transparent",
  };

  return (
    <motion.div
      className={`rounded-full ${sizeClasses[size]} ${colorClasses[color]} ${className}`}
      animate={config.enableAnimations ? { rotate: 360 } : undefined}
      transition={
        config.enableAnimations
          ? {
              duration: 1,
              repeat: Number.POSITIVE_INFINITY,
              ease: "linear",
            }
          : undefined
      }
      data-testid={dataTestId}
    />
  );
}

/**
 * Loading skeleton component with shimmer effect
 */
interface LoadingSkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  rounded?: boolean;
  "data-testid"?: string;
}

export function LoadingSkeleton({
  width = "100%",
  height = "1rem",
  className = "",
  rounded = false,
  "data-testid": dataTestId,
}: LoadingSkeletonProps) {
  const { getConfig } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };

  const style = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
  };

  return (
    <motion.div
      className={`bg-gray-200 dark:bg-gray-700 ${rounded ? "rounded-full" : "rounded"} ${className}`}
      style={style}
      animate={
        config.enableAnimations
          ? {
              opacity: [0.5, 1, 0.5],
            }
          : undefined
      }
      transition={
        config.enableAnimations
          ? {
              duration: 1.5,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
            }
          : undefined
      }
      data-testid={dataTestId}
    />
  );
}

/**
 * Progress bar component with smooth animations
 */
interface ProgressBarProps {
  progress: number; // 0-100
  color?: "primary" | "secondary" | "success" | "warning" | "danger";
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  label?: string;
  className?: string;
  "data-testid"?: string;
}

export function ProgressBar({
  progress,
  color = "primary",
  size = "md",
  showLabel = false,
  label,
  className = "",
  "data-testid": dataTestId,
}: ProgressBarProps) {
  const { getConfig } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };
  const animationConfig = getAnimationConfig(config.enableAnimations);

  const sizeClasses = {
    sm: "h-1",
    md: "h-2",
    lg: "h-3",
  };

  const colorClasses = {
    primary: "bg-blue-600",
    secondary: "bg-gray-600",
    success: "bg-green-600",
    warning: "bg-yellow-600",
    danger: "bg-red-600",
  };

  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <div className={`space-y-1 ${className}`} data-testid={dataTestId}>
      {(showLabel || label) && (
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-600 dark:text-gray-400">
            {label || "Progress"}
          </span>
          <span className="text-gray-600 dark:text-gray-400">
            {Math.round(clampedProgress)}%
          </span>
        </div>
      )}
      <div
        className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full ${sizeClasses[size]}`}
      >
        <motion.div
          className={`${sizeClasses[size]} rounded-full ${colorClasses[color]}`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedProgress}%` }}
          transition={{
            duration: animationConfig.duration,
            ease: animationConfig.ease,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Loading dots component with stagger animation
 */
interface LoadingDotsProps {
  size?: "sm" | "md" | "lg";
  color?: "primary" | "secondary" | "success" | "warning" | "danger";
  className?: string;
  "data-testid"?: string;
}

export function LoadingDots({
  size = "md",
  color = "primary",
  className = "",
  "data-testid": dataTestId,
}: LoadingDotsProps) {
  const { getConfig } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };

  const sizeClasses = {
    sm: "w-1 h-1",
    md: "w-2 h-2",
    lg: "w-3 h-3",
  };

  const colorClasses = {
    primary: "bg-blue-600",
    secondary: "bg-gray-600",
    success: "bg-green-600",
    warning: "bg-yellow-600",
    danger: "bg-red-600",
  };

  const dotVariants = {
    initial: { opacity: 0.3 },
    animate: { opacity: 1 },
  };

  const containerVariants = {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.2,
        repeat: Number.POSITIVE_INFINITY,
        repeatType: "reverse" as const,
      },
    },
  };

  return (
    <motion.div
      className={`flex space-x-1 ${className}`}
      variants={config.enableAnimations ? containerVariants : undefined}
      initial="initial"
      animate="animate"
      data-testid={dataTestId}
    >
      {[0, 1, 2].map((index) => (
        <motion.div
          key={index}
          className={`rounded-full ${sizeClasses[size]} ${colorClasses[color]}`}
          variants={config.enableAnimations ? dotVariants : undefined}
          transition={{
            duration: 0.6,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>
  );
}

/**
 * Loading card component with skeleton content
 */
interface LoadingCardProps {
  lines?: number;
  showAvatar?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function LoadingCard({
  lines = 3,
  showAvatar = false,
  className = "",
  "data-testid": dataTestId,
}: LoadingCardProps) {
  return (
    <div
      className={`p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 ${className}`}
      data-testid={dataTestId}
    >
      <div className="flex items-start space-x-3">
        {showAvatar && (
          <LoadingSkeleton
            width={40}
            height={40}
            rounded
            className="flex-shrink-0"
          />
        )}
        <div className="flex-1 space-y-2">
          {Array.from({ length: lines }).map((_, index) => (
            <LoadingSkeleton
              key={index}
              height={16}
              width={index === lines - 1 ? "60%" : "100%"}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Loading state wrapper component
 */
interface LoadingStateProps {
  isLoading: boolean;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export function LoadingState({
  isLoading,
  children,
  fallback,
  className = "",
}: LoadingStateProps) {
  const { getConfig } = useTrayResourceManager();
  const config = getConfig() || { enableAnimations: true };

  const defaultFallback = (
    <div className="flex flex-col items-center justify-center p-8 space-y-3">
      <LoadingSpinner size="lg" />
      <p className="text-sm text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  );

  return (
    <motion.div
      className={className}
      initial={false}
      animate={{ opacity: 1 }}
      transition={{
        duration: config.enableAnimations ? 0.2 : 0,
      }}
    >
      {isLoading ? fallback || defaultFallback : children}
    </motion.div>
  );
}

/**
 * Async operation progress component
 */
interface AsyncProgressProps {
  isLoading: boolean;
  progress?: number;
  status?: string;
  error?: string | null;
  onRetry?: () => void;
  className?: string;
}

export function AsyncProgress({
  isLoading,
  progress,
  status = "Loading...",
  error,
  onRetry,
  className = "",
}: AsyncProgressProps) {
  if (error) {
    return (
      <motion.div
        className={`p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg ${className}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center space-x-2 text-red-600 dark:text-red-400">
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">Error</span>
        </div>
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-2 px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        )}
      </motion.div>
    );
  }

  if (!isLoading) {
    return null;
  }

  return (
    <motion.div
      className={`p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center space-x-3">
        <LoadingSpinner size="sm" color="primary" />
        <div className="flex-1">
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            {status}
          </p>
          {typeof progress === "number" && (
            <ProgressBar
              progress={progress}
              color="primary"
              size="sm"
              className="mt-2"
            />
          )}
        </div>
      </div>
    </motion.div>
  );
}
