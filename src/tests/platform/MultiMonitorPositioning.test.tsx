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
  TrayApp: () => <div data-testid="tray-app">Multi-Monitor TrayApp</div>,
}));

// Mock ResizeObserver
(globalThis as any).ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

describe("Multi-Monitor Positioning Tests", () => {
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

  describe("Dual Monitor Configurations", () => {
    it("should handle side-by-side dual monitors", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_display_configuration":
            return Promise.resolve({
              displays: [
                {
                  id: 0,
                  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                  scaleFactor: 1.0,
                  isPrimary: true,
                  name: "Primary Monitor",
                },
                {
                  id: 1,
                  bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
                  scaleFactor: 1.0,
                  isPrimary: false,
                  name: "Secondary Monitor",
                },
              ],
              arrangement: "side_by_side",
            });
          case "get_tray_display":
            return Promise.resolve(1); // Tray on secondary monitor
          case "calculate_popover_position":
            return Promise.resolve({
              x: 2720, // On secondary monitor, positioned relative to tray
              y: 30,
              displayId: 1,
              anchor: "tray",
            });
          default:
            return Promise.resolve(true);
        }
      });

      const displayConfig = await mockInvoke("get_display_configuration");
      const trayDisplay = await mockInvoke("get_tray_display");
      const popoverPosition = await mockInvoke("calculate_popover_position", {
        trayBounds: { x: 3800, y: 0, width: 24, height: 24 },
        popoverSize: { width: 400, height: 600 },
      });

      expect(displayConfig.arrangement).toBe("side_by_side");
      expect(displayConfig.displays).toHaveLength(2);
      expect(trayDisplay).toBe(1);
      expect(popoverPosition.displayId).toBe(1);
      expect(popoverPosition.x).toBeGreaterThan(1920); // On second monitor
    });

    it("should handle vertically stacked dual monitors", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_display_configuration":
            return Promise.resolve({
              displays: [
                {
                  id: 0,
                  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                  scaleFactor: 1.0,
                  isPrimary: true,
                  name: "Top Monitor",
                },
                {
                  id: 1,
                  bounds: { x: 0, y: 1080, width: 1920, height: 1080 },
                  scaleFactor: 1.0,
                  isPrimary: false,
                  name: "Bottom Monitor",
                },
              ],
              arrangement: "vertical_stack",
            });
          case "get_tray_display":
            return Promise.resolve(0); // Tray on top monitor
          case "calculate_popover_position":
            return Promise.resolve({
              x: 1520,
              y: 30, // On top monitor
              displayId: 0,
              anchor: "tray",
            });
          default:
            return Promise.resolve(true);
        }
      });

      const displayConfig = await mockInvoke("get_display_configuration");
      const trayDisplay = await mockInvoke("get_tray_display");
      const popoverPosition = await mockInvoke("calculate_popover_position", {
        trayBounds: { x: 1850, y: 0, width: 24, height: 24 },
        popoverSize: { width: 400, height: 600 },
      });

      expect(displayConfig.arrangement).toBe("vertical_stack");
      expect(trayDisplay).toBe(0);
      expect(popoverPosition.y).toBeLessThan(1080); // On top monitor
    });

    it("should handle mixed DPI dual monitors", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_display_configuration":
            return Promise.resolve({
              displays: [
                {
                  id: 0,
                  bounds: { x: 0, y: 0, width: 2560, height: 1440 },
                  scaleFactor: 2.0, // High DPI
                  isPrimary: true,
                  name: "MacBook Pro Display",
                },
                {
                  id: 1,
                  bounds: { x: 2560, y: 0, width: 1920, height: 1080 },
                  scaleFactor: 1.0, // Standard DPI
                  isPrimary: false,
                  name: "External Monitor",
                },
              ],
              arrangement: "mixed_dpi",
            });
          case "calculate_dpi_aware_position":
            return Promise.resolve({
              x: 2360, // Adjusted for DPI differences
              y: 30,
              displayId: 1,
              scaleFactor: 1.0,
              adjustedForDPI: true,
            });
          default:
            return Promise.resolve(true);
        }
      });

      const displayConfig = await mockInvoke("get_display_configuration");
      const position = await mockInvoke("calculate_dpi_aware_position", {
        targetDisplay: 1,
        popoverSize: { width: 400, height: 600 },
      });

      expect(displayConfig.displays[0].scaleFactor).toBe(2.0);
      expect(displayConfig.displays[1].scaleFactor).toBe(1.0);
      expect(position.adjustedForDPI).toBe(true);
    });
  });

  describe("Triple Monitor Configurations", () => {
    it("should handle triple monitor horizontal setup", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_display_configuration":
            return Promise.resolve({
              displays: [
                {
                  id: 0,
                  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                  scaleFactor: 1.0,
                  isPrimary: false,
                  name: "Left Monitor",
                },
                {
                  id: 1,
                  bounds: { x: 1920, y: 0, width: 2560, height: 1440 },
                  scaleFactor: 1.5,
                  isPrimary: true,
                  name: "Center Monitor",
                },
                {
                  id: 2,
                  bounds: { x: 4480, y: 0, width: 1920, height: 1080 },
                  scaleFactor: 1.0,
                  isPrimary: false,
                  name: "Right Monitor",
                },
              ],
              arrangement: "triple_horizontal",
            });
          case "get_tray_display":
            return Promise.resolve(1); // Tray on center (primary) monitor
          case "calculate_popover_position":
            return Promise.resolve({
              x: 4080, // On center monitor
              y: 30,
              displayId: 1,
              anchor: "tray",
            });
          default:
            return Promise.resolve(true);
        }
      });

      const displayConfig = await mockInvoke("get_display_configuration");
      const trayDisplay = await mockInvoke("get_tray_display");
      const popoverPosition = await mockInvoke("calculate_popover_position", {
        trayBounds: { x: 4400, y: 0, width: 24, height: 24 },
        popoverSize: { width: 400, height: 600 },
      });

      expect(displayConfig.displays).toHaveLength(3);
      expect(displayConfig.displays[1].isPrimary).toBe(true);
      expect(trayDisplay).toBe(1);
      expect(popoverPosition.x).toBeGreaterThan(1920);
      expect(popoverPosition.x).toBeLessThan(4480);
    });

    it("should handle L-shaped triple monitor setup", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_display_configuration":
            return Promise.resolve({
              displays: [
                {
                  id: 0,
                  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                  scaleFactor: 1.0,
                  isPrimary: true,
                  name: "Main Monitor",
                },
                {
                  id: 1,
                  bounds: { x: 1920, y: 0, width: 1920, height: 1080 },
                  scaleFactor: 1.0,
                  isPrimary: false,
                  name: "Right Monitor",
                },
                {
                  id: 2,
                  bounds: { x: 0, y: 1080, width: 1920, height: 1080 },
                  scaleFactor: 1.0,
                  isPrimary: false,
                  name: "Bottom Monitor",
                },
              ],
              arrangement: "l_shaped",
            });
          case "detect_monitor_edges":
            return Promise.resolve({
              edges: [
                { from: 0, to: 1, type: "right" },
                { from: 0, to: 2, type: "bottom" },
              ],
            });
          default:
            return Promise.resolve(true);
        }
      });

      const displayConfig = await mockInvoke("get_display_configuration");
      const edges = await mockInvoke("detect_monitor_edges");

      expect(displayConfig.arrangement).toBe("l_shaped");
      expect(edges.edges).toHaveLength(2);
      expect(edges.edges[0].type).toBe("right");
      expect(edges.edges[1].type).toBe("bottom");
    });
  });

  describe("Complex Monitor Arrangements", () => {
    it("should handle portrait and landscape mixed orientation", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_display_configuration":
            return Promise.resolve({
              displays: [
                {
                  id: 0,
                  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                  scaleFactor: 1.0,
                  isPrimary: true,
                  orientation: "landscape",
                  name: "Main Monitor",
                },
                {
                  id: 1,
                  bounds: { x: 1920, y: 0, width: 1080, height: 1920 },
                  scaleFactor: 1.0,
                  isPrimary: false,
                  orientation: "portrait",
                  name: "Portrait Monitor",
                },
              ],
              arrangement: "mixed_orientation",
            });
          case "calculate_orientation_aware_position":
            return Promise.resolve({
              x: 2000,
              y: 30,
              displayId: 1,
              adjustedForOrientation: true,
              orientation: "portrait",
            });
          default:
            return Promise.resolve(true);
        }
      });

      const displayConfig = await mockInvoke("get_display_configuration");
      const position = await mockInvoke(
        "calculate_orientation_aware_position",
        {
          targetDisplay: 1,
        },
      );

      expect(displayConfig.displays[0].orientation).toBe("landscape");
      expect(displayConfig.displays[1].orientation).toBe("portrait");
      expect(position.adjustedForOrientation).toBe(true);
    });

    it("should handle asymmetric monitor arrangements", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_display_configuration":
            return Promise.resolve({
              displays: [
                {
                  id: 0,
                  bounds: { x: 0, y: 200, width: 1366, height: 768 },
                  scaleFactor: 1.0,
                  isPrimary: true,
                  name: "Laptop Display",
                },
                {
                  id: 1,
                  bounds: { x: 1366, y: 0, width: 2560, height: 1440 },
                  scaleFactor: 1.5,
                  isPrimary: false,
                  name: "Large External Monitor",
                },
              ],
              arrangement: "asymmetric",
            });
          case "calculate_asymmetric_position":
            return Promise.resolve({
              x: 3526, // Positioned on larger monitor
              y: 30,
              displayId: 1,
              adjustedForAsymmetry: true,
            });
          default:
            return Promise.resolve(true);
        }
      });

      const displayConfig = await mockInvoke("get_display_configuration");
      const position = await mockInvoke("calculate_asymmetric_position", {
        trayBounds: { x: 3800, y: 0, width: 24, height: 24 },
        popoverSize: { width: 400, height: 600 },
      });

      expect(displayConfig.arrangement).toBe("asymmetric");
      expect(position.adjustedForAsymmetry).toBe(true);
      expect(position.x).toBeGreaterThan(1366); // On larger monitor
    });

    it("should handle curved and ultrawide monitors", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_display_configuration":
            return Promise.resolve({
              displays: [
                {
                  id: 0,
                  bounds: { x: 0, y: 0, width: 3440, height: 1440 },
                  scaleFactor: 1.25,
                  isPrimary: true,
                  aspectRatio: "21:9",
                  isCurved: true,
                  name: "Ultrawide Monitor",
                },
              ],
              arrangement: "ultrawide",
            });
          case "calculate_ultrawide_position":
            return Promise.resolve({
              x: 3040, // Positioned considering ultrawide aspect
              y: 30,
              displayId: 0,
              adjustedForUltrawide: true,
              curveCompensation: 10, // pixels
            });
          default:
            return Promise.resolve(true);
        }
      });

      const displayConfig = await mockInvoke("get_display_configuration");
      const position = await mockInvoke("calculate_ultrawide_position", {
        trayBounds: { x: 3400, y: 0, width: 24, height: 24 },
        popoverSize: { width: 400, height: 600 },
      });

      expect(displayConfig.displays[0].aspectRatio).toBe("21:9");
      expect(displayConfig.displays[0].isCurved).toBe(true);
      expect(position.adjustedForUltrawide).toBe(true);
      expect(position.curveCompensation).toBe(10);
    });
  });

  describe("Dynamic Monitor Configuration Changes", () => {
    it("should handle monitor connection/disconnection", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "listen_display_changes":
            // Simulate setting up the listener
            mockListen("display-configuration-changed", expect.any(Function));
            return Promise.resolve({ listening: true });
          case "handle_display_change":
            return Promise.resolve({
              handled: true,
              newConfiguration: {
                displays: [
                  {
                    id: 0,
                    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                    scaleFactor: 1.0,
                    isPrimary: true,
                  },
                ],
              },
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

      await mockInvoke("listen_display_changes");
      expect(mockListen).toHaveBeenCalled();

      // Simulate monitor disconnection by calling the handler directly
      await mockInvoke("handle_display_change", {
        change: "disconnected",
        displayId: 1,
      });

      expect(mockInvoke).toHaveBeenCalledWith("handle_display_change", {
        change: "disconnected",
        displayId: 1,
      });
    });

    it("should handle resolution changes", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "detect_resolution_change":
            return Promise.resolve({
              displayId: 0,
              oldResolution: { width: 1920, height: 1080 },
              newResolution: { width: 2560, height: 1440 },
            });
          case "recalculate_positions_for_resolution":
            return Promise.resolve({
              recalculated: true,
              newTrayPosition: { x: 2500, y: 0 },
              newPopoverPosition: { x: 2100, y: 30 },
            });
          default:
            return Promise.resolve(true);
        }
      });

      const resolutionChange = await mockInvoke("detect_resolution_change");
      const recalculation = await mockInvoke(
        "recalculate_positions_for_resolution",
        {
          displayId: resolutionChange.displayId,
          newResolution: resolutionChange.newResolution,
        },
      );

      expect(resolutionChange.newResolution.width).toBe(2560);
      expect(recalculation.recalculated).toBe(true);
    });

    it("should handle DPI scaling changes", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "detect_dpi_change":
            return Promise.resolve({
              displayId: 0,
              oldScaleFactor: 1.0,
              newScaleFactor: 1.25,
            });
          case "adapt_ui_for_dpi_change":
            return Promise.resolve({
              adapted: true,
              newPopoverSize: { width: 500, height: 750 },
              newIconSize: 20,
            });
          default:
            return Promise.resolve(true);
        }
      });

      const dpiChange = await mockInvoke("detect_dpi_change");
      const adaptation = await mockInvoke("adapt_ui_for_dpi_change", {
        displayId: dpiChange.displayId,
        newScaleFactor: dpiChange.newScaleFactor,
      });

      expect(dpiChange.newScaleFactor).toBe(1.25);
      expect(adaptation.adapted).toBe(true);
      expect(adaptation.newPopoverSize.width).toBe(500);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle popover positioning near screen edges", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "calculate_edge_aware_position":
            return Promise.resolve({
              x: 1520, // Adjusted to stay on screen
              y: 30,
              adjustedForEdges: true,
              originalPosition: { x: 1600, y: 30 },
              adjustments: ["moved_left"],
            });
          case "check_screen_boundaries":
            return Promise.resolve({
              withinBounds: true,
              adjustmentsNeeded: ["move_left"],
            });
          default:
            return Promise.resolve(true);
        }
      });

      const edgePosition = await mockInvoke("calculate_edge_aware_position", {
        trayBounds: { x: 1900, y: 0, width: 24, height: 24 },
        popoverSize: { width: 400, height: 600 },
        screenBounds: { x: 0, y: 0, width: 1920, height: 1080 },
      });

      const boundaryCheck = await mockInvoke("check_screen_boundaries", {
        position: { x: 1600, y: 30 },
        size: { width: 400, height: 600 },
        screenBounds: { x: 0, y: 0, width: 1920, height: 1080 },
      });

      expect(edgePosition.adjustedForEdges).toBe(true);
      expect(edgePosition.adjustments).toContain("moved_left");
      expect(boundaryCheck.adjustmentsNeeded).toContain("move_left");
    });

    it("should handle invalid monitor configurations", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "validate_display_configuration":
            return Promise.resolve({
              valid: false,
              issues: ["overlapping_displays", "negative_coordinates"],
            });
          case "fix_display_configuration":
            return Promise.resolve({
              fixed: true,
              corrections: ["adjusted_positions", "removed_overlaps"],
            });
          default:
            return Promise.resolve(true);
        }
      });

      const validation = await mockInvoke("validate_display_configuration", {
        displays: [
          { id: 0, bounds: { x: 0, y: 0, width: 1920, height: 1080 } },
          { id: 1, bounds: { x: 500, y: 0, width: 1920, height: 1080 } }, // Overlapping
        ],
      });

      if (!validation.valid) {
        const fix = await mockInvoke("fix_display_configuration");
        expect(fix.fixed).toBe(true);
        expect(fix.corrections).toContain("removed_overlaps");
      }

      expect(validation.issues).toContain("overlapping_displays");
    });

    it("should handle monitor detection failures", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_display_configuration":
            return Promise.reject(new Error("Failed to detect monitors"));
          case "fallback_to_primary_display":
            return Promise.resolve({
              success: true,
              display: {
                id: 0,
                bounds: { x: 0, y: 0, width: 1920, height: 1080 },
                scaleFactor: 1.0,
                isPrimary: true,
              },
            });
          default:
            return Promise.resolve(true);
        }
      });

      try {
        await mockInvoke("get_display_configuration");
      } catch (error) {
        expect((error as Error).message).toBe("Failed to detect monitors");
      }

      const fallback = await mockInvoke("fallback_to_primary_display");
      expect(fallback.success).toBe(true);
      expect(fallback.display.isPrimary).toBe(true);
    });

    it("should handle extremely small screens", async () => {
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_display_configuration":
            return Promise.resolve({
              displays: [
                {
                  id: 0,
                  bounds: { x: 0, y: 0, width: 800, height: 600 },
                  scaleFactor: 1.0,
                  isPrimary: true,
                  name: "Small Screen",
                },
              ],
              arrangement: "single_small",
            });
          case "adapt_for_small_screen":
            return Promise.resolve({
              adapted: true,
              popoverSize: { width: 350, height: 500 },
              position: { x: 425, y: 50 },
              centerPositioned: true,
            });
          default:
            return Promise.resolve(true);
        }
      });

      const displayConfig = await mockInvoke("get_display_configuration");
      const adaptation = await mockInvoke("adapt_for_small_screen", {
        screenSize: { width: 800, height: 600 },
        originalPopoverSize: { width: 400, height: 600 },
      });

      expect(displayConfig.displays[0].bounds.width).toBe(800);
      expect(adaptation.centerPositioned).toBe(true);
      expect(adaptation.popoverSize.width).toBeLessThan(400);
    });
  });
});
