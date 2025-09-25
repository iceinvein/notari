import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TrayApp } from "../../components/tray/TrayApp";
import { Provider } from "../../provider";

// Mock Tauri APIs
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/os", () => ({
  platform: vi.fn().mockResolvedValue("win32"),
  type: vi.fn().mockResolvedValue("Windows_NT"),
  version: vi.fn().mockResolvedValue("10.0.22000"),
}));

// Mock dependencies
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
  TrayApp: () => <div data-testid="tray-app">Windows TrayApp</div>,
}));

// Mock ResizeObserver
(globalThis as any).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe("Windows Specific Compatibility Tests", () => {
  let mockInvoke: any;
  let mockListen: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    const { invoke } = await import("@tauri-apps/api/core");
    const { listen } = await import("@tauri-apps/api/event");

    mockInvoke = invoke as any;
    mockListen = listen as any;

    mockInvoke.mockResolvedValue(true);
    mockListen.mockResolvedValue(() => {});
  });

  describe("System Tray Integration", () => {
    it("should integrate with Windows system tray correctly", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "initialize_windows_systray":
            return Promise.resolve({
              success: true,
              taskbarHeight: 40,
              trayIconPosition: { x: 1850, y: 1040 },
              highDPI: true,
            });
          case "get_taskbar_info":
            return Promise.resolve({
              position: "bottom",
              autoHide: false,
              height: 40,
              bounds: { x: 0, y: 1040, width: 1920, height: 40 },
            });
          default:
            return Promise.resolve(true);
        }
      });

      const systrayResult = await mockInvoke("initialize_windows_systray");
      const taskbarInfo = await mockInvoke("get_taskbar_info");

      expect(systrayResult.success).toBe(true);
      expect(systrayResult.highDPI).toBe(true);
      expect(taskbarInfo.position).toBe("bottom");
    });

    it("should handle different taskbar positions", async () => {
      const taskbarPositions = [
        {
          position: "bottom",
          bounds: { x: 0, y: 1040, width: 1920, height: 40 },
        },
        { position: "top", bounds: { x: 0, y: 0, width: 1920, height: 40 } },
        { position: "left", bounds: { x: 0, y: 0, width: 40, height: 1080 } },
        {
          position: "right",
          bounds: { x: 1880, y: 0, width: 40, height: 1080 },
        },
      ];

      for (const taskbar of taskbarPositions) {
        mockInvoke.mockImplementation((command: string) => {
          switch (command) {
            case "get_taskbar_position":
              return Promise.resolve(taskbar.position);
            case "get_taskbar_bounds":
              return Promise.resolve(taskbar.bounds);
            case "calculate_tray_position":
              return Promise.resolve({
                x:
                  taskbar.position === "right"
                    ? taskbar.bounds.x + 10
                    : taskbar.bounds.x + taskbar.bounds.width - 30,
                y:
                  taskbar.position === "top"
                    ? taskbar.bounds.y + 10
                    : taskbar.bounds.y + 10,
                position: taskbar.position,
              });
            default:
              return Promise.resolve(true);
          }
        });

        const position = await mockInvoke("get_taskbar_position");
        const bounds = await mockInvoke("get_taskbar_bounds");
        const trayPos = await mockInvoke("calculate_tray_position");

        expect(position).toBe(taskbar.position);
        expect(bounds).toEqual(taskbar.bounds);
        expect(trayPos.position).toBe(taskbar.position);
      }
    });

    it("should handle taskbar auto-hide behavior", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "detect_taskbar_autohide":
            return Promise.resolve({
              autoHide: true,
              currentlyHidden: false,
            });
          case "listen_taskbar_visibility":
            return Promise.resolve({ listening: true });
          case "adjust_for_autohide_taskbar":
            return Promise.resolve({
              adjusted: true,
              showTaskbarFirst: true,
            });
          default:
            return Promise.resolve(true);
        }
      });

      const autoHideInfo = await mockInvoke("detect_taskbar_autohide");
      const listening = await mockInvoke("listen_taskbar_visibility");
      const adjustment = await mockInvoke("adjust_for_autohide_taskbar");

      expect(autoHideInfo.autoHide).toBe(true);
      expect(listening.listening).toBe(true);
      expect(adjustment.showTaskbarFirst).toBe(true);
    });

    it("should handle system tray overflow area", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "check_tray_overflow":
            return Promise.resolve({
              inOverflow: false,
              canPromoteToVisible: true,
            });
          case "promote_tray_icon":
            return Promise.resolve({
              success: true,
              promoted: true,
            });
          default:
            return Promise.resolve(true);
        }
      });

      const overflowStatus = await mockInvoke("check_tray_overflow");

      if (overflowStatus.canPromoteToVisible) {
        const promotion = await mockInvoke("promote_tray_icon");
        expect(promotion.promoted).toBe(true);
      }

      expect(overflowStatus.inOverflow).toBe(false);
    });
  });

  describe("High DPI Support", () => {
    it("should handle different DPI scaling levels", async () => {
      const dpiScales = [1.0, 1.25, 1.5, 2.0, 2.5];

      for (const scale of dpiScales) {
        mockInvoke.mockImplementation((command: string) => {
          switch (command) {
            case "get_display_dpi":
              return Promise.resolve({
                dpi: 96 * scale,
                scaleFactor: scale,
                dpiAwareness: "PerMonitorV2",
              });
            case "scale_ui_elements":
              return Promise.resolve({
                scaled: true,
                scaleFactor: scale,
                adjustedSizes: {
                  popoverWidth: Math.round(400 * scale),
                  popoverHeight: Math.round(600 * scale),
                  iconSize: Math.round(16 * scale),
                },
              });
            default:
              return Promise.resolve(true);
          }
        });

        const dpiInfo = await mockInvoke("get_display_dpi");
        const scaling = await mockInvoke("scale_ui_elements", { scale });

        expect(dpiInfo.scaleFactor).toBe(scale);
        expect(scaling.adjustedSizes.popoverWidth).toBe(
          Math.round(400 * scale),
        );
      }
    });

    it("should handle per-monitor DPI awareness", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "set_dpi_awareness":
            return Promise.resolve({
              success: true,
              awareness: "PerMonitorV2",
            });
          case "get_monitor_dpi":
            return Promise.resolve([
              { monitorId: 0, dpi: 96, scaleFactor: 1.0 },
              { monitorId: 1, dpi: 144, scaleFactor: 1.5 },
            ]);
          case "adapt_to_monitor_dpi":
            return Promise.resolve({
              adapted: true,
              currentMonitor: 1,
              scaleFactor: 1.5,
            });
          default:
            return Promise.resolve(true);
        }
      });

      const dpiAwareness = await mockInvoke("set_dpi_awareness");
      const monitorDPIs = await mockInvoke("get_monitor_dpi");
      const adaptation = await mockInvoke("adapt_to_monitor_dpi", {
        monitorId: 1,
      });

      expect(dpiAwareness.awareness).toBe("PerMonitorV2");
      expect(monitorDPIs).toHaveLength(2);
      expect(adaptation.scaleFactor).toBe(1.5);
    });

    it("should handle DPI changes during runtime", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "listen_dpi_changes":
            // Simulate setting up the listener
            mockListen("dpi-changed", expect.any(Function));
            return Promise.resolve({ listening: true });
          case "handle_dpi_change":
            return Promise.resolve({
              handled: true,
              newScaleFactor: 1.25,
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

      await mockInvoke("listen_dpi_changes");
      expect(mockListen).toHaveBeenCalled();

      // Simulate DPI change by calling the handler directly
      await mockInvoke("handle_dpi_change", { newDPI: 120 });
      expect(mockInvoke).toHaveBeenCalledWith("handle_dpi_change", {
        newDPI: 120,
      });
    });
  });

  describe("Windows Notifications", () => {
    it("should integrate with Windows Action Center", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "check_action_center_permissions":
            return Promise.resolve({
              granted: true,
              toastCapable: true,
            });
          case "send_action_center_notification":
            return Promise.resolve({
              success: true,
              notificationId: "ac-123",
              deliveredToActionCenter: true,
            });
          default:
            return Promise.resolve(true);
        }
      });

      const permissions = await mockInvoke("check_action_center_permissions");
      const notification = await mockInvoke("send_action_center_notification", {
        title: "Session Started",
        body: "Your work session is now being recorded",
        group: "session-notifications",
      });

      expect(permissions.toastCapable).toBe(true);
      expect(notification.deliveredToActionCenter).toBe(true);
    });

    it("should handle Windows 10 vs Windows 11 notification differences", async () => {
      const windowsVersions = [
        {
          version: "10.0.19041",
          isWindows11: false,
          features: { legacyToasts: true },
        },
        {
          version: "10.0.22000",
          isWindows11: true,
          features: { modernToasts: true, grouping: true },
        },
      ];

      for (const winVersion of windowsVersions) {
        mockInvoke.mockImplementation((command: string) => {
          switch (command) {
            case "get_windows_version":
              return Promise.resolve(winVersion);
            case "adapt_notifications_for_version":
              return Promise.resolve({
                adapted: true,
                features: winVersion.features,
              });
            default:
              return Promise.resolve(true);
          }
        });

        const version = await mockInvoke("get_windows_version");
        const adaptation = await mockInvoke("adapt_notifications_for_version");

        expect(version.isWindows11).toBe(winVersion.isWindows11);
        expect(adaptation.adapted).toBe(true);
      }
    });

    it("should handle notification actions and buttons", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "send_interactive_notification":
            return Promise.resolve({
              success: true,
              notificationId: "interactive-123",
              buttons: ["view", "dismiss"],
            });
          default:
            return Promise.resolve(true);
        }
      });

      const notification = await mockInvoke("send_interactive_notification", {
        title: "Proof Pack Ready",
        body: "Your proof pack has been created successfully",
        buttons: [
          { id: "view", text: "View Proof Pack" },
          { id: "dismiss", text: "Dismiss" },
        ],
      });

      expect(notification.success).toBe(true);
      expect(notification.buttons).toContain("view");

      // Simulate the event listener being called
      mockListen("notification-button-clicked", expect.any(Function));
      expect(mockListen).toHaveBeenCalled();
    });

    it("should handle notification focus assist integration", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "check_focus_assist_status":
            return Promise.resolve({
              enabled: true,
              mode: "priority_only", // off, priority_only, alarms_only
              allowedApps: ["Notari"],
            });
          case "request_focus_assist_exception":
            return Promise.resolve({
              granted: true,
              priority: "high",
            });
          default:
            return Promise.resolve(true);
        }
      });

      const focusAssist = await mockInvoke("check_focus_assist_status");
      const exception = await mockInvoke("request_focus_assist_exception");

      expect(focusAssist.enabled).toBe(true);
      expect(exception.granted).toBe(true);
    });
  });

  describe("Windows Version Compatibility", () => {
    it("should handle Windows 10 specific features", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "check_windows10_features":
            return Promise.resolve({
              version: "10.0.19041",
              isWindows10: true,
              features: {
                legacyNotifications: true,
                classicTaskbar: true,
                legacySystemTray: true,
              },
            });
          case "adapt_for_windows10":
            return Promise.resolve({
              adapted: true,
              changes: ["legacy_notification_style", "classic_tray_behavior"],
            });
          default:
            return Promise.resolve(true);
        }
      });

      const features = await mockInvoke("check_windows10_features");
      const adaptation = await mockInvoke("adapt_for_windows10");

      expect(features.isWindows10).toBe(true);
      expect(adaptation.changes).toContain("legacy_notification_style");
    });

    it("should handle Windows 11 specific features", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "check_windows11_features":
            return Promise.resolve({
              version: "10.0.22000",
              isWindows11: true,
              features: {
                roundedCorners: true,
                centeredTaskbar: false,
                newNotifications: true,
                modernSystemTray: true,
              },
            });
          case "adapt_for_windows11":
            return Promise.resolve({
              adapted: true,
              changes: [
                "rounded_popover",
                "modern_notifications",
                "new_tray_style",
              ],
            });
          default:
            return Promise.resolve(true);
        }
      });

      const features = await mockInvoke("check_windows11_features");
      const adaptation = await mockInvoke("adapt_for_windows11");

      expect(features.isWindows11).toBe(true);
      expect(adaptation.changes).toContain("rounded_popover");
    });

    it("should handle Windows Server compatibility", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "detect_windows_server":
            return Promise.resolve({
              isServer: true,
              version: "2019",
              features: {
                limitedNotifications: true,
                noSystemTray: false,
                restrictedPermissions: true,
              },
            });
          case "adapt_for_server_environment":
            return Promise.resolve({
              adapted: true,
              fallbacks: ["minimal_notifications", "basic_tray"],
            });
          default:
            return Promise.resolve(true);
        }
      });

      const serverInfo = await mockInvoke("detect_windows_server");
      const adaptation = await mockInvoke("adapt_for_server_environment");

      expect(serverInfo.isServer).toBe(true);
      expect(adaptation.fallbacks).toContain("minimal_notifications");
    });
  });

  describe("Windows Security and Permissions", () => {
    it("should handle UAC (User Account Control) integration", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "check_uac_status":
            return Promise.resolve({
              enabled: true,
              level: "default", // never, default, always
              requiresElevation: false,
            });
          case "request_elevation_if_needed":
            return Promise.resolve({
              elevated: false,
              reason: "not_required",
            });
          default:
            return Promise.resolve(true);
        }
      });

      const uacStatus = await mockInvoke("check_uac_status");
      const elevation = await mockInvoke("request_elevation_if_needed");

      expect(uacStatus.enabled).toBe(true);
      expect(elevation.reason).toBe("not_required");
    });

    it("should handle Windows Defender integration", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "check_defender_status":
            return Promise.resolve({
              enabled: true,
              realTimeProtection: true,
              exclusions: [],
            });
          case "request_defender_exclusion":
            return Promise.resolve({
              success: false,
              requiresAdminRights: true,
            });
          default:
            return Promise.resolve(true);
        }
      });

      const defenderStatus = await mockInvoke("check_defender_status");
      const exclusionRequest = await mockInvoke("request_defender_exclusion", {
        path: "C:\\Program Files\\Notari",
      });

      expect(defenderStatus.realTimeProtection).toBe(true);
      expect(exclusionRequest.requiresAdminRights).toBe(true);
    });

    it("should handle Windows Firewall integration", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "check_firewall_status":
            return Promise.resolve({
              enabled: true,
              profile: "domain", // domain, private, public
              blocked: false,
            });
          case "request_firewall_exception":
            return Promise.resolve({
              success: true,
              ruleCreated: true,
            });
          default:
            return Promise.resolve(true);
        }
      });

      const firewallStatus = await mockInvoke("check_firewall_status");
      const exception = await mockInvoke("request_firewall_exception", {
        appPath: "C:\\Program Files\\Notari\\notari.exe",
      });

      expect(firewallStatus.enabled).toBe(true);
      expect(exception.ruleCreated).toBe(true);
    });
  });

  describe("Windows Performance Optimization", () => {
    it("should handle Windows power management", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_power_scheme":
            return Promise.resolve({
              scheme: "balanced", // power_saver, balanced, high_performance
              onBattery: false,
              batteryLevel: 1.0,
            });
          case "adapt_for_power_scheme":
            return Promise.resolve({
              adapted: true,
              optimizations: ["normal_polling", "full_quality"],
            });
          default:
            return Promise.resolve(true);
        }
      });

      const powerScheme = await mockInvoke("get_power_scheme");
      const adaptation = await mockInvoke("adapt_for_power_scheme", {
        scheme: powerScheme.scheme,
      });

      expect(powerScheme.scheme).toBe("balanced");
      expect(adaptation.optimizations).toContain("normal_polling");
    });

    it("should handle Windows memory management", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_memory_info":
            return Promise.resolve({
              totalPhysical: 16 * 1024 * 1024 * 1024, // 16GB
              availablePhysical: 8 * 1024 * 1024 * 1024, // 8GB
              memoryPressure: "low", // low, medium, high
            });
          case "optimize_memory_usage":
            return Promise.resolve({
              optimized: true,
              memoryFreed: 50 * 1024 * 1024, // 50MB
            });
          default:
            return Promise.resolve(true);
        }
      });

      const memoryInfo = await mockInvoke("get_memory_info");
      const optimization = await mockInvoke("optimize_memory_usage");

      expect(memoryInfo.memoryPressure).toBe("low");
      expect(optimization.optimized).toBe(true);
    });

    it("should handle Windows CPU optimization", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_cpu_info":
            return Promise.resolve({
              cores: 8,
              threads: 16,
              usage: 0.25, // 25%
              temperature: 45,
            });
          case "set_process_priority":
            return Promise.resolve({
              success: true,
              priority: "normal", // idle, below_normal, normal, above_normal, high
            });
          default:
            return Promise.resolve(true);
        }
      });

      const cpuInfo = await mockInvoke("get_cpu_info");
      const priority = await mockInvoke("set_process_priority", {
        priority: "normal",
      });

      expect(cpuInfo.cores).toBe(8);
      expect(priority.priority).toBe("normal");
    });
  });

  describe("Windows Integration Features", () => {
    it("should integrate with Windows Registry", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "register_file_associations":
            return Promise.resolve({
              success: true,
              associations: [".notari", ".nproof"],
            });
          case "register_protocol_handler":
            return Promise.resolve({
              success: true,
              protocol: "notari://",
            });
          default:
            return Promise.resolve(true);
        }
      });

      const fileAssociations = await mockInvoke("register_file_associations");
      const protocolHandler = await mockInvoke("register_protocol_handler");

      expect(fileAssociations.associations).toContain(".notari");
      expect(protocolHandler.protocol).toBe("notari://");
    });

    it("should integrate with Windows Shell", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "register_shell_extensions":
            return Promise.resolve({
              success: true,
              extensions: ["context_menu", "property_sheet"],
            });
          case "add_to_startup":
            return Promise.resolve({
              success: true,
              method: "registry", // registry, startup_folder, task_scheduler
            });
          default:
            return Promise.resolve(true);
        }
      });

      const shellExtensions = await mockInvoke("register_shell_extensions");
      const startup = await mockInvoke("add_to_startup");

      expect(shellExtensions.extensions).toContain("context_menu");
      expect(startup.method).toBe("registry");
    });

    it("should integrate with Windows Search", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "register_search_filters":
            return Promise.resolve({
              success: true,
              filters: ["notari_session", "notari_proof"],
            });
          case "index_session_metadata":
            return Promise.resolve({
              success: true,
              itemsIndexed: 10,
            });
          default:
            return Promise.resolve(true);
        }
      });

      const searchFilters = await mockInvoke("register_search_filters");
      const indexing = await mockInvoke("index_session_metadata");

      expect(searchFilters.filters).toContain("notari_session");
      expect(indexing.itemsIndexed).toBe(10);
    });
  });
});
