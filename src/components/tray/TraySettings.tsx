import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useId, useState } from "react";
import type {
  HotkeyConfig,
  PopoverPosition,
  SettingsValidationError,
  ThemeMode,
  TrayNotificationSettings,
  TrayPreferences,
  TraySettings as TraySettingsType,
} from "../../types/tray.types";

interface TraySettingsProps {
  className?: string;
  onSettingsChange?: (settings: TraySettingsType) => void;
}

interface NotificationPreferences {
  enabled_types: Record<string, boolean>;
  show_sounds: boolean;
  throttle_duration_ms: number;
  max_queue_size: number;
  batch_similar: boolean;
}

export function TraySettings({
  className = "",
  onSettingsChange,
}: TraySettingsProps) {
  const themeSelectId = useId();
  const hotkeyInputId = useId();
  const hotkeyDisplayId = useId();
  const positionSelectId = useId();
  const [settings, setSettings] = useState<TraySettingsType>({
    preferences: {
      theme: "system",
      position: "auto",
      hotkey: "Cmd+Shift+N",
      showNotifications: true,
      autoHide: true,
      quickActions: ["start-session", "create-proof-pack", "recent-sessions"],
    },
    notifications: {
      sessionStart: true,
      sessionStop: true,
      proofPackCreated: true,
      blockchainAnchor: true,
      error: true,
      warning: true,
      info: false,
      showSounds: true,
    },
    hotkeys: [],
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<SettingsValidationError[]>([]);
  const [isEditingHotkey, setIsEditingHotkey] = useState(false);
  const [hotkeyInput, setHotkeyInput] = useState("");

  const loadSettings = useCallback(async () => {
    try {
      setIsLoading(true);

      // Load tray settings from backend
      const traySettingsResponse = await invoke<{
        success: boolean;
        data: {
          preferences: TrayPreferences;
          version: number;
          last_updated: string;
        };
      }>("get_tray_settings");

      // Load notification preferences
      const notificationResponse = await invoke<{
        success: boolean;
        data: NotificationPreferences;
      }>("get_notification_preferences");

      // Load hotkey configurations
      const hotkeys = await invoke<HotkeyConfig[]>("get_registered_hotkeys");

      let preferences: TrayPreferences = {
        theme: "system",
        position: "auto",
        hotkey: "Cmd+Shift+N",
        showNotifications: true,
        autoHide: true,
        quickActions: ["start-session", "create-proof-pack", "recent-sessions"],
      };

      // Use backend tray settings if available, otherwise fall back to localStorage
      if (traySettingsResponse.success && traySettingsResponse.data) {
        preferences = traySettingsResponse.data.preferences;
      } else {
        const savedPreferences = localStorage.getItem("tray-preferences");
        if (savedPreferences) {
          preferences = JSON.parse(savedPreferences);
        }
      }

      if (notificationResponse.success && notificationResponse.data) {
        const notificationData = notificationResponse.data;
        const notifications: TrayNotificationSettings = {
          sessionStart: notificationData.enabled_types.SessionStart ?? true,
          sessionStop: notificationData.enabled_types.SessionStop ?? true,
          proofPackCreated:
            notificationData.enabled_types.ProofPackCreated ?? true,
          blockchainAnchor:
            notificationData.enabled_types.BlockchainAnchor ?? true,
          error: notificationData.enabled_types.Error ?? true,
          warning: notificationData.enabled_types.Warning ?? true,
          info: notificationData.enabled_types.Info ?? false,
          showSounds: notificationData.show_sounds,
        };

        const newSettings: TraySettingsType = {
          preferences,
          notifications,
          hotkeys,
        };

        setSettings(newSettings);
        onSettingsChange?.(newSettings);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
      setErrors([{ field: "general", message: "Failed to load settings" }]);
    } finally {
      setIsLoading(false);
    }
  }, [onSettingsChange]);

  // Load settings on component mount
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const saveSettings = async () => {
    try {
      setIsSaving(true);
      setErrors([]);

      // Save tray preferences to backend
      const trayPreferencesResult = await invoke<{
        success: boolean;
        errors?: SettingsValidationError[];
      }>("update_tray_preferences", { preferences: settings.preferences });

      if (!trayPreferencesResult.success && trayPreferencesResult.errors) {
        setErrors(trayPreferencesResult.errors);
        return;
      }

      // Save notification preferences
      const notificationPreferences: NotificationPreferences = {
        enabled_types: {
          SessionStart: settings.notifications.sessionStart,
          SessionStop: settings.notifications.sessionStop,
          ProofPackCreated: settings.notifications.proofPackCreated,
          BlockchainAnchor: settings.notifications.blockchainAnchor,
          Error: settings.notifications.error,
          Warning: settings.notifications.warning,
          Info: settings.notifications.info,
        },
        show_sounds: settings.notifications.showSounds,
        throttle_duration_ms: 1000,
        max_queue_size: 10,
        batch_similar: true,
      };

      await invoke("update_notification_preferences", {
        request: { preferences: notificationPreferences },
      });

      // Keep localStorage as fallback
      localStorage.setItem(
        "tray-preferences",
        JSON.stringify(settings.preferences),
      );

      onSettingsChange?.(settings);
    } catch (error) {
      console.error("Failed to save settings:", error);
      setErrors([{ field: "general", message: "Failed to save settings" }]);
    } finally {
      setIsSaving(false);
    }
  };

  const updatePreferences = useCallback((updates: Partial<TrayPreferences>) => {
    setSettings((prev) => ({
      ...prev,
      preferences: { ...prev.preferences, ...updates },
    }));
  }, []);

  const updateNotifications = useCallback(
    (updates: Partial<TrayNotificationSettings>) => {
      setSettings((prev) => ({
        ...prev,
        notifications: { ...prev.notifications, ...updates },
      }));
    },
    [],
  );

  const handleHotkeyEdit = () => {
    setIsEditingHotkey(true);
    setHotkeyInput(settings.preferences.hotkey);
  };

  const handleHotkeySave = async () => {
    try {
      // Validate hotkey string
      await invoke("validate_hotkey_string", { keys: hotkeyInput });

      // Update the hotkey
      const hotkeyConfig: HotkeyConfig = {
        id: "toggle_popover",
        keys: hotkeyInput,
        description: "Toggle tray popover",
        enabled: true,
      };

      await invoke("update_hotkey", { config: hotkeyConfig });

      updatePreferences({ hotkey: hotkeyInput });
      setIsEditingHotkey(false);
    } catch (_error) {
      setErrors([{ field: "hotkey", message: "Invalid hotkey combination" }]);
    }
  };

  const handleHotkeyCancel = () => {
    setIsEditingHotkey(false);
    setHotkeyInput(settings.preferences.hotkey);
  };

  const getFieldError = (field: string) => {
    return errors.find((error) => error.field === field)?.message;
  };

  if (isLoading) {
    return (
      <div className={`p-4 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
            Loading settings...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-4 space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Settings
        </h2>
        <button
          type="button"
          onClick={saveSettings}
          disabled={isSaving}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* General Error */}
      {getFieldError("general") && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-600 dark:text-red-400">
            {getFieldError("general")}
          </p>
        </div>
      )}

      <div className="space-y-6">
        {/* Theme Settings */}
        <div>
          <label
            htmlFor={themeSelectId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Theme
          </label>
          <select
            id={themeSelectId}
            value={settings.preferences.theme}
            onChange={(e) =>
              updatePreferences({ theme: e.target.value as ThemeMode })
            }
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        {/* Hotkey Settings */}
        <div>
          <label
            htmlFor={isEditingHotkey ? hotkeyInputId : hotkeyDisplayId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Global Hotkey
          </label>
          <div className="flex space-x-2">
            {isEditingHotkey ? (
              <>
                <input
                  id={hotkeyInputId}
                  type="text"
                  value={hotkeyInput}
                  onChange={(e) => setHotkeyInput(e.target.value)}
                  placeholder="e.g., Cmd+Shift+N"
                  className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleHotkeySave}
                  className="px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={handleHotkeyCancel}
                  className="px-3 py-2 text-sm bg-gray-600 text-white rounded-md hover:bg-gray-700"
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <input
                  id={hotkeyDisplayId}
                  type="text"
                  value={settings.preferences.hotkey}
                  readOnly
                  className="flex-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={handleHotkeyEdit}
                  className="px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Edit
                </button>
              </>
            )}
          </div>
          {getFieldError("hotkey") && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">
              {getFieldError("hotkey")}
            </p>
          )}
        </div>

        {/* Notification Settings */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Notifications
          </h3>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifications.sessionStart}
                onChange={(e) =>
                  updateNotifications({ sessionStart: e.target.checked })
                }
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Session start notifications
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifications.sessionStop}
                onChange={(e) =>
                  updateNotifications({ sessionStop: e.target.checked })
                }
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Session stop notifications
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifications.proofPackCreated}
                onChange={(e) =>
                  updateNotifications({ proofPackCreated: e.target.checked })
                }
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Proof pack creation notifications
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifications.blockchainAnchor}
                onChange={(e) =>
                  updateNotifications({ blockchainAnchor: e.target.checked })
                }
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Blockchain anchoring notifications
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifications.error}
                onChange={(e) =>
                  updateNotifications({ error: e.target.checked })
                }
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Error notifications
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifications.warning}
                onChange={(e) =>
                  updateNotifications({ warning: e.target.checked })
                }
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Warning notifications
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifications.info}
                onChange={(e) =>
                  updateNotifications({ info: e.target.checked })
                }
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Info notifications
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifications.showSounds}
                onChange={(e) =>
                  updateNotifications({ showSounds: e.target.checked })
                }
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Play notification sounds
              </span>
            </label>
          </div>
        </div>

        {/* Position Settings */}
        <div>
          <label
            htmlFor={positionSelectId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Popover Position
          </label>
          <select
            id={positionSelectId}
            value={settings.preferences.position}
            onChange={(e) =>
              updatePreferences({ position: e.target.value as PopoverPosition })
            }
            className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="auto">Near tray icon</option>
            <option value="center">Center screen</option>
          </select>
        </div>

        {/* Behavior Settings */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Behavior
          </h3>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.preferences.autoHide}
                onChange={(e) =>
                  updatePreferences({ autoHide: e.target.checked })
                }
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Auto-hide popover when clicking outside
              </span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.preferences.showNotifications}
                onChange={(e) =>
                  updatePreferences({ showNotifications: e.target.checked })
                }
                className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Show system notifications
              </span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
