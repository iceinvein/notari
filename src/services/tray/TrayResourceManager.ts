import { invoke } from "@tauri-apps/api/core";
import { useTrayStore } from "../../stores/trayStore";

/**
 * Resource usage levels for different tray states
 */
export enum ResourceLevel {
  MINIMAL = "minimal", // Popover hidden, minimal updates
  NORMAL = "normal", // Popover visible, normal updates
  ACTIVE = "active", // User actively interacting
  RECORDING = "recording", // Session recording active
}

/**
 * Configuration for different resource levels
 */
interface ResourceConfig {
  syncInterval: number; // Milliseconds between syncs
  maxEventBatch: number; // Maximum events to batch
  enableAnimations: boolean; // Whether to enable UI animations
  backgroundProcessing: boolean; // Whether to run background processing
  notificationThrottle: number; // Milliseconds between notifications
}

const RESOURCE_CONFIGS: Record<ResourceLevel, ResourceConfig> = {
  [ResourceLevel.MINIMAL]: {
    syncInterval: 30000, // 30 seconds
    maxEventBatch: 50, // Batch more events
    enableAnimations: false, // Disable animations
    backgroundProcessing: false, // Minimal background work
    notificationThrottle: 5000, // 5 second throttle
  },
  [ResourceLevel.NORMAL]: {
    syncInterval: 10000, // 10 seconds
    maxEventBatch: 20, // Moderate batching
    enableAnimations: true, // Enable animations
    backgroundProcessing: true, // Normal background work
    notificationThrottle: 1000, // 1 second throttle
  },
  [ResourceLevel.ACTIVE]: {
    syncInterval: 2000, // 2 seconds
    maxEventBatch: 5, // Minimal batching
    enableAnimations: true, // Full animations
    backgroundProcessing: true, // Full background work
    notificationThrottle: 500, // 500ms throttle
  },
  [ResourceLevel.RECORDING]: {
    syncInterval: 1000, // 1 second
    maxEventBatch: 1, // No batching
    enableAnimations: true, // Full animations
    backgroundProcessing: true, // Full background work
    notificationThrottle: 100, // 100ms throttle
  },
};

/**
 * Manages resource usage based on tray state
 */
export class TrayResourceManager {
  private currentLevel: ResourceLevel = ResourceLevel.MINIMAL;
  private config: ResourceConfig = RESOURCE_CONFIGS[ResourceLevel.MINIMAL];
  private activityTimeout: number | null = null;
  private lastActivity: number = 0;
  private isInitialized = false;

  /**
   * Initialize the resource manager
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Subscribe to tray store changes
    this.setupStoreSubscriptions();

    // Set initial resource level
    await this.updateResourceLevel();

    this.isInitialized = true;
  }

  /**
   * Clean up resources
   */
  cleanup(): void {
    if (this.activityTimeout) {
      window.clearTimeout(this.activityTimeout);
      this.activityTimeout = null;
    }
    this.isInitialized = false;
  }

  /**
   * Get current resource configuration
   */
  getConfig(): ResourceConfig {
    return { ...this.config };
  }

  /**
   * Get current resource level
   */
  getCurrentLevel(): ResourceLevel {
    return this.currentLevel;
  }

  /**
   * Record user activity to adjust resource usage
   */
  recordActivity(): void {
    this.lastActivity = Date.now();

    // Clear existing timeout
    if (this.activityTimeout) {
      window.clearTimeout(this.activityTimeout);
    }

    // Set resource level to active
    this.setResourceLevel(ResourceLevel.ACTIVE);

    // Schedule return to normal level after inactivity
    this.activityTimeout = window.setTimeout(() => {
      this.updateResourceLevel();
    }, 5000); // 5 seconds of inactivity
  }

  /**
   * Set resource level explicitly
   */
  private async setResourceLevel(level: ResourceLevel): Promise<void> {
    if (this.currentLevel === level) {
      return;
    }

    const previousLevel = this.currentLevel;
    this.currentLevel = level;
    this.config = RESOURCE_CONFIGS[level];

    console.log(`Resource level changed: ${previousLevel} -> ${level}`);

    // Notify backend of resource level change
    try {
      await invoke("set_tray_resource_level", {
        level: level,
        config: this.config,
      });
    } catch (error) {
      console.error("Failed to update backend resource level:", error);
    }

    // Apply frontend optimizations
    this.applyFrontendOptimizations();
  }

  /**
   * Update resource level based on current tray state
   */
  private async updateResourceLevel(): Promise<void> {
    const state = useTrayStore.getState();
    let targetLevel: ResourceLevel;

    // Determine appropriate resource level
    if (state.session.isRecording) {
      targetLevel = ResourceLevel.RECORDING;
    } else if (state.popover.isVisible) {
      // Check for recent activity
      const timeSinceActivity = Date.now() - this.lastActivity;
      if (timeSinceActivity < 5000) {
        targetLevel = ResourceLevel.ACTIVE;
      } else {
        targetLevel = ResourceLevel.NORMAL;
      }
    } else {
      targetLevel = ResourceLevel.MINIMAL;
    }

    await this.setResourceLevel(targetLevel);
  }

