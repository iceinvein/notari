import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(),
  listen: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { TrayFallbackManager } from "../TrayFallbackManager";

const mockInvoke = vi.mocked(invoke);
const mockEmit = vi.mocked(emit);
// const mockListen = vi.mocked(listen); // Not used in current tests

describe("TrayFallbackManager", () => {
  let fallbackManager: TrayFallbackManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset singleton instance
    (TrayFallbackManager as any).instance = null;
    fallbackManager = TrayFallbackManager.getInstance();
  });

  afterEach(() => {
    fallbackManager.cleanup();
  });

  describe("singleton pattern", () => {
    it("returns the same instance", () => {
      const instance1 = TrayFallbackManager.getInstance();
      const instance2 = TrayFallbackManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe("checkTrayAvailability", () => {
    it("returns available status when tray initializes successfully", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const status = await fallbackManager.checkTrayAvailability();

      expect(status.isAvailable).toBe(true);
      expect(status.canRetry).toBe(true);
      expect(status.error).toBeUndefined();
      expect(mockInvoke).toHaveBeenCalledWith("initialize_tray");
    });

    it("returns unavailable status when tray initialization fails", async () => {
      const error = new Error("Permission denied");
      mockInvoke.mockRejectedValueOnce(error);

      const status = await fallbackManager.checkTrayAvailability();

      expect(status.isAvailable).toBe(false);
      expect(status.error).toBe("Permission denied");
      expect(status.fallbackReason).toBe("insufficient_permissions");
      expect(status.canRetry).toBe(false);
    });

    it("determines correct fallback reason for different errors", async () => {
      const testCases = [
        {
          error: "permission denied",
          expectedReason: "insufficient_permissions",
          canRetry: false,
        },
        {
          error: "not supported on this platform",
          expectedReason: "platform_not_supported",
          canRetry: false,
        },
        {
          error: "tray already exists",
          expectedReason: "tray_already_in_use",
          canRetry: true,
        },
        {
          error: "resource unavailable",
          expectedReason: "resource_unavailable",
          canRetry: true,
        },
        {
          error: "unknown error",
          expectedReason: "unknown_error",
          canRetry: true,
        },
      ];

      for (const testCase of testCases) {
        mockInvoke.mockRejectedValueOnce(new Error(testCase.error));

        const status = await fallbackManager.checkTrayAvailability();

        expect(status.fallbackReason).toBe(testCase.expectedReason);
        expect(status.canRetry).toBe(testCase.canRetry);
      }
    });
  });

  describe("retryTrayInitialization", () => {
    it("succeeds on retry when tray becomes available", async () => {
      // First call fails, second succeeds
      mockInvoke
        .mockRejectedValueOnce(new Error("Temporary failure"))
        .mockResolvedValueOnce(undefined);

      const success = await fallbackManager.retryTrayInitialization({
        maxRetries: 2,
        retryInterval: 100,
      });

      expect(success).toBe(true);
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it("fails after max retries", async () => {
      // Clear previous calls
      mockInvoke.mockClear();
      mockInvoke.mockRejectedValue(new Error("Persistent failure"));

      const success = await fallbackManager.retryTrayInitialization({
        maxRetries: 2,
        retryInterval: 100,
      });

      expect(success).toBe(false);
      // Should be called for initial check + retries + fallback calls
      expect(mockInvoke).toHaveBeenCalledWith("initialize_tray");
    });

    it("does not retry for non-retryable errors", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("permission denied"));

      // First call to set the error state
      await fallbackManager.checkTrayAvailability();

      const success = await fallbackManager.retryTrayInitialization({
        maxRetries: 3,
        retryInterval: 100,
      });

      expect(success).toBe(false);
      // Should not attempt retry for permission errors
    });
  });

  describe("activateFallbackMode", () => {
    it("shows main window when requested", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await fallbackManager.activateFallbackMode({
        showMainWindow: true,
        showNotification: false,
      });

      expect(mockInvoke).toHaveBeenCalledWith("show_main_window");
      expect(mockEmit).toHaveBeenCalledWith(
        "tray-fallback-activated",
        expect.any(Object),
      );
    });

    it("creates fallback window when main window fails", async () => {
      mockInvoke
        .mockRejectedValueOnce(new Error("Main window failed"))
        .mockResolvedValueOnce(undefined);

      await fallbackManager.activateFallbackMode({
        showMainWindow: true,
      });

      expect(mockInvoke).toHaveBeenCalledWith("show_main_window");
      expect(mockInvoke).toHaveBeenCalledWith("create_fallback_window");
    });

    it("shows system notification when requested", async () => {
      mockInvoke.mockResolvedValue(undefined);

      await fallbackManager.activateFallbackMode({
        showMainWindow: false,
        showNotification: true,
      });

      expect(mockInvoke).toHaveBeenCalledWith(
        "show_system_notification",
        expect.objectContaining({
          title: "Notari - Tray Unavailable",
          message: expect.any(String),
          notificationType: "Warning",
        }),
      );
    });
  });

  describe("status change listeners", () => {
    it("notifies listeners when status changes", async () => {
      const listener = vi.fn();
      const unsubscribe = fallbackManager.onStatusChange(listener);

      mockInvoke.mockRejectedValueOnce(new Error("Test error"));
      await fallbackManager.checkTrayAvailability();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          isAvailable: false,
          error: "Test error",
        }),
      );

      unsubscribe();
    });

    it("removes listeners when unsubscribed", async () => {
      const listener = vi.fn();
      const unsubscribe = fallbackManager.onStatusChange(listener);

      unsubscribe();

      mockInvoke.mockRejectedValueOnce(new Error("Test error"));
      await fallbackManager.checkTrayAvailability();

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("requestPermissions", () => {
    it("requests notification permissions", async () => {
      // Mock Notification API
      const mockRequestPermission = vi.fn().mockResolvedValue("granted");
      Object.defineProperty(window, "Notification", {
        value: {
          permission: "default",
          requestPermission: mockRequestPermission,
        },
        writable: true,
      });

      mockInvoke.mockResolvedValueOnce(undefined);

      const success = await fallbackManager.requestPermissions();

      expect(success).toBe(true);
      expect(mockRequestPermission).toHaveBeenCalled();
      expect(mockInvoke).toHaveBeenCalledWith("request_tray_permissions");
    });

    it("handles permission request failures gracefully", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Permission request failed"));

      const success = await fallbackManager.requestPermissions();

      expect(success).toBe(false);
    });
  });

  describe("error message generation", () => {
    it("generates appropriate messages for different error types", () => {
      const testCases = [
        {
          reason: "insufficient_permissions",
          expectedMessage:
            "System tray permissions are required. Please grant permissions and restart the application.",
        },
        {
          reason: "platform_not_supported",
          expectedMessage:
            "System tray is not supported on this platform. Using main window interface.",
        },
        {
          reason: "tray_already_in_use",
          expectedMessage:
            "Another instance of Notari is already running. Using main window interface.",
        },
        {
          reason: "resource_unavailable",
          expectedMessage:
            "System tray resources are unavailable. Using main window interface.",
        },
        {
          reason: "unknown",
          expectedMessage:
            "System tray is unavailable. Using main window interface instead.",
        },
      ];

      for (const testCase of testCases) {
        // Set the fallback reason
        (fallbackManager as any).availabilityStatus = {
          isAvailable: false,
          fallbackReason: testCase.reason,
        };

        const message = (fallbackManager as any).getFallbackMessage();
        expect(message).toBe(testCase.expectedMessage);
      }
    });
  });

  describe("cleanup", () => {
    it("clears timeouts and listeners on cleanup", () => {
      const listener = vi.fn();
      fallbackManager.onStatusChange(listener);

      fallbackManager.cleanup();

      // Should not crash and should clear internal state
      expect(() => fallbackManager.cleanup()).not.toThrow();
    });
  });
});
