import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTrayStore } from "../../../stores/trayStore";
import { ResourceLevel, TrayResourceManager } from "../TrayResourceManager";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock tray store
vi.mock("../../../stores/trayStore", () => ({
  useTrayStore: {
    getState: vi.fn(),
    subscribe: vi.fn(),
  },
}));

describe("TrayResourceManager", () => {
  let resourceManager: TrayResourceManager;
  let mockStore: any;

  beforeEach(() => {
    resourceManager = new TrayResourceManager();

    // Setup mock store
    mockStore = {
      popover: {
        isVisible: false,
        position: null,
        size: { width: 400, height: 600 },
      },
      session: { isRecording: false, currentSession: null, recentSessions: [] },
      navigation: { currentView: null },
      updatePreferences: vi.fn(),
    };

    (useTrayStore.getState as any).mockReturnValue(mockStore);
    (useTrayStore.subscribe as any).mockImplementation(
      (_selector: any, _callback: any) => {
        // Return unsubscribe function
        return () => {};
      },
    );

    // Mock DOM methods
    Object.defineProperty(document, "documentElement", {
      value: {
        style: {
          setProperty: vi.fn(),
        },
      },
      writable: true,
    });

    vi.useFakeTimers();
  });

  afterEach(() => {
    resourceManager.cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with minimal resource level", async () => {
      await resourceManager.initialize();

      expect(resourceManager.getCurrentLevel()).toBe(ResourceLevel.MINIMAL);
    });

    it("should setup store subscriptions on initialization", async () => {
      await resourceManager.initialize();

      expect(useTrayStore.subscribe).toHaveBeenCalledTimes(3);
    });

    it("should not initialize twice", async () => {
      await resourceManager.initialize();
      await resourceManager.initialize();

      // Should only setup subscriptions once
      expect(useTrayStore.subscribe).toHaveBeenCalledTimes(3);
    });
  });

  describe("Resource Level Management", () => {
    beforeEach(async () => {
      await resourceManager.initialize();
    });

    it("should set resource level to recording when session is active", async () => {
      mockStore.session.isRecording = true;

      // Trigger update by calling the method directly (simulating store change)
      await (resourceManager as any).updateResourceLevel();

      expect(resourceManager.getCurrentLevel()).toBe(ResourceLevel.RECORDING);
    });

    it("should set resource level to normal when popover is visible", async () => {
      mockStore.popover.isVisible = true;
      mockStore.session.isRecording = false;

      await (resourceManager as any).updateResourceLevel();

      expect(resourceManager.getCurrentLevel()).toBe(ResourceLevel.NORMAL);
    });

    it("should set resource level to active when user is active", async () => {
      mockStore.popover.isVisible = true;

      resourceManager.recordActivity();
      await (resourceManager as any).updateResourceLevel();

      expect(resourceManager.getCurrentLevel()).toBe(ResourceLevel.ACTIVE);
    });

    it("should return to normal level after inactivity", async () => {
      mockStore.popover.isVisible = true;

      resourceManager.recordActivity();
      await (resourceManager as any).updateResourceLevel();
      expect(resourceManager.getCurrentLevel()).toBe(ResourceLevel.ACTIVE);

      // Fast forward past activity timeout
      vi.advanceTimersByTime(6000);
      await (resourceManager as any).updateResourceLevel();

      expect(resourceManager.getCurrentLevel()).toBe(ResourceLevel.NORMAL);
    });

    it("should set resource level to minimal when popover is hidden", async () => {
      mockStore.popover.isVisible = false;
      mockStore.session.isRecording = false;

      await (resourceManager as any).updateResourceLevel();

      expect(resourceManager.getCurrentLevel()).toBe(ResourceLevel.MINIMAL);
    });
  });

  describe("Configuration Management", () => {
    beforeEach(async () => {
      await resourceManager.initialize();
    });

    it("should return correct configuration for minimal level", () => {
      const config = resourceManager.getConfig();

      expect(config.syncInterval).toBe(30000);
      expect(config.enableAnimations).toBe(false);
      expect(config.backgroundProcessing).toBe(false);
    });

    it("should update configuration when resource level changes", async () => {
      mockStore.session.isRecording = true;
      await (resourceManager as any).updateResourceLevel();

      const config = resourceManager.getConfig();

      expect(config.syncInterval).toBe(1000);
      expect(config.enableAnimations).toBe(true);
      expect(config.backgroundProcessing).toBe(true);
    });

    it("should apply frontend optimizations when level changes", async () => {
      const setPropertySpy = vi.spyOn(
        document.documentElement.style,
        "setProperty",
      );

      mockStore.session.isRecording = true;
      await (resourceManager as any).updateResourceLevel();

      expect(setPropertySpy).toHaveBeenCalledWith(
        "--tray-animation-duration",
        "300ms",
      );
      expect(setPropertySpy).toHaveBeenCalledWith(
        "--tray-animation-enabled",
        "1",
      );
      // Note: Animation preferences are handled via CSS custom properties, not store preferences
    });
  });

  describe("Activity Tracking", () => {
    beforeEach(async () => {
      await resourceManager.initialize();
    });

    it("should record activity and update resource level", () => {
      resourceManager.recordActivity();

      expect(resourceManager.getCurrentLevel()).toBe(ResourceLevel.ACTIVE);
    });

    it("should schedule return to normal level after activity timeout", () => {
      mockStore.popover.isVisible = true;

      resourceManager.recordActivity();
      expect(resourceManager.getCurrentLevel()).toBe(ResourceLevel.ACTIVE);

      // Fast forward past timeout
      vi.advanceTimersByTime(5000);

      // Should trigger updateResourceLevel
      expect(resourceManager.getCurrentLevel()).toBe(ResourceLevel.NORMAL);
    });

    it("should reset activity timeout on new activity", () => {
      resourceManager.recordActivity();

      // Advance time but not past timeout
      vi.advanceTimersByTime(3000);

      // Record new activity
      resourceManager.recordActivity();

      // Should still be active
      expect(resourceManager.getCurrentLevel()).toBe(ResourceLevel.ACTIVE);

      // Advance time again
      vi.advanceTimersByTime(3000);

      // Should still be active (timeout was reset)
      expect(resourceManager.getCurrentLevel()).toBe(ResourceLevel.ACTIVE);
    });
  });

  describe("Performance Metrics", () => {
    beforeEach(async () => {
      await resourceManager.initialize();
    });

    it("should return performance metrics", async () => {
      const mockMetrics = {
        memoryUsage: 50,
        cpuUsage: 10,
      };

      const { invoke } = await import("@tauri-apps/api/core");
      (invoke as any).mockResolvedValue(mockMetrics);

      const metrics = await resourceManager.getPerformanceMetrics();

      expect(metrics).toEqual({
        ...mockMetrics,
        resourceLevel: ResourceLevel.MINIMAL,
        lastActivity: expect.any(Number),
      });
    });

    it("should handle metrics error gracefully", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      (invoke as any).mockRejectedValue(new Error("Metrics error"));

      const metrics = await resourceManager.getPerformanceMetrics();

      expect(metrics).toEqual({
        memoryUsage: 0,
        cpuUsage: 0,
        resourceLevel: ResourceLevel.MINIMAL,
        lastActivity: expect.any(Number),
      });
    });
  });

  describe("Resource Recommendations", () => {
    beforeEach(async () => {
      await resourceManager.initialize();
    });

    it("should recommend recording level when session is active", () => {
      mockStore.session.isRecording = true;

      const recommendations = resourceManager.getResourceRecommendations();

      expect(recommendations.level).toBe(ResourceLevel.RECORDING);
      expect(recommendations.reason).toContain("Recording session");
      expect(recommendations.suggestions).toContain(
        "Enable real-time sync for recording data",
      );
    });

    it("should recommend minimal level when popover is hidden", async () => {
      // First set to a higher level
      mockStore.popover.isVisible = true;
      await (resourceManager as any).updateResourceLevel();

      // Then hide popover
      mockStore.popover.isVisible = false;

      const recommendations = resourceManager.getResourceRecommendations();

      expect(recommendations.level).toBe(ResourceLevel.MINIMAL);
      expect(recommendations.reason).toContain("Popover is hidden");
      expect(recommendations.suggestions).toContain(
        "Disable animations to save CPU",
      );
    });

    it("should recommend normal level for inactive but visible popover", () => {
      mockStore.popover.isVisible = true;

      // Set last activity to be old
      (resourceManager as any).lastActivity = Date.now() - 15000;

      const recommendations = resourceManager.getResourceRecommendations();

      expect(recommendations.level).toBe(ResourceLevel.NORMAL);
      expect(recommendations.reason).toContain(
        "User inactive but popover visible",
      );
    });

    it("should provide general suggestions for minimal level", () => {
      const recommendations = resourceManager.getResourceRecommendations();

      expect(recommendations.suggestions).toContain(
        "Consider lazy loading components",
      );
      expect(recommendations.suggestions).toContain("Batch state updates");
    });
  });

  describe("Garbage Collection", () => {
    beforeEach(async () => {
      await resourceManager.initialize();
    });

    it("should force garbage collection", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      (invoke as any).mockResolvedValue(undefined);

      // Mock window.gc
      (window as any).gc = vi.fn();

      await resourceManager.forceGarbageCollection();

      expect(invoke).toHaveBeenCalledWith("force_garbage_collection");
      expect((window as any).gc).toHaveBeenCalled();
    });

    it("should handle garbage collection errors gracefully", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      (invoke as any).mockRejectedValue(new Error("GC error"));

      await expect(
        resourceManager.forceGarbageCollection(),
      ).resolves.not.toThrow();
    });
  });

  describe("Cleanup", () => {
    it("should cleanup resources properly", async () => {
      await resourceManager.initialize();

      resourceManager.recordActivity(); // This sets a timeout

      resourceManager.cleanup();

      // Should not throw when trying to record activity after cleanup
      expect(() => resourceManager.recordActivity()).not.toThrow();
    });
  });
});
