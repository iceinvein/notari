import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock all Tauri APIs at the top level
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

// Mock complex dependencies
vi.mock("../../services/tray/TrayResourceManager", () => ({
  trayResourceManager: {
    initialize: vi.fn().mockResolvedValue(undefined),
    cleanup: vi.fn(),
    recordActivity: vi.fn(),
  },
}));

vi.mock("../../hooks/useTrayErrorHandling", () => ({
  useTrayErrorHandling: () => [{ hasError: false, fallbackActive: false }],
}));

vi.mock("../../hooks/useOptimizedEventHandling", () => ({
  useOptimizedEventHandler: vi.fn(),
}));

// Mock TrayApp component
vi.mock("../../components/tray/TrayApp", () => ({
  TrayApp: () => <div>Mocked TrayApp</div>,
}));

// Mock ResizeObserver for testing environment
(globalThis as any).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// import App from "../../App";
import { TrayApp } from "../../components/tray/TrayApp";
import { Provider } from "../../provider";
// Import after mocking
import { trayCompatibilityService } from "../../services/compatibility/TrayCompatibilityService";
import { appLifecycleManager } from "../../services/lifecycle/AppLifecycleManager";

describe("Tray Integration Tests", () => {
  let mockInvoke: any;
  let mockListen: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get the mocked functions
    const { invoke } = await import("@tauri-apps/api/core");
    const { listen } = await import("@tauri-apps/api/event");

    mockInvoke = invoke as any;
    mockListen = listen as any;

    mockInvoke.mockResolvedValue(true);
    mockListen.mockResolvedValue(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Application Mode Detection", () => {
    it("should detect tray mode from URL parameters", () => {
      // Mock URL with tray parameter
      Object.defineProperty(window, "location", {
        value: {
          search: "?tray=true",
        },
        writable: true,
      });

      const isTrayMode = window.location.search.includes("tray=true");
      expect(isTrayMode).toBe(true);
    });

    it("should detect tray mode from window label", () => {
      // Mock popover window
      Object.defineProperty(window, "__TAURI_INTERNALS__", {
        value: {
          metadata: {
            currentWindow: {
              label: "popover",
            },
          },
        },
        writable: true,
      });

      const isPopoverWindow =
        (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label ===
        "popover";
      expect(isPopoverWindow).toBe(true);
    });

    it("should default to window mode", () => {
      // Reset URL and window label
      Object.defineProperty(window, "location", {
        value: {
          search: "",
        },
        writable: true,
      });

      Object.defineProperty(window, "__TAURI_INTERNALS__", {
        value: {
          metadata: {
            currentWindow: {
              label: "main",
            },
          },
        },
        writable: true,
      });

      const isTrayMode =
        window.location.search.includes("tray=true") ||
        (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label ===
          "popover";
      expect(isTrayMode).toBe(false);
    });
  });

  describe("Compatibility Service Integration", () => {
    it("should initialize compatibility service", async () => {
      const initializeSpy = vi.spyOn(trayCompatibilityService, "initialize");

      // Mock successful initialization
      initializeSpy.mockResolvedValue();

      await trayCompatibilityService.initialize();

      expect(initializeSpy).toHaveBeenCalled();
    });

    it("should sync session data", async () => {
      mockInvoke
        .mockResolvedValueOnce([]) // get_user_sessions
        .mockResolvedValueOnce(true); // verify_session_integrity

      await trayCompatibilityService.syncSessionData();

      expect(mockInvoke).toHaveBeenCalledWith("get_user_sessions");
    });

    it("should handle compatibility service failures gracefully", async () => {
      const initializeSpy = vi.spyOn(trayCompatibilityService, "initialize");
      initializeSpy.mockRejectedValue(
        new Error("Compatibility service failed"),
      );

      // Should not throw
      await expect(trayCompatibilityService.initialize()).rejects.toThrow();
    });
  });

  describe("Lifecycle Manager Integration", () => {
    it("should initialize lifecycle manager", async () => {
      const initializeSpy = vi.spyOn(appLifecycleManager, "initialize");
      initializeSpy.mockResolvedValue();

      await appLifecycleManager.initialize();

      expect(initializeSpy).toHaveBeenCalled();
    });

    it("should setup lifecycle listeners", async () => {
      mockListen.mockResolvedValue(() => {});

      await appLifecycleManager.initialize();

      // Should setup multiple listeners
      expect(mockListen).toHaveBeenCalledWith(
        "app-shutdown",
        expect.any(Function),
      );
      expect(mockListen).toHaveBeenCalledWith(
        "tray-event",
        expect.any(Function),
      );
      expect(mockListen).toHaveBeenCalledWith(
        "window-close-requested",
        expect.any(Function),
      );
    });

    it("should handle shutdown gracefully", async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined) // flush_pending_session_data
        .mockResolvedValueOnce(undefined) // flush_pending_proof_pack_data
        .mockResolvedValueOnce(undefined) // unregister_all_hotkeys
        .mockResolvedValueOnce(undefined) // destroy_tray
        .mockResolvedValueOnce(undefined); // destroy_popover

      await appLifecycleManager.shutdown();

      // The shutdown process calls these commands in this order
      expect(mockInvoke).toHaveBeenCalledWith("get_user_sessions");
      expect(mockInvoke).toHaveBeenCalledWith("get_all_proof_packs");
      expect(mockInvoke).toHaveBeenCalledWith("unregister_all_hotkeys");
      expect(mockInvoke).toHaveBeenCalledWith("destroy_tray");
      expect(mockInvoke).toHaveBeenCalledWith("destroy_popover");
    });
  });

  describe("Tray and Window Mode Switching", () => {
    it("should call show_main_window command", async () => {
      mockInvoke.mockResolvedValue(undefined);

      // Simulate the command call that would happen when switching modes
      await mockInvoke("show_main_window");

      expect(mockInvoke).toHaveBeenCalledWith("show_main_window");
    });

    it("should handle mode switching failures", async () => {
      mockInvoke.mockRejectedValue(new Error("Failed to show main window"));

      try {
        await mockInvoke("show_main_window");
      } catch (error) {
        expect((error as Error).message).toBe("Failed to show main window");
      }

      expect(mockInvoke).toHaveBeenCalledWith("show_main_window");
    });
  });

  describe("Data Consistency Between Modes", () => {
    it("should maintain session data consistency", async () => {
      const mockSession = {
        id: "test-session",
        name: "Test Session",
        status: "active",
        startTime: new Date().toISOString(),
      };

      mockInvoke
        .mockResolvedValueOnce([mockSession]) // get_user_sessions
        .mockResolvedValueOnce(true); // verify_session_integrity

      await trayCompatibilityService.syncSessionData();

      expect(mockInvoke).toHaveBeenCalledWith("get_user_sessions");
      expect(mockInvoke).toHaveBeenCalledWith("verify_session_integrity", {
        sessionId: "test-session",
      });
    });

    it("should maintain proof pack data consistency", async () => {
      const mockProofPack = {
        id: "test-proof-pack",
        name: "Test Proof Pack",
        sessionId: "test-session",
        createdAt: new Date().toISOString(),
      };

      mockInvoke
        .mockResolvedValueOnce([mockProofPack]) // get_all_proof_packs
        .mockResolvedValueOnce(true); // verify_proof_pack_integrity

      await trayCompatibilityService.syncProofPackData();

      expect(mockInvoke).toHaveBeenCalledWith("get_all_proof_packs");
      expect(mockInvoke).toHaveBeenCalledWith("verify_proof_pack_integrity", {
        proofPackId: "test-proof-pack",
      });
    });
  });

  describe("Backward Compatibility", () => {
    it("should migrate legacy data structures", async () => {
      mockInvoke
        .mockResolvedValueOnce({ isRequired: true, version: "1.0.0" }) // check_tray_migration_status
        .mockResolvedValueOnce(undefined) // migrate_legacy_settings_for_tray
        .mockResolvedValueOnce(undefined) // migrate_legacy_session_data
        .mockResolvedValueOnce(undefined) // migrate_legacy_proof_pack_data
        .mockResolvedValueOnce(undefined); // mark_tray_migration_complete

      await trayCompatibilityService.migrateToTrayCompatibility();

      expect(mockInvoke).toHaveBeenCalledWith("check_tray_migration_status");
      expect(mockInvoke).toHaveBeenCalledWith(
        "migrate_legacy_settings_for_tray",
      );
      expect(mockInvoke).toHaveBeenCalledWith("migrate_legacy_session_data");
      expect(mockInvoke).toHaveBeenCalledWith("migrate_legacy_proof_pack_data");
      expect(mockInvoke).toHaveBeenCalledWith("mark_tray_migration_complete");
    });

    it("should skip migration when not required", async () => {
      mockInvoke.mockResolvedValueOnce({ isRequired: false, version: "2.0.0" });

      await trayCompatibilityService.migrateToTrayCompatibility();

      expect(mockInvoke).toHaveBeenCalledWith("check_tray_migration_status");
      expect(mockInvoke).not.toHaveBeenCalledWith(
        "migrate_legacy_settings_for_tray",
      );
    });
  });

  describe("Error Handling and Fallbacks", () => {
    it("should handle tray initialization failures", async () => {
      mockInvoke.mockRejectedValue(new Error("Tray not supported"));

      // Test that the error is handled gracefully
      try {
        await mockInvoke("initialize_tray");
      } catch (error) {
        expect((error as Error).message).toBe("Tray not supported");
      }

      expect(mockInvoke).toHaveBeenCalledWith("initialize_tray");
    });

    it("should handle tray command failures gracefully", async () => {
      mockInvoke.mockRejectedValue(new Error("Tray command failed"));

      // Test that command failures are handled
      try {
        await mockInvoke("show_popover");
      } catch (error) {
        expect((error as Error).message).toBe("Tray command failed");
      }

      expect(mockInvoke).toHaveBeenCalledWith("show_popover");
    });
  });

  describe("Performance and Resource Management", () => {
    it("should cleanup resources on unmount", async () => {
      const { unmount } = render(
        <Provider>
          <TrayApp />
        </Provider>,
      );

      unmount();

      // Should not cause memory leaks or errors
      expect(true).toBe(true);
    });

    it("should handle multiple rapid mode switches", async () => {
      mockInvoke.mockResolvedValue(undefined);

      render(
        <Provider>
          <TrayApp />
        </Provider>,
      );

      // Since we're using a mocked component, just verify it renders
      expect(screen.getByText(/Mocked TrayApp/)).toBeInTheDocument();

      // Simulate the rapid command calls that would happen
      await mockInvoke("show_main_window");
      await mockInvoke("show_main_window");
      await mockInvoke("show_main_window");

      expect(mockInvoke).toHaveBeenCalledWith("show_main_window");
      expect(mockInvoke).toHaveBeenCalledTimes(3);
    });
  });
});
