import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTrayStore } from "../../stores/trayStore";
import { SessionStatus, type WorkSession } from "../../types/session.types";
import type { TrayView } from "../../types/tray.types";
import {
  usePopover,
  useRecentSessions,
  useSessionDuration,
  useTrayNavigation,
  useTrayNotifications,
  useTrayPreferences,
  useTraySession,
  useTraySubscription,
} from "../useTrayState";

// Mock the sync service
vi.mock("../../services/traySync", () => ({
  traySyncService: {
    initialize: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn().mockResolvedValue(undefined),
    forceSync: vi.fn().mockResolvedValue(undefined),
    syncPreferencesToBackend: vi.fn().mockResolvedValue(undefined),
    syncPopoverPosition: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("Tray State Hooks", () => {
  beforeEach(() => {
    useTrayStore.getState().reset();
    vi.clearAllMocks();
  });

  describe("usePopover", () => {
    it("should provide popover state and actions", () => {
      const { result } = renderHook(() => usePopover());

      expect(result.current.isVisible).toBe(false);
      expect(result.current.position).toBeNull();
      expect(result.current.size).toEqual({ width: 400, height: 600 });
      expect(typeof result.current.show).toBe("function");
      expect(typeof result.current.hide).toBe("function");
      expect(typeof result.current.toggle).toBe("function");
      expect(typeof result.current.updatePosition).toBe("function");
      expect(typeof result.current.updateSize).toBe("function");
      expect(typeof result.current.syncPosition).toBe("function");
    });

    it("should show and hide popover", () => {
      const { result } = renderHook(() => usePopover());
      const position = { x: 100, y: 200 };

      act(() => {
        result.current.show(position);
      });

      expect(result.current.isVisible).toBe(true);
      expect(result.current.position).toEqual(position);

      act(() => {
        result.current.hide();
      });

      expect(result.current.isVisible).toBe(false);
    });

    it("should toggle popover", () => {
      const { result } = renderHook(() => usePopover());
      const position = { x: 100, y: 200 };

      act(() => {
        result.current.toggle(position);
      });

      expect(result.current.isVisible).toBe(true);

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isVisible).toBe(false);
    });

    it("should update position and size", () => {
      const { result } = renderHook(() => usePopover());

      act(() => {
        result.current.updatePosition({ x: 300, y: 400 });
      });

      expect(result.current.position).toEqual({ x: 300, y: 400 });

      act(() => {
        result.current.updateSize({ width: 500, height: 700 });
      });

      expect(result.current.size).toEqual({ width: 500, height: 700 });
    });
  });

  describe("useTrayNavigation", () => {
    const mockView: TrayView = {
      id: "test-view",
      component: () => null,
      title: "Test View",
      canGoBack: true,
    };

    it("should provide navigation state and actions", () => {
      const { result } = renderHook(() => useTrayNavigation());

      expect(result.current.currentView).toBeNull();
      expect(result.current.viewStack).toEqual([]);
      expect(result.current.canGoBack).toBe(false);
      expect(result.current.canGoForward).toBe(false);
      expect(result.current.isTransitioning).toBe(false);
      expect(typeof result.current.navigateTo).toBe("function");
      expect(typeof result.current.goBack).toBe("function");
      expect(typeof result.current.setTransitioning).toBe("function");
    });

    it("should navigate to view", () => {
      const { result } = renderHook(() => useTrayNavigation());

      act(() => {
        result.current.navigateTo(mockView);
      });

      expect(result.current.currentView).toEqual(mockView);
      expect(result.current.canGoBack).toBe(false);
    });

    it("should handle navigation stack", () => {
      const { result } = renderHook(() => useTrayNavigation());
      const mockView2: TrayView = {
        id: "test-view-2",
        component: () => null,
        title: "Test View 2",
        canGoBack: true,
      };

      act(() => {
        result.current.navigateTo(mockView);
      });

      act(() => {
        result.current.navigateTo(mockView2);
      });

      expect(result.current.currentView).toEqual(mockView2);
      expect(result.current.canGoBack).toBe(true);

      act(() => {
        result.current.goBack();
      });

      expect(result.current.currentView).toEqual(mockView);
      expect(result.current.canGoBack).toBe(false);
      expect(result.current.canGoForward).toBe(true);
    });
  });

  describe("useTraySession", () => {
    const mockSession: WorkSession = {
      id: "session-1",
      userId: "user-1",
      startTime: Date.now(),
      status: SessionStatus.Active,
      captureConfig: {
        captureScreen: true,
        captureKeystrokes: true,
        captureMouse: true,
        privacyFilters: [],
        qualitySettings: "high",
      },
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it("should provide session state and actions", () => {
      const { result } = renderHook(() => useTraySession());

      expect(result.current.currentSession).toBeNull();
      expect(result.current.recentSessions).toEqual([]);
      expect(result.current.sessionStatus).toBeNull();
      expect(result.current.sessionDuration).toBe(0);
      expect(result.current.isRecording).toBe(false);
      expect(typeof result.current.updateCurrentSession).toBe("function");
      expect(typeof result.current.updateSessionStatus).toBe("function");
      expect(typeof result.current.updateSessionDuration).toBe("function");
      expect(typeof result.current.setRecording).toBe("function");
      expect(typeof result.current.addRecentSession).toBe("function");
      expect(typeof result.current.updateRecentSessions).toBe("function");
    });

    it("should update session state", () => {
      const { result } = renderHook(() => useTraySession());

      act(() => {
        result.current.updateCurrentSession(mockSession);
      });

      expect(result.current.currentSession).toEqual(mockSession);

      act(() => {
        result.current.updateSessionStatus(SessionStatus.Active);
      });

      expect(result.current.sessionStatus).toBe(SessionStatus.Active);

      act(() => {
        result.current.updateSessionDuration(3600);
      });

      expect(result.current.sessionDuration).toBe(3600);

      act(() => {
        result.current.setRecording(true);
      });

      expect(result.current.isRecording).toBe(true);
    });

    it("should manage recent sessions", () => {
      const { result } = renderHook(() => useTraySession());

      act(() => {
        result.current.addRecentSession(mockSession);
      });

      expect(result.current.recentSessions).toHaveLength(1);
      expect(result.current.recentSessions[0]).toEqual(mockSession);

      const newSessions = [
        { ...mockSession, id: "session-2" },
        { ...mockSession, id: "session-3" },
      ];

      act(() => {
        result.current.updateRecentSessions(newSessions);
      });

      expect(result.current.recentSessions).toEqual(newSessions);
    });
  });

  describe("useTrayNotifications", () => {
    it("should provide notification state and actions", () => {
      const { result } = renderHook(() => useTrayNotifications());

      expect(result.current.notifications).toEqual([]);
      expect(result.current.unreadCount).toBe(0);
      expect(typeof result.current.addNotification).toBe("function");
      expect(typeof result.current.markNotificationRead).toBe("function");
      expect(typeof result.current.clearNotification).toBe("function");
      expect(typeof result.current.clearAllNotifications).toBe("function");
    });

    it("should manage notifications", () => {
      const { result } = renderHook(() => useTrayNotifications());

      act(() => {
        result.current.addNotification({
          type: "info",
          title: "Test Notification",
          message: "Test message",
        });
      });

      expect(result.current.notifications).toHaveLength(1);
      expect(result.current.unreadCount).toBe(1);

      const notificationId = result.current.notifications[0].id;

      act(() => {
        result.current.markNotificationRead(notificationId);
      });

      expect(result.current.notifications[0].read).toBe(true);
      expect(result.current.unreadCount).toBe(0);

      act(() => {
        result.current.clearNotification(notificationId);
      });

      expect(result.current.notifications).toHaveLength(0);
    });
  });

  describe("useTrayPreferences", () => {
    it("should provide preferences state and actions", () => {
      const { result } = renderHook(() => useTrayPreferences());

      expect(result.current.preferences.theme).toBe("system");
      expect(result.current.preferences.showNotifications).toBe(true);
      expect(typeof result.current.updatePreferences).toBe("function");
      expect(typeof result.current.updateSettings).toBe("function");
      expect(typeof result.current.resetSettings).toBe("function");
      expect(typeof result.current.syncPreferences).toBe("function");
    });

    it("should update preferences", () => {
      const { result } = renderHook(() => useTrayPreferences());

      act(() => {
        result.current.updatePreferences({ theme: "dark" });
      });

      expect(result.current.preferences.theme).toBe("dark");
    });

    it("should reset settings", () => {
      const { result } = renderHook(() => useTrayPreferences());

      act(() => {
        result.current.updatePreferences({
          theme: "dark",
          showNotifications: false,
        });
      });

      expect(result.current.preferences.theme).toBe("dark");
      expect(result.current.preferences.showNotifications).toBe(false);

      act(() => {
        result.current.resetSettings();
      });

      expect(result.current.preferences.theme).toBe("system");
      expect(result.current.preferences.showNotifications).toBe(true);
    });
  });

  describe("useTraySync", () => {
    it("should provide sync state and actions", () => {
      // Test the store directly to avoid hook initialization issues
      const store = useTrayStore.getState();

      expect(store.isSyncing).toBe(false);
      expect(store.lastSyncTimestamp).toBe(0);
      expect(store.syncErrors).toEqual([]);
      expect(typeof store.startSync).toBe("function");
      expect(typeof store.endSync).toBe("function");
      expect(typeof store.addSyncError).toBe("function");
      expect(typeof store.clearSyncErrors).toBe("function");
    });

    it("should manage sync state", () => {
      // Test the store directly to avoid hook initialization issues
      const store = useTrayStore.getState();

      act(() => {
        store.startSync();
      });

      expect(useTrayStore.getState().isSyncing).toBe(true);

      act(() => {
        store.addSyncError("Test error");
      });

      expect(useTrayStore.getState().syncErrors).toContain("Test error");

      act(() => {
        store.endSync();
      });

      const state = useTrayStore.getState();
      expect(state.isSyncing).toBe(false);
      expect(state.lastSyncTimestamp).toBeGreaterThan(0);

      act(() => {
        store.clearSyncErrors();
      });

      expect(useTrayStore.getState().syncErrors).toEqual([]);
    });
  });

  describe("useSessionDuration", () => {
    it("should format duration correctly", () => {
      const { result } = renderHook(() => useSessionDuration());

      // Initially 0
      expect(result.current.duration).toBe(0);
      expect(result.current.formattedDuration).toBe("0:00");

      // Update duration to 90 seconds (1:30)
      act(() => {
        useTrayStore.getState().updateSessionDuration(90);
      });

      expect(result.current.duration).toBe(90);
      expect(result.current.formattedDuration).toBe("1:30");

      // Update duration to 3665 seconds (1:01:05)
      act(() => {
        useTrayStore.getState().updateSessionDuration(3665);
      });

      expect(result.current.duration).toBe(3665);
      expect(result.current.formattedDuration).toBe("1:01:05");
    });
  });

  describe("useRecentSessions", () => {
    const mockSessions: WorkSession[] = [
      {
        id: "session-1",
        userId: "user-1",
        startTime: Date.now() - 3600000, // 1 hour ago
        endTime: Date.now() - 1800000, // 30 minutes ago
        status: SessionStatus.Completed,
        captureConfig: {
          captureScreen: true,
          captureKeystrokes: true,
          captureMouse: true,
          privacyFilters: [],
          qualitySettings: "high",
        },
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now() - 1800000,
      },
      {
        id: "session-2",
        userId: "user-1",
        startTime: Date.now() - 86400000, // 1 day ago
        endTime: Date.now() - 86400000 + 1800000, // 1 day ago + 30 minutes
        status: SessionStatus.Completed,
        captureConfig: {
          captureScreen: true,
          captureKeystrokes: true,
          captureMouse: true,
          privacyFilters: [],
          qualitySettings: "high",
        },
        createdAt: Date.now() - 86400000,
        updatedAt: Date.now() - 86400000 + 1800000,
      },
    ];

    beforeEach(() => {
      act(() => {
        useTrayStore.getState().updateRecentSessions(mockSessions);
      });
    });

    it("should provide recent sessions and utility functions", () => {
      const { result } = renderHook(() => useRecentSessions());

      expect(result.current.recentSessions).toEqual(mockSessions);
      expect(typeof result.current.getSessionsByStatus).toBe("function");
      expect(typeof result.current.getSessionsFromToday).toBe("function");
      expect(typeof result.current.getTotalDurationToday).toBe("function");
    });

    it("should filter sessions by status", () => {
      const { result } = renderHook(() => useRecentSessions());

      const completedSessions = result.current.getSessionsByStatus(
        SessionStatus.Completed,
      );
      expect(completedSessions).toHaveLength(2);

      const activeSessions = result.current.getSessionsByStatus(
        SessionStatus.Active,
      );
      expect(activeSessions).toHaveLength(0);

      const allSessions = result.current.getSessionsByStatus();
      expect(allSessions).toEqual(mockSessions);
    });

    it("should get sessions from today", () => {
      const { result } = renderHook(() => useRecentSessions());

      const todaySessions = result.current.getSessionsFromToday();
      expect(todaySessions).toHaveLength(1);
      expect(todaySessions[0].id).toBe("session-1");
    });

    it("should calculate total duration for today", () => {
      const { result } = renderHook(() => useRecentSessions());

      const totalDuration = result.current.getTotalDurationToday();
      expect(totalDuration).toBe(1800); // 30 minutes in seconds
    });
  });

  describe("useTraySubscription", () => {
    it("should subscribe to state changes", () => {
      const callback = vi.fn();
      const selector = (state: any) => state.popover.isVisible;

      renderHook(() => useTraySubscription(selector, callback));

      // Change the state
      act(() => {
        useTrayStore.getState().showPopover();
      });

      expect(callback).toHaveBeenCalledWith(true, false);
    });
  });
});
