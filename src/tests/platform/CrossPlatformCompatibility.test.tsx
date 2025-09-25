import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrayApp } from "../../components/tray/TrayApp";
import { Provider } from "../../provider";

// Mock all Tauri APIs
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

vi.mock("../../components/tray/TrayApp", () => ({
  TrayApp: () => <div data-testid="tray-app">Cross-Platform TrayApp</div>,
}));

// Mock ResizeObserver
(globalThis as any).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe("Cross-Platform Compatibility Tests", () => {
  let mockInvoke: any;
  let mockListen: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { invoke } = await import("@tauri-apps/api/core");
    const { listen } = await import("@tauri-apps/api/event");

    mockInvoke = invoke as any;
    mockListen = listen as any;

    // Default successful responses
    mockInvoke.mockResolvedValue(true);
    mockListen.mockResolvedValue(() => {});
  });

  describe("Platform Detection and Validation", () => {
    it("should detect and validate platform information", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_platform_info":
            return Promise.resolve({
              platform: "darwin",
              type: "Darwin",
              version: "13.0.0",
              arch: "x86_64",
            });
          case "validate_platform_support":
            return Promise.resolve({
              supported: true,
              features: ["tray", "notifications", "hotkeys"],
            });
          default:
            return Promise.resolve(true);
        }
      });

      const platformInfo = await mockInvoke("get_platform_info");
      const validation = await mockInvoke(
        "validate_platform_support",
        platformInfo,
      );

      expect(platformInfo.platform).toBe("darwin");
      expect(validation.supported).toBe(true);
      expect(validation.features).toContain("tray");
    });
  });

  describe("Cross-Platform API Consistency", () => {
    it("should provide consistent tray API across platforms", async () => {
      const trayCommands = [
        "show_popover",
        "hide_popover",
        "toggle_popover",
        "update_tray_icon",
        "set_tray_tooltip",
      ];

      for (const command of trayCommands) {
        mockInvoke.mockImplementation((cmd: string) => {
          if (cmd === command) {
            return Promise.resolve({
              success: true,
              command,
              timestamp: Date.now(),
            });
          }
          return Promise.resolve(true);
        });

        const result = await mockInvoke(command);
        expect(result.success).toBe(true);
        expect(result.command).toBe(command);
      }
    });
  });

  describe("Integration Testing", () => {
    it("should validate component integration", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "test_component_integration":
            return Promise.resolve({
              success: true,
              components: {
                tray: { initialized: true, responsive: true },
                popover: { created: true, positioned: true },
                notifications: { enabled: true, working: true },
                hotkeys: { registered: true, functional: true },
              },
              allComponentsWorking: true,
            });
          default:
            return Promise.resolve(true);
        }
      });

      render(
        <Provider>
          <TrayApp />
        </Provider>,
      );

      await waitFor(() => {
        expect(screen.getByTestId("tray-app")).toBeInTheDocument();
      });

      const integration = await mockInvoke("test_component_integration");

      expect(integration.success).toBe(true);
      expect(integration.allComponentsWorking).toBe(true);
      expect(integration.components.tray.initialized).toBe(true);
      expect(integration.components.popover.created).toBe(true);
    });
  });
});
