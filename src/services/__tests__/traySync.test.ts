import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTrayStore } from "../../stores/trayStore";
import { SessionStatus, type WorkSession } from "../../types/session.types";
import { TraySyncService } from "../traySync";

// Mock Tauri APIs
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

// Get the mocked functions
const mockInvoke = vi.mocked(await import("@tauri-apps/api/core")).invoke;
const mockListen = vi.mocked(await import("@tauri-apps/api/event")).listen;
const mockUnlisten = vi.fn();

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("TraySyncService", () => {
  let syncService: TraySyncService;

  beforeEach(() => {
    syncService = new TraySyncService();
    useTrayStore.getState().reset();
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();

    // Setup default mock returns
    mockListen.mockResolvedValue(mockUnlisten);
    mockInvoke.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
    syncService.cleanup();
  });

  describe("Initialization", () => {
    it("should initialize successfully", async () => {
      const mockSessions: WorkSession[] = [
        {
          id: "session-1",
          userId: "user-1",
          startTime: Date.now(),
          status: SessionStatus.Completed,
          captureConfig: {
            captureScreen: true,
            captureKeystrokes: true,
            captureMouse: true,
            privacyFilters: [],
            qualitySettings: "high",
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockInvoke
        .mockResolvedValueOnce(null) // get_current_session
        .mockResolvedValueOnce(mockSessions) // get_recent_sessions
        .mockResolvedValueOnce(null); // get_tray_settings

      await syncService.initialize();

      // Verify event listeners were set up
      expect(mockListen).toHaveBeenCalledWith(
        "session-update",
        expect.any(Function),
      );
      expect(mockListen).toHaveBeenCalledWith(
        "session-list-update",
        expect.any(Function),
      );
      expect(mockListen).toHaveBeenCalledWith(
        "tray-notification",
        expect.any(Function),
      );
      expect(mockListen).toHaveBeenCalledWith(
        "tray-icon-update",
        expect.any(Function),
      );
      expect(mockListen).toHaveBeenCalledWith(
        "popover-toggle",
        expect.any(Function),
      );

      // Verify initial data sync
      expect(mockInvoke).toHaveBeenCalledWith("get_current_session");
      expect(mockInvoke).toHaveBeenCalledWith("get_recent_sessions", {
        limit: 10,
      });
      expect(mockInvoke).toHaveBeenCalledWith("get_tray_settings");

      // Verify store was updated
      const state = useTrayStore.getState();
      expect(state.session.recentSessions).toEqual(mockSessions);
      expect(state.isSyncing).toBe(false);
    });

    it("should handle initialization errors", async () => {
      const error = new Error("Initialization failed");
      mockInvoke.mockRejectedValue(error);

      await expect(syncService.initialize()).rejects.toThrow(
        "Initialization failed",
      );

      const state = useTrayStore.getState();
      expect(state.syncErrors).toContain("Initialization failed");
    });

    it("should not initialize twice", async () => {
      mockInvoke.mockResolvedValue([]);

      await syncService.initialize();
      await syncService.initialize(); // Second call should be ignored

      // Should only be called once for each command
      expect(mockInvoke).toHaveBeenCalledTimes(3); // get_current_session, get_recent_sessions, get_tray_settings
    });
  });

  describe("Event Handling", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValue([]);
      await syncService.initialize();
    });

    it("should handle session update events", async () => {
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

      // Get the session-update event handler
      const sessionUpdateCall = mockListen.mock.calls.find(
        (call) => call[0] === "session-update",
      );
      expect(sessionUpdateCall).toBeDefined();

      const eventHandler = sessionUpdateCall![1];

      // Simulate event
      eventHandler({
        event: "session-update",
        id: 1,
        payload: {
          session: mockSession,
          status: SessionStatus.Active,
          duration: 3600,
        },
      });

      // Wait for batched update to be processed (50ms batch window)
      vi.advanceTimersByTime(60);

      const state = useTrayStore.getState();
      expect(state.session.currentSession).toEqual(mockSession);
      expect(state.session.sessionStatus).toBe(SessionStatus.Active);
      expect(state.session.sessionDuration).toBe(3600);
      expect(state.session.isRecording).toBe(true);
    });

    it("should handle session list update events", async () => {
      const mockSessions: WorkSession[] = [
        {
          id: "session-1",
          userId: "user-1",
          startTime: Date.now(),
          status: SessionStatus.Completed,
          captureConfig: {
            captureScreen: true,
            captureKeystrokes: true,
            captureMouse: true,
            privacyFilters: [],
            qualitySettings: "high",
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      // Get the session-list-update event handler
      const sessionListCall = mockListen.mock.calls.find(
        (call) => call[0] === "session-list-update",
      );
      expect(sessionListCall).toBeDefined();

      const eventHandler = sessionListCall![1];

      // Simulate event
      eventHandler({
        event: "session-list-update",
        id: 1,
        payload: { sessions: mockSessions },
      });

      const state = useTrayStore.getState();
      expect(state.session.recentSessions).toEqual(mockSessions);
    });

    it("should handle notification events", async () => {
      // Get the tray-notification event handler
      const notificationCall = mockListen.mock.calls.find(
        (call) => call[0] === "tray-notification",
      );
      expect(notificationCall).toBeDefined();

      const eventHandler = notificationCall![1];

      // Simulate event
      eventHandler({
        event: "tray-notification",
        id: 1,
        payload: {
          type: "success",
          title: "Session Started",
          message: "Recording session has begun",
        },
      });

      const state = useTrayStore.getState();
      expect(state.notifications.notifications).toHaveLength(1);
      expect(state.notifications.notifications[0].type).toBe("success");
      expect(state.notifications.notifications[0].title).toBe(
        "Session Started",
      );
      expect(state.notifications.unreadCount).toBe(1);
    });

    it("should handle tray icon update events", async () => {
      // Get the tray-icon-update event handler
      const iconUpdateCall = mockListen.mock.calls.find(
        (call) => call[0] === "tray-icon-update",
      );
      expect(iconUpdateCall).toBeDefined();

      const eventHandler = iconUpdateCall![1];

      // Simulate recording status
      eventHandler({
        event: "tray-icon-update",
        id: 1,
        payload: {
          status: "recording",
          tooltip: "Recording session",
        },
      });

      let state = useTrayStore.getState();
      expect(state.session.isRecording).toBe(true);

      // Simulate idle status
      eventHandler({
        event: "tray-icon-update",
        id: 1,
        payload: {
          status: "idle",
          tooltip: "Ready to record",
        },
      });

      state = useTrayStore.getState();
      expect(state.session.isRecording).toBe(false);
    });

    it("should handle popover toggle events", async () => {
      // Get the popover-toggle event handler
      const popoverCall = mockListen.mock.calls.find(
        (call) => call[0] === "popover-toggle",
      );
      expect(popoverCall).toBeDefined();

      const eventHandler = popoverCall![1];

      // Simulate show popover
      eventHandler({
        event: "popover-toggle",
        id: 1,
        payload: {
          visible: true,
          position: { x: 100, y: 200 },
        },
      });

      let state = useTrayStore.getState();
      expect(state.popover.isVisible).toBe(true);
      expect(state.popover.position).toEqual({ x: 100, y: 200 });

      // Simulate hide popover
      eventHandler({
        event: "popover-toggle",
        id: 1,
        payload: { visible: false },
      });

      state = useTrayStore.getState();
      expect(state.popover.isVisible).toBe(false);
    });
  });

  describe("Periodic Sync", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValue([]);
      await syncService.initialize();
    });

    it("should sync more frequently when recording", async () => {
      // Set recording state
      useTrayStore.getState().setRecording(true);

      // Fast-forward 5 seconds (recording interval)
      vi.advanceTimersByTime(5000);

      expect(mockInvoke).toHaveBeenCalledWith("get_recent_sessions", {
        limit: 10,
      });
    });

    it("should sync less frequently when idle", async () => {
      // Ensure not recording
      useTrayStore.getState().setRecording(false);

      // Fast-forward 30 seconds (idle interval)
      vi.advanceTimersByTime(30000);

      expect(mockInvoke).toHaveBeenCalledWith("get_recent_sessions", {
        limit: 10,
      });
    });

    it("should handle sync errors gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Cleanup first to stop the periodic sync
      await syncService.cleanup();

      // Create a new service instance for this test
      const testService = new TraySyncService();

      // Make sync fail
      mockInvoke.mockReset();
      mockInvoke.mockRejectedValue(new Error("Sync failed"));

      // Initialize with failing sync
      try {
        await testService.initialize();
      } catch (error) {
        // Expected to fail
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to sync session data:",
        expect.any(Error),
      );

      await testService.cleanup();
      consoleSpy.mockRestore();
    });
  });

  describe("Manual Sync Operations", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValue([]);
      await syncService.initialize();
    });

    it("should force sync successfully", async () => {
      const mockSessions: WorkSession[] = [
        {
          id: "session-1",
          userId: "user-1",
          startTime: Date.now(),
          status: SessionStatus.Completed,
          captureConfig: {
            captureScreen: true,
            captureKeystrokes: true,
            captureMouse: true,
            privacyFilters: [],
            qualitySettings: "high",
          },
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      ];

      mockInvoke
        .mockResolvedValueOnce(null) // get_current_session
        .mockResolvedValueOnce(mockSessions) // get_recent_sessions
        .mockResolvedValueOnce(null); // get_tray_settings

      await syncService.forceSync();

      const state = useTrayStore.getState();
      expect(state.session.recentSessions).toEqual(mockSessions);
      expect(state.isSyncing).toBe(false);
      expect(state.syncErrors).toHaveLength(0);
    });

    it("should handle force sync errors", async () => {
      const error = new Error("Force sync failed");
      mockInvoke.mockRejectedValue(error);

      await expect(syncService.forceSync()).rejects.toThrow(
        "Force sync failed",
      );

      const state = useTrayStore.getState();
      expect(state.syncErrors).toContain("Force sync failed");
    });

    it("should sync preferences to backend", async () => {
      const preferences = {
        theme: "dark" as const,
        showNotifications: false,
        position: "center" as const,
        hotkey: "CommandOrControl+Shift+T",
        autoHide: false,
        quickActions: ["start-session"],
      };

      useTrayStore.getState().updatePreferences(preferences);

      await syncService.syncPreferencesToBackend();

      expect(mockInvoke).toHaveBeenCalledWith("update_tray_preferences", {
        preferences,
      });
    });

    it("should sync popover position", async () => {
      const position = { x: 300, y: 400 };
      useTrayStore.getState().updatePopoverPosition(position);

      await syncService.syncPopoverPosition();

      expect(mockInvoke).toHaveBeenCalledWith("update_popover_position", {
        position,
      });
    });

    it("should handle sync position errors gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockInvoke.mockRejectedValue(new Error("Position sync failed"));

      const position = { x: 300, y: 400 };
      useTrayStore.getState().updatePopoverPosition(position);

      // Should not throw
      await syncService.syncPopoverPosition();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to sync popover position:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe("Cleanup", () => {
    it("should cleanup event listeners and timers", async () => {
      mockInvoke.mockResolvedValue([]);
      await syncService.initialize();

      // Verify listeners were added
      expect(mockListen).toHaveBeenCalledTimes(5);

      await syncService.cleanup();

      // Verify unlisteners were called
      expect(mockUnlisten).toHaveBeenCalledTimes(5);
    });

    it("should handle cleanup when not initialized", async () => {
      // Should not throw
      await syncService.cleanup();

      expect(mockUnlisten).not.toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle missing current session gracefully", async () => {
      mockInvoke
        .mockResolvedValueOnce(null) // get_current_session returns null
        .mockResolvedValueOnce([]) // get_recent_sessions
        .mockResolvedValueOnce(null); // get_tray_settings

      await syncService.initialize();

      const state = useTrayStore.getState();
      expect(state.session.currentSession).toBeNull();
    });

    it("should handle settings sync failure gracefully", async () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockInvoke
        .mockResolvedValueOnce(null) // get_current_session
        .mockResolvedValueOnce([]) // get_recent_sessions
        .mockRejectedValueOnce(new Error("Settings failed")); // get_tray_settings fails

      // Should not throw despite settings failure
      await syncService.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        "Failed to sync settings:",
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });
});
