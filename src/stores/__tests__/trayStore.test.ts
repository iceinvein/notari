import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SessionStatus, type WorkSession } from "../../types/session.types";
import type { TrayView } from "../../types/tray.types";
import { useTrayStore } from "../trayStore";

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("TrayStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useTrayStore.getState().reset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Popover State Management", () => {
    it("should show popover", () => {
      const store = useTrayStore.getState();
      const position = { x: 100, y: 200 };

      store.showPopover(position);

      const state = useTrayStore.getState();
      expect(state.popover.isVisible).toBe(true);
      expect(state.popover.position).toEqual(position);
    });

    it("should hide popover", () => {
      const store = useTrayStore.getState();

      // First show it
      store.showPopover({ x: 100, y: 200 });
      expect(useTrayStore.getState().popover.isVisible).toBe(true);

      // Then hide it
      store.hidePopover();
      expect(useTrayStore.getState().popover.isVisible).toBe(false);
    });

    it("should toggle popover visibility", () => {
      const store = useTrayStore.getState();
      const position = { x: 100, y: 200 };

      // Initially hidden
      expect(useTrayStore.getState().popover.isVisible).toBe(false);

      // Toggle to show
      store.togglePopover(position);
      expect(useTrayStore.getState().popover.isVisible).toBe(true);
      expect(useTrayStore.getState().popover.position).toEqual(position);

      // Toggle to hide
      store.togglePopover();
      expect(useTrayStore.getState().popover.isVisible).toBe(false);
    });

    it("should update popover position", () => {
      const store = useTrayStore.getState();
      const newPosition = { x: 300, y: 400 };

      store.updatePopoverPosition(newPosition);

      expect(useTrayStore.getState().popover.position).toEqual(newPosition);
    });

    it("should update popover size", () => {
      const store = useTrayStore.getState();
      const newSize = { width: 500, height: 700 };

      store.updatePopoverSize(newSize);

      expect(useTrayStore.getState().popover.size).toEqual(newSize);
    });
  });

  describe("Navigation State Management", () => {
    const mockView: TrayView = {
      id: "test-view",
      component: () => null,
      title: "Test View",
      canGoBack: true,
    };

    const mockView2: TrayView = {
      id: "test-view-2",
      component: () => null,
      title: "Test View 2",
      canGoBack: true,
    };

    it("should navigate to a view", () => {
      const store = useTrayStore.getState();

      store.navigateTo(mockView);

      const state = useTrayStore.getState();
      expect(state.navigation.currentView).toEqual(mockView);
      expect(state.navigation.viewStack).toHaveLength(0);
      expect(state.navigation.canGoBack).toBe(false);
    });

    it("should maintain navigation stack", () => {
      const store = useTrayStore.getState();

      // Navigate to first view
      store.navigateTo(mockView);

      // Navigate to second view
      store.navigateTo(mockView2);

      const state = useTrayStore.getState();
      expect(state.navigation.currentView).toEqual(mockView2);
      expect(state.navigation.viewStack).toHaveLength(1);
      expect(state.navigation.viewStack[0]).toEqual(mockView);
      expect(state.navigation.canGoBack).toBe(true);
    });

    it("should go back in navigation", () => {
      const store = useTrayStore.getState();

      // Set up navigation stack
      store.navigateTo(mockView);
      store.navigateTo(mockView2);

      // Go back
      store.goBack();

      const state = useTrayStore.getState();
      expect(state.navigation.currentView).toEqual(mockView);
      expect(state.navigation.viewStack).toHaveLength(0);
      expect(state.navigation.canGoBack).toBe(false);
      expect(state.navigation.canGoForward).toBe(true);
    });

    it("should handle go back when no previous view exists", () => {
      const store = useTrayStore.getState();
      const initialState = useTrayStore.getState();

      store.goBack();

      const state = useTrayStore.getState();
      expect(state.navigation).toEqual(initialState.navigation);
    });

    it("should set transitioning state", () => {
      const store = useTrayStore.getState();

      store.setTransitioning(true);
      expect(useTrayStore.getState().isTransitioning).toBe(true);

      store.setTransitioning(false);
      expect(useTrayStore.getState().isTransitioning).toBe(false);
    });
  });

  describe("Session State Management", () => {
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

    it("should update current session", () => {
      const store = useTrayStore.getState();

      store.updateCurrentSession(mockSession);

      expect(useTrayStore.getState().session.currentSession).toEqual(
        mockSession,
      );
    });

    it("should update session status", () => {
      const store = useTrayStore.getState();
      const status = SessionStatus.Active;

      store.updateSessionStatus(status);

      expect(useTrayStore.getState().session.sessionStatus).toBe(status);
    });

    it("should update session duration", () => {
      const store = useTrayStore.getState();
      const duration = 3600; // 1 hour in seconds

      store.updateSessionDuration(duration);

      expect(useTrayStore.getState().session.sessionDuration).toBe(duration);
    });

    it("should set recording state", () => {
      const store = useTrayStore.getState();

      store.setRecording(true);
      expect(useTrayStore.getState().session.isRecording).toBe(true);

      store.setRecording(false);
      expect(useTrayStore.getState().session.isRecording).toBe(false);
    });

    it("should add recent session", () => {
      const store = useTrayStore.getState();

      store.addRecentSession(mockSession);

      const state = useTrayStore.getState();
      expect(state.session.recentSessions).toHaveLength(1);
      expect(state.session.recentSessions[0]).toEqual(mockSession);
    });

    it("should limit recent sessions to 10", () => {
      const store = useTrayStore.getState();

      // Add 12 sessions
      for (let i = 0; i < 12; i++) {
        const session = { ...mockSession, id: `session-${i}` };
        store.addRecentSession(session);
      }

      const state = useTrayStore.getState();
      expect(state.session.recentSessions).toHaveLength(10);
      expect(state.session.recentSessions[0].id).toBe("session-11"); // Most recent first
    });

    it("should update recent sessions list", () => {
      const store = useTrayStore.getState();
      const sessions = [
        { ...mockSession, id: "session-1" },
        { ...mockSession, id: "session-2" },
        { ...mockSession, id: "session-3" },
      ];

      store.updateRecentSessions(sessions);

      expect(useTrayStore.getState().session.recentSessions).toEqual(sessions);
    });
  });

  describe("Notification Management", () => {
    it("should add notification", () => {
      const store = useTrayStore.getState();
      const notification = {
        type: "info" as const,
        title: "Test Notification",
        message: "This is a test message",
      };

      store.addNotification(notification);

      const state = useTrayStore.getState();
      expect(state.notifications.notifications).toHaveLength(1);
      expect(state.notifications.unreadCount).toBe(1);

      const addedNotification = state.notifications.notifications[0];
      expect(addedNotification.type).toBe(notification.type);
      expect(addedNotification.title).toBe(notification.title);
      expect(addedNotification.message).toBe(notification.message);
      expect(addedNotification.read).toBe(false);
      expect(addedNotification.id).toBeDefined();
      expect(addedNotification.timestamp).toBeDefined();
    });

    it("should mark notification as read", () => {
      const store = useTrayStore.getState();

      // Add a notification
      store.addNotification({
        type: "info",
        title: "Test",
        message: "Test message",
      });

      const notificationId =
        useTrayStore.getState().notifications.notifications[0].id;

      // Mark as read
      store.markNotificationRead(notificationId);

      const state = useTrayStore.getState();
      expect(state.notifications.notifications[0].read).toBe(true);
      expect(state.notifications.unreadCount).toBe(0);
    });

    it("should clear notification", () => {
      const store = useTrayStore.getState();

      // Add a notification
      store.addNotification({
        type: "info",
        title: "Test",
        message: "Test message",
      });

      const notificationId =
        useTrayStore.getState().notifications.notifications[0].id;

      // Clear notification
      store.clearNotification(notificationId);

      const state = useTrayStore.getState();
      expect(state.notifications.notifications).toHaveLength(0);
      expect(state.notifications.unreadCount).toBe(0);
    });

    it("should clear all notifications", () => {
      const store = useTrayStore.getState();

      // Add multiple notifications
      store.addNotification({
        type: "info",
        title: "Test 1",
        message: "Message 1",
      });
      store.addNotification({
        type: "warning",
        title: "Test 2",
        message: "Message 2",
      });
      store.addNotification({
        type: "error",
        title: "Test 3",
        message: "Message 3",
      });

      expect(useTrayStore.getState().notifications.notifications).toHaveLength(
        3,
      );

      // Clear all
      store.clearAllNotifications();

      const state = useTrayStore.getState();
      expect(state.notifications.notifications).toHaveLength(0);
      expect(state.notifications.unreadCount).toBe(0);
    });

    it("should limit notifications to 50", () => {
      const store = useTrayStore.getState();

      // Add 52 notifications
      for (let i = 0; i < 52; i++) {
        store.addNotification({
          type: "info",
          title: `Test ${i}`,
          message: `Message ${i}`,
        });
      }

      const state = useTrayStore.getState();
      expect(state.notifications.notifications).toHaveLength(50);
      expect(state.notifications.notifications[0].title).toBe("Test 51"); // Most recent first
    });
  });

  describe("Settings Management", () => {
    it("should update preferences", () => {
      const store = useTrayStore.getState();
      const newPreferences = {
        theme: "dark" as const,
        showNotifications: false,
      };

      store.updatePreferences(newPreferences);

      const state = useTrayStore.getState();
      expect(state.preferences.theme).toBe("dark");
      expect(state.preferences.showNotifications).toBe(false);
      expect(state.settings.preferences.theme).toBe("dark");
      expect(state.settings.preferences.showNotifications).toBe(false);
    });

    it("should update settings", () => {
      const store = useTrayStore.getState();
      const newSettings = {
        notifications: {
          sessionStart: false,
          sessionStop: false,
          proofPackCreated: true,
          blockchainAnchor: true,
          error: true,
          warning: true,
          info: false,
          showSounds: false,
        },
      };

      store.updateSettings(newSettings);

      const state = useTrayStore.getState();
      expect(state.settings.notifications).toEqual(newSettings.notifications);
    });

    it("should reset settings to defaults", () => {
      const store = useTrayStore.getState();

      // Modify settings first
      store.updatePreferences({ theme: "dark", showNotifications: false });

      // Reset
      store.resetSettings();

      const state = useTrayStore.getState();
      expect(state.preferences.theme).toBe("system");
      expect(state.preferences.showNotifications).toBe(true);
    });
  });

  describe("Synchronization State", () => {
    it("should start sync", () => {
      const store = useTrayStore.getState();

      store.startSync();

      const state = useTrayStore.getState();
      expect(state.isSyncing).toBe(true);
      expect(state.syncErrors).toHaveLength(0);
    });

    it("should end sync without errors", () => {
      const store = useTrayStore.getState();

      store.startSync();
      store.endSync();

      const state = useTrayStore.getState();
      expect(state.isSyncing).toBe(false);
      expect(state.lastSyncTimestamp).toBeGreaterThan(0);
      expect(state.syncErrors).toHaveLength(0);
    });

    it("should end sync with errors", () => {
      const store = useTrayStore.getState();
      const errors = ["Error 1", "Error 2"];

      store.startSync();
      store.endSync(errors);

      const state = useTrayStore.getState();
      expect(state.isSyncing).toBe(false);
      expect(state.syncErrors).toEqual(errors);
    });

    it("should add sync error", () => {
      const store = useTrayStore.getState();
      const error = "Sync failed";

      store.addSyncError(error);

      expect(useTrayStore.getState().syncErrors).toContain(error);
    });

    it("should clear sync errors", () => {
      const store = useTrayStore.getState();

      // Add some errors
      store.addSyncError("Error 1");
      store.addSyncError("Error 2");
      expect(useTrayStore.getState().syncErrors).toHaveLength(2);

      // Clear errors
      store.clearSyncErrors();
      expect(useTrayStore.getState().syncErrors).toHaveLength(0);
    });
  });

  describe("Store Reset", () => {
    it("should reset store to initial state", () => {
      const store = useTrayStore.getState();

      // Modify various parts of the state
      store.showPopover({ x: 100, y: 200 });
      store.updateSessionDuration(3600);
      store.addNotification({ type: "info", title: "Test", message: "Test" });
      store.updatePreferences({ theme: "dark" });
      store.startSync();

      // Verify state is modified
      let state = useTrayStore.getState();
      expect(state.popover.isVisible).toBe(true);
      expect(state.session.sessionDuration).toBe(3600);
      expect(state.notifications.notifications).toHaveLength(1);
      expect(state.preferences.theme).toBe("dark");
      expect(state.isSyncing).toBe(true);

      // Reset
      store.reset();

      // Verify state is back to initial
      state = useTrayStore.getState();
      expect(state.popover.isVisible).toBe(false);
      expect(state.session.sessionDuration).toBe(0);
      expect(state.notifications.notifications).toHaveLength(0);
      expect(state.preferences.theme).toBe("system");
      expect(state.isSyncing).toBe(false);
    });
  });
});
