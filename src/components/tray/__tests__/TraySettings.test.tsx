import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TraySettings } from "../TraySettings";

// Mock Tauri API
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, "localStorage", {
  value: mockLocalStorage,
});

describe("TraySettings", () => {
  const mockOnSettingsChange = vi.fn();

  const mockNotificationPreferences = {
    enabled_types: {
      SessionStart: true,
      SessionStop: true,
      ProofPackCreated: true,
      BlockchainAnchor: false,
      Error: true,
      Warning: true,
      Info: false,
    },
    show_sounds: true,
    throttle_duration_ms: 1000,
    max_queue_size: 10,
    batch_similar: true,
  };

  const mockHotkeys = [
    {
      id: "toggle_popover",
      keys: "Cmd+Shift+N",
      description: "Toggle tray popover",
      enabled: true,
    },
  ];

  const mockTrayPreferences = {
    theme: "system" as const,
    position: "auto" as const,
    hotkey: "Cmd+Shift+N",
    showNotifications: true,
    autoHide: true,
    quickActions: ["start-session", "create-proof-pack", "recent-sessions"],
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const { invoke } = await import("@tauri-apps/api/core");
    const mockInvoke = vi.mocked(invoke);

    // Setup default mock responses
    mockInvoke.mockImplementation((command: string) => {
      switch (command) {
        case "get_tray_settings":
          return Promise.resolve({
            success: true,
            data: {
              preferences: mockTrayPreferences,
              version: 1,
              last_updated: new Date().toISOString(),
            },
          });
        case "get_notification_preferences":
          return Promise.resolve({
            success: true,
            data: mockNotificationPreferences,
          });
        case "get_registered_hotkeys":
          return Promise.resolve(mockHotkeys);
        case "update_tray_preferences":
          return Promise.resolve({ success: true });
        case "update_notification_preferences":
          return Promise.resolve({ success: true });
        case "validate_hotkey_string":
          return Promise.resolve();
        case "update_hotkey":
          return Promise.resolve();
        default:
          return Promise.reject(new Error(`Unknown command: ${command}`));
      }
    });

    mockLocalStorage.getItem.mockReturnValue(
      JSON.stringify(mockTrayPreferences),
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Component Rendering", () => {
    it("should render loading state initially", () => {
      render(<TraySettings />);

      expect(screen.getByText("Loading settings...")).toBeInTheDocument();
      expect(
        screen.getByText("Loading settings...").previousElementSibling,
      ).toHaveClass("animate-spin");
    });

    it("should render settings form after loading", async () => {
      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByText("Settings")).toBeInTheDocument();
      });

      expect(screen.getByLabelText("Theme")).toBeInTheDocument();
      expect(screen.getByText("Global Hotkey")).toBeInTheDocument();
      expect(screen.getByText("Notifications")).toBeInTheDocument();
      expect(screen.getByLabelText("Popover Position")).toBeInTheDocument();
      expect(screen.getByText("Behavior")).toBeInTheDocument();
    });

    it("should display error message when loading fails", async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const mockInvoke = vi.mocked(invoke);

      mockInvoke.mockRejectedValue(new Error("Failed to load"));

      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByText("Failed to load settings")).toBeInTheDocument();
      });
    });
  });

  describe("Settings Loading", () => {
    it("should load settings from backend and localStorage", async () => {
      render(<TraySettings onSettingsChange={mockOnSettingsChange} />);

      const { invoke } = await import("@tauri-apps/api/core");
      const mockInvoke = vi.mocked(invoke);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("get_tray_settings");
        expect(mockInvoke).toHaveBeenCalledWith("get_notification_preferences");
        expect(mockInvoke).toHaveBeenCalledWith("get_registered_hotkeys");
      });

      await waitFor(() => {
        expect(mockOnSettingsChange).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.objectContaining(mockTrayPreferences),
            notifications: expect.objectContaining({
              sessionStart: true,
              sessionStop: true,
              proofPackCreated: true,
              blockchainAnchor: false,
              error: true,
              warning: true,
              info: false,
              showSounds: true,
            }),
            hotkeys: mockHotkeys,
          }),
        );
      });
    });

    it("should use default preferences when localStorage is empty", async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      render(<TraySettings onSettingsChange={mockOnSettingsChange} />);

      await waitFor(() => {
        expect(mockOnSettingsChange).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.objectContaining({
              theme: "system",
              position: "auto",
              showNotifications: true,
              autoHide: true,
            }),
          }),
        );
      });
    });
  });

  describe("Theme Settings", () => {
    it("should update theme preference", async () => {
      const user = userEvent.setup();
      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByLabelText("Theme")).toBeInTheDocument();
      });

      const themeSelect = screen.getByLabelText("Theme");
      await user.selectOptions(themeSelect, "dark");

      expect(themeSelect).toHaveValue("dark");
    });

    it("should display all theme options", async () => {
      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByLabelText("Theme")).toBeInTheDocument();
      });

      const themeSelect = screen.getByLabelText("Theme");
      expect(themeSelect).toContainHTML(
        '<option value="system">System</option>',
      );
      expect(themeSelect).toContainHTML('<option value="light">Light</option>');
      expect(themeSelect).toContainHTML('<option value="dark">Dark</option>');
    });
  });

  describe("Hotkey Settings", () => {
    it("should display current hotkey in read-only mode", async () => {
      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByDisplayValue("Cmd+Shift+N")).toBeInTheDocument();
      });

      const hotkeyInput = screen.getByDisplayValue("Cmd+Shift+N");
      expect(hotkeyInput).toHaveAttribute("readonly");
    });

    it("should allow editing hotkey when edit button is clicked", async () => {
      const user = userEvent.setup();
      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });

      const editButton = screen.getByText("Edit");
      await user.click(editButton);

      expect(
        screen.getByPlaceholderText("e.g., Cmd+Shift+N"),
      ).toBeInTheDocument();
      expect(screen.getAllByText("Save")).toHaveLength(2); // Header save + hotkey save
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("should save valid hotkey changes", async () => {
      const user = userEvent.setup();
      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });

      // Enter edit mode
      await user.click(screen.getByText("Edit"));

      // Change hotkey
      const hotkeyInput = screen.getByPlaceholderText("e.g., Cmd+Shift+N");
      await user.clear(hotkeyInput);
      await user.type(hotkeyInput, "Ctrl+Alt+N");

      // Save changes (click the hotkey save button, not the header save)
      const saveButtons = screen.getAllByText("Save");
      const hotkeySaveButton = saveButtons.find((button) =>
        button.className.includes("bg-green-600"),
      );
      await user.click(hotkeySaveButton!);

      const { invoke } = await import("@tauri-apps/api/core");
      const mockInvoke = vi.mocked(invoke);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("validate_hotkey_string", {
          keys: "Ctrl+Alt+N",
        });
        expect(mockInvoke).toHaveBeenCalledWith("update_hotkey", {
          config: {
            id: "toggle_popover",
            keys: "Ctrl+Alt+N",
            description: "Toggle tray popover",
            enabled: true,
          },
        });
      });
    });

    it("should show error for invalid hotkey", async () => {
      const user = userEvent.setup();
      const { invoke } = await import("@tauri-apps/api/core");
      const mockInvoke = vi.mocked(invoke);

      mockInvoke.mockImplementation((command: string) => {
        if (command === "validate_hotkey_string") {
          return Promise.reject(new Error("Invalid hotkey"));
        }
        return Promise.resolve();
      });

      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });

      // Enter edit mode
      await user.click(screen.getByText("Edit"));

      // Enter invalid hotkey
      const hotkeyInput = screen.getByPlaceholderText("e.g., Cmd+Shift+N");
      await user.clear(hotkeyInput);
      await user.type(hotkeyInput, "InvalidKey");

      // Try to save (click the hotkey save button)
      const saveButtons = screen.getAllByText("Save");
      const hotkeySaveButton = saveButtons.find((button) =>
        button.className.includes("bg-green-600"),
      );
      await user.click(hotkeySaveButton!);

      await waitFor(() => {
        expect(
          screen.getByText("Invalid hotkey combination"),
        ).toBeInTheDocument();
      });
    });

    it("should cancel hotkey editing", async () => {
      const user = userEvent.setup();
      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByText("Edit")).toBeInTheDocument();
      });

      // Enter edit mode
      await user.click(screen.getByText("Edit"));

      // Change hotkey
      const hotkeyInput = screen.getByPlaceholderText("e.g., Cmd+Shift+N");
      await user.clear(hotkeyInput);
      await user.type(hotkeyInput, "Ctrl+Alt+N");

      // Cancel changes
      await user.click(screen.getByText("Cancel"));

      // Should return to read-only mode with original value
      expect(screen.getByDisplayValue("Cmd+Shift+N")).toBeInTheDocument();
      expect(screen.getByText("Edit")).toBeInTheDocument();
    });
  });

  describe("Notification Settings", () => {
    it("should display all notification checkboxes", async () => {
      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByText("Notifications")).toBeInTheDocument();
      });

      expect(
        screen.getByLabelText("Session start notifications"),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Session stop notifications"),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Proof pack creation notifications"),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Blockchain anchoring notifications"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Error notifications")).toBeInTheDocument();
      expect(
        screen.getByLabelText("Warning notifications"),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Info notifications")).toBeInTheDocument();
      expect(
        screen.getByLabelText("Play notification sounds"),
      ).toBeInTheDocument();
    });

    it("should reflect loaded notification preferences", async () => {
      render(<TraySettings />);

      await waitFor(() => {
        expect(
          screen.getByLabelText("Session start notifications"),
        ).toBeChecked();
        expect(
          screen.getByLabelText("Session stop notifications"),
        ).toBeChecked();
        expect(
          screen.getByLabelText("Proof pack creation notifications"),
        ).toBeChecked();
        expect(
          screen.getByLabelText("Blockchain anchoring notifications"),
        ).not.toBeChecked();
        expect(screen.getByLabelText("Error notifications")).toBeChecked();
        expect(screen.getByLabelText("Warning notifications")).toBeChecked();
        expect(screen.getByLabelText("Info notifications")).not.toBeChecked();
        expect(screen.getByLabelText("Play notification sounds")).toBeChecked();
      });
    });

    it("should update notification preferences when checkboxes are toggled", async () => {
      const user = userEvent.setup();
      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByLabelText("Info notifications")).toBeInTheDocument();
      });

      const infoCheckbox = screen.getByLabelText("Info notifications");
      await user.click(infoCheckbox);

      expect(infoCheckbox).toBeChecked();
    });
  });

  describe("Position Settings", () => {
    it("should display position options", async () => {
      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByLabelText("Popover Position")).toBeInTheDocument();
      });

      const positionSelect = screen.getByLabelText("Popover Position");
      expect(positionSelect).toContainHTML(
        '<option value="auto">Near tray icon</option>',
      );
      expect(positionSelect).toContainHTML(
        '<option value="center">Center screen</option>',
      );
    });

    it("should update position preference", async () => {
      const user = userEvent.setup();
      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByLabelText("Popover Position")).toBeInTheDocument();
      });

      const positionSelect = screen.getByLabelText("Popover Position");
      await user.selectOptions(positionSelect, "center");

      expect(positionSelect).toHaveValue("center");
    });
  });

  describe("Behavior Settings", () => {
    it("should display behavior checkboxes", async () => {
      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByText("Behavior")).toBeInTheDocument();
      });

      expect(
        screen.getByLabelText("Auto-hide popover when clicking outside"),
      ).toBeInTheDocument();
      expect(
        screen.getByLabelText("Show system notifications"),
      ).toBeInTheDocument();
    });

    it("should reflect loaded behavior preferences", async () => {
      render(<TraySettings />);

      await waitFor(() => {
        expect(
          screen.getByLabelText("Auto-hide popover when clicking outside"),
        ).toBeChecked();
        expect(
          screen.getByLabelText("Show system notifications"),
        ).toBeChecked();
      });
    });

    it("should update behavior preferences when checkboxes are toggled", async () => {
      const user = userEvent.setup();
      render(<TraySettings />);

      await waitFor(() => {
        expect(
          screen.getByLabelText("Auto-hide popover when clicking outside"),
        ).toBeInTheDocument();
      });

      const autoHideCheckbox = screen.getByLabelText(
        "Auto-hide popover when clicking outside",
      );
      await user.click(autoHideCheckbox);

      expect(autoHideCheckbox).not.toBeChecked();
    });
  });

  describe("Settings Persistence", () => {
    it("should save settings when save button is clicked", async () => {
      const user = userEvent.setup();
      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByText("Save")).toBeInTheDocument();
      });

      // Make some changes
      const themeSelect = screen.getByLabelText("Theme");
      await user.selectOptions(themeSelect, "dark");

      const infoCheckbox = screen.getByLabelText("Info notifications");
      await user.click(infoCheckbox);

      // Wait for state to update
      await waitFor(() => {
        expect(themeSelect).toHaveValue("dark");
        expect(infoCheckbox).toBeChecked();
      });

      // Save settings (click the header save button)
      const saveButtons = screen.getAllByText("Save");
      const headerSaveButton = saveButtons.find((button) =>
        button.className.includes("bg-blue-600"),
      );
      await user.click(headerSaveButton!);

      const { invoke } = await import("@tauri-apps/api/core");
      const mockInvoke = vi.mocked(invoke);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          "update_notification_preferences",
          {
            request: {
              preferences: expect.objectContaining({
                enabled_types: expect.objectContaining({
                  Info: true,
                }),
              }),
            },
          },
        );
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          "tray-preferences",
          expect.stringContaining('"theme":"dark"'),
        );
      });
    });

    it("should show saving state while saving", async () => {
      const user = userEvent.setup();
      let resolvePromise: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      const { invoke } = await import("@tauri-apps/api/core");
      const mockInvoke = vi.mocked(invoke);

      // Reset all mocks first
      mockInvoke.mockReset();

      // Setup mocks for loading
      mockInvoke.mockImplementation((command: string) => {
        switch (command) {
          case "get_tray_settings":
            return Promise.resolve({
              success: true,
              data: {
                preferences: mockTrayPreferences,
                version: 1,
                last_updated: new Date().toISOString(),
              },
            });
          case "get_notification_preferences":
            return Promise.resolve({
              success: true,
              data: mockNotificationPreferences,
            });
          case "get_registered_hotkeys":
            return Promise.resolve(mockHotkeys);
          case "update_tray_preferences":
            return Promise.resolve({ success: true });
          case "update_notification_preferences":
            return savePromise; // This will hang until resolved
          default:
            return Promise.resolve();
        }
      });

      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByText("Save")).toBeInTheDocument();
      });

      const saveButtons = screen.getAllByText("Save");
      const headerSaveButton = saveButtons.find((button) =>
        button.className.includes("bg-blue-600"),
      );
      await user.click(headerSaveButton!);

      // Check saving state
      await waitFor(() => {
        expect(screen.getByText("Saving...")).toBeInTheDocument();
      });
      expect(headerSaveButton).toBeDisabled();

      // Resolve the promise
      resolvePromise!();

      // Check that saving state is cleared
      await waitFor(() => {
        expect(screen.getByText("Save")).toBeInTheDocument();
        expect(headerSaveButton).not.toBeDisabled();
      });
    });

    it("should show error when saving fails", async () => {
      const user = userEvent.setup();
      const { invoke } = await import("@tauri-apps/api/core");
      const mockInvoke = vi.mocked(invoke);

      mockInvoke.mockImplementation((command: string) => {
        if (command === "update_notification_preferences") {
          return Promise.reject(new Error("Save failed"));
        }
        return Promise.resolve();
      });

      render(<TraySettings />);

      await waitFor(() => {
        expect(screen.getByText("Save")).toBeInTheDocument();
      });

      const saveButtons = screen.getAllByText("Save");
      const headerSaveButton = saveButtons.find((button) =>
        button.className.includes("bg-blue-600"),
      );
      await user.click(headerSaveButton!);

      await waitFor(() => {
        expect(screen.getByText("Failed to save settings")).toBeInTheDocument();
      });
    });
  });

  describe("Settings Validation", () => {
    it("should validate settings before saving", async () => {
      const user = userEvent.setup();
      render(<TraySettings onSettingsChange={mockOnSettingsChange} />);

      await waitFor(() => {
        expect(screen.getByText("Save")).toBeInTheDocument();
      });

      // Make changes and save
      const saveButtons = screen.getAllByText("Save");
      const headerSaveButton = saveButtons.find((button) =>
        button.className.includes("bg-blue-600"),
      );
      await user.click(headerSaveButton!);

      await waitFor(() => {
        expect(mockOnSettingsChange).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.any(Object),
            notifications: expect.any(Object),
            hotkeys: expect.any(Array),
          }),
        );
      });
    });

    it("should call onSettingsChange when settings are loaded", async () => {
      render(<TraySettings onSettingsChange={mockOnSettingsChange} />);

      await waitFor(() => {
        expect(mockOnSettingsChange).toHaveBeenCalledWith(
          expect.objectContaining({
            preferences: expect.any(Object),
            notifications: expect.any(Object),
            hotkeys: expect.any(Array),
          }),
        );
      });
    });
  });
});