  /**
   * Apply frontend-specific optimizations
   */
  private applyFrontendOptimizations(): void {
    const { enableAnimations } = this.config;

    // Update CSS custom properties for animations
    const root = document.documentElement;
    if (enableAnimations) {
      root.style.setProperty("--tray-animation-duration", "300ms");
      root.style.setProperty("--tray-animation-enabled", "1");
    } else {
      root.style.setProperty("--tray-animation-duration", "0ms");
      root.style.setProperty("--tray-animation-enabled", "0");
    }

    // Note: Animation preferences are handled via CSS custom properties
    // The tray store preferences don't include enableAnimations
  }

  /**
   * Setup subscriptions to tray store changes
   */
  private setupStoreSubscriptions(): void {
    // Subscribe to popover visibility changes
    useTrayStore.subscribe(
      (state) => state.popover.isVisible,
      (isVisible) => {
        if (isVisible) {
          this.recordActivity();
        } else {
          // Delay resource level update to allow for quick re-opening
          setTimeout(() => {
            this.updateResourceLevel();
          }, 1000);
        }
      },
    );

    // Subscribe to recording state changes
    useTrayStore.subscribe(
      (state) => state.session.isRecording,
      () => {
        this.updateResourceLevel();
      },
    );

    // Subscribe to navigation changes (indicates user activity)
    useTrayStore.subscribe(
      (state) => state.navigation.currentView,
      () => {
        this.recordActivity();
      },
    );
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<{
    memoryUsage: number;
    cpuUsage: number;
    resourceLevel: ResourceLevel;
    lastActivity: number;
  }> {
    try {
      const metrics = await invoke<{
        memoryUsage: number;
        cpuUsage: number;
      }>("get_tray_performance_metrics");

      return {
        ...metrics,
        resourceLevel: this.currentLevel,
        lastActivity: this.lastActivity,
      };
    } catch (error) {
      console.error("Failed to get performance metrics:", error);
      return {
        memoryUsage: 0,
        cpuUsage: 0,
        resourceLevel: this.currentLevel,
        lastActivity: this.lastActivity,
      };
    }
  }

  /**
   * Force garbage collection (if available)
   */
  async forceGarbageCollection(): Promise<void> {
    try {
      // Force garbage collection in backend
      await invoke("force_garbage_collection");

      // Force garbage collection in frontend (if available)
      if (window.gc) {
        window.gc();
      }
    } catch (error) {
      console.error("Failed to force garbage collection:", error);
    }
  }

  /**
   * Get resource usage recommendations
   */
  getResourceRecommendations(): {
    level: ResourceLevel;
    reason: string;
    suggestions: string[];
  } {
    const state = useTrayStore.getState();
    const timeSinceActivity = Date.now() - this.lastActivity;
    const suggestions: string[] = [];

    let recommendedLevel = this.currentLevel;
    let reason = "Current level is appropriate";

    // Analyze current state and provide recommendations
    if (
      state.session.isRecording &&
      this.currentLevel !== ResourceLevel.RECORDING
    ) {
      recommendedLevel = ResourceLevel.RECORDING;
      reason = "Recording session requires maximum resources";
      suggestions.push("Enable real-time sync for recording data");
    } else if (
      !state.popover.isVisible &&
      this.currentLevel !== ResourceLevel.MINIMAL
    ) {
      recommendedLevel = ResourceLevel.MINIMAL;
      reason = "Popover is hidden, can reduce resource usage";
      suggestions.push("Disable animations to save CPU");
      suggestions.push("Reduce sync frequency");
    } else if (state.popover.isVisible && timeSinceActivity > 10000) {
      recommendedLevel = ResourceLevel.NORMAL;
      reason = "User inactive but popover visible";
      suggestions.push("Reduce update frequency");
    }

    // Add general suggestions based on current level
    if (this.currentLevel === ResourceLevel.MINIMAL) {
      suggestions.push("Consider lazy loading components");
      suggestions.push("Batch state updates");
    }

    return {
      level: recommendedLevel,
      reason,
      suggestions,
    };
  }
}

// Singleton instance
export const trayResourceManager = new TrayResourceManager();

// Hook for using resource manager in components
export function useTrayResourceManager() {
  const recordActivity = () => trayResourceManager.recordActivity();
  const getConfig = () => trayResourceManager.getConfig();
  const getCurrentLevel = () => trayResourceManager.getCurrentLevel();

  return {
    recordActivity,
    getConfig,
    getCurrentLevel,
    getMetrics: () => trayResourceManager.getPerformanceMetrics(),
    forceGC: () => trayResourceManager.forceGarbageCollection(),
    getRecommendations: () => trayResourceManager.getResourceRecommendations(),
  };
}

// Extend Window interface for garbage collection
declare global {
  interface Window {
    gc?: () => void;
  }
}
