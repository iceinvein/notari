use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};
use thiserror::Error;

/// Tray preferences structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrayPreferences {
    pub theme: String,
    pub position: String,
    pub hotkey: String,
    pub show_notifications: bool,
    pub auto_hide: bool,
    pub quick_actions: Vec<String>,
}

impl Default for TrayPreferences {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            position: "auto".to_string(),
            hotkey: if cfg!(target_os = "macos") {
                "Cmd+Shift+N".to_string()
            } else {
                "Ctrl+Shift+N".to_string()
            },
            show_notifications: true,
            auto_hide: true,
            quick_actions: vec![
                "start-session".to_string(),
                "create-proof-pack".to_string(),
                "recent-sessions".to_string(),
            ],
        }
    }
}

/// Complete tray settings structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraySettings {
    pub preferences: TrayPreferences,
    pub version: u32,
    pub last_updated: chrono::DateTime<chrono::Utc>,
}

impl Default for TraySettings {
    fn default() -> Self {
        Self {
            preferences: TrayPreferences::default(),
            version: 1,
            last_updated: chrono::Utc::now(),
        }
    }
}

/// Settings validation error
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsValidationError {
    pub field: String,
    pub message: String,
}

/// Settings operation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsResult {
    pub success: bool,
    pub errors: Option<Vec<SettingsValidationError>>,
    pub data: Option<serde_json::Value>,
}

/// Settings manager errors
#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
    #[error("Validation error: {0}")]
    ValidationError(String),
    #[error("Settings file not found")]
    NotFound,
}

/// Settings manager for tray preferences
pub struct SettingsManager {
    app_handle: AppHandle,
    settings_path: PathBuf,
}

impl SettingsManager {
    pub fn new(app_handle: AppHandle) -> Result<Self, SettingsError> {
        let app_data_dir = app_handle.path().app_data_dir().map_err(|e| {
            SettingsError::IoError(std::io::Error::new(
                std::io::ErrorKind::NotFound,
                format!("Failed to get app data directory: {}", e),
            ))
        })?;

        // Ensure the directory exists
        fs::create_dir_all(&app_data_dir)?;

        let settings_path = app_data_dir.join("tray_settings.json");

        Ok(Self {
            app_handle,
            settings_path,
        })
    }

    /// Load tray settings from file
    pub fn load_settings(&self) -> Result<TraySettings, SettingsError> {
        if !self.settings_path.exists() {
            return Ok(TraySettings::default());
        }

        let content = fs::read_to_string(&self.settings_path)?;
        let settings: TraySettings = serde_json::from_str(&content)?;

        Ok(settings)
    }

    /// Save tray settings to file
    pub fn save_settings(&self, settings: &TraySettings) -> Result<(), SettingsError> {
        let content = serde_json::to_string_pretty(settings)?;
        fs::write(&self.settings_path, content)?;

        Ok(())
    }

    /// Update tray preferences
    pub fn update_preferences(
        &self,
        preferences: TrayPreferences,
    ) -> Result<TraySettings, SettingsError> {
        // Validate preferences
        self.validate_preferences(&preferences)?;

        let mut settings = self.load_settings().unwrap_or_default();
        settings.preferences = preferences;
        settings.last_updated = chrono::Utc::now();
        settings.version += 1;

        self.save_settings(&settings)?;

        Ok(settings)
    }

    /// Validate tray preferences
    fn validate_preferences(&self, preferences: &TrayPreferences) -> Result<(), SettingsError> {
        let mut errors = Vec::new();

        // Validate theme
        if !["light", "dark", "system"].contains(&preferences.theme.as_str()) {
            errors.push(SettingsValidationError {
                field: "theme".to_string(),
                message: "Theme must be 'light', 'dark', or 'system'".to_string(),
            });
        }

        // Validate position
        if !["auto", "center"].contains(&preferences.position.as_str()) {
            errors.push(SettingsValidationError {
                field: "position".to_string(),
                message: "Position must be 'auto' or 'center'".to_string(),
            });
        }

        // Validate hotkey format (basic validation)
        if preferences.hotkey.is_empty() {
            errors.push(SettingsValidationError {
                field: "hotkey".to_string(),
                message: "Hotkey cannot be empty".to_string(),
            });
        }

        // Validate quick actions
        let valid_actions = [
            "start-session",
            "stop-session",
            "create-proof-pack",
            "recent-sessions",
            "settings",
            "verify-proof",
        ];

        for action in &preferences.quick_actions {
            if !valid_actions.contains(&action.as_str()) {
                errors.push(SettingsValidationError {
                    field: "quick_actions".to_string(),
                    message: format!("Invalid quick action: {}", action),
                });
            }
        }

        if !errors.is_empty() {
            return Err(SettingsError::ValidationError(
                serde_json::to_string(&errors).unwrap_or_default(),
            ));
        }

        Ok(())
    }

    /// Reset settings to defaults
    pub fn reset_settings(&self) -> Result<TraySettings, SettingsError> {
        let settings = TraySettings::default();
        self.save_settings(&settings)?;
        Ok(settings)
    }

    /// Export settings as JSON
    pub fn export_settings(&self) -> Result<String, SettingsError> {
        let settings = self.load_settings()?;
        Ok(serde_json::to_string_pretty(&settings)?)
    }

    /// Import settings from JSON
    pub fn import_settings(&self, json_data: &str) -> Result<TraySettings, SettingsError> {
        let settings: TraySettings = serde_json::from_str(json_data)?;

        // Validate the imported preferences
        self.validate_preferences(&settings.preferences)?;

        self.save_settings(&settings)?;
        Ok(settings)
    }
}

/// State wrapper for settings manager
pub type SettingsManagerState = std::sync::Arc<std::sync::Mutex<SettingsManager>>;

/// Initialize settings manager state
pub fn init_settings_state(app_handle: AppHandle) -> Result<SettingsManagerState, SettingsError> {
    let manager = SettingsManager::new(app_handle)?;
    Ok(std::sync::Arc::new(std::sync::Mutex::new(manager)))
}

/// Get current tray settings
#[tauri::command]
pub async fn get_tray_settings(
    state: State<'_, SettingsManagerState>,
) -> Result<SettingsResult, String> {
    let manager = state.lock().map_err(|e| e.to_string())?;

    match manager.load_settings() {
        Ok(settings) => Ok(SettingsResult {
            success: true,
            errors: None,
            data: Some(serde_json::to_value(settings).map_err(|e| e.to_string())?),
        }),
        Err(e) => Err(format!("Failed to load settings: {}", e)),
    }
}

/// Update tray preferences
#[tauri::command]
pub async fn update_tray_preferences(
    preferences: TrayPreferences,
    state: State<'_, SettingsManagerState>,
) -> Result<SettingsResult, String> {
    let manager = state.lock().map_err(|e| e.to_string())?;

    match manager.update_preferences(preferences) {
        Ok(settings) => Ok(SettingsResult {
            success: true,
            errors: None,
            data: Some(serde_json::to_value(settings).map_err(|e| e.to_string())?),
        }),
        Err(SettingsError::ValidationError(errors_json)) => {
            let errors: Vec<SettingsValidationError> = serde_json::from_str(&errors_json)
                .unwrap_or_else(|_| {
                    vec![SettingsValidationError {
                        field: "general".to_string(),
                        message: "Validation failed".to_string(),
                    }]
                });

            Ok(SettingsResult {
                success: false,
                errors: Some(errors),
                data: None,
            })
        }
        Err(e) => Err(format!("Failed to update preferences: {}", e)),
    }
}

/// Reset tray settings to defaults
#[tauri::command]
pub async fn reset_tray_settings(
    state: State<'_, SettingsManagerState>,
) -> Result<SettingsResult, String> {
    let manager = state.lock().map_err(|e| e.to_string())?;

    match manager.reset_settings() {
        Ok(settings) => Ok(SettingsResult {
            success: true,
            errors: None,
            data: Some(serde_json::to_value(settings).map_err(|e| e.to_string())?),
        }),
        Err(e) => Err(format!("Failed to reset settings: {}", e)),
    }
}

/// Export tray settings
#[tauri::command]
pub async fn export_tray_settings(
    state: State<'_, SettingsManagerState>,
) -> Result<String, String> {
    let manager = state.lock().map_err(|e| e.to_string())?;
    manager.export_settings().map_err(|e| e.to_string())
}

/// Import tray settings
#[tauri::command]
pub async fn import_tray_settings(
    json_data: String,
    state: State<'_, SettingsManagerState>,
) -> Result<SettingsResult, String> {
    let manager = state.lock().map_err(|e| e.to_string())?;

    match manager.import_settings(&json_data) {
        Ok(settings) => Ok(SettingsResult {
            success: true,
            errors: None,
            data: Some(serde_json::to_value(settings).map_err(|e| e.to_string())?),
        }),
        Err(SettingsError::ValidationError(errors_json)) => {
            let errors: Vec<SettingsValidationError> = serde_json::from_str(&errors_json)
                .unwrap_or_else(|_| {
                    vec![SettingsValidationError {
                        field: "general".to_string(),
                        message: "Validation failed".to_string(),
                    }]
                });

            Ok(SettingsResult {
                success: false,
                errors: Some(errors),
                data: None,
            })
        }
        Err(e) => Err(format!("Failed to import settings: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_manager() -> (TempDir, PathBuf) {
        let temp_dir = TempDir::new().unwrap();
        let settings_path = temp_dir.path().join("test_settings.json");
        (temp_dir, settings_path)
    }

    fn create_test_settings_manager(settings_path: PathBuf) -> TestSettingsManager {
        TestSettingsManager { settings_path }
    }

    // Test-only settings manager that doesn't require AppHandle
    struct TestSettingsManager {
        settings_path: PathBuf,
    }

    impl TestSettingsManager {
        fn load_settings(&self) -> Result<TraySettings, SettingsError> {
            if !self.settings_path.exists() {
                return Ok(TraySettings::default());
            }

            let content = fs::read_to_string(&self.settings_path)?;
            let settings: TraySettings = serde_json::from_str(&content)?;
            Ok(settings)
        }

        fn save_settings(&self, settings: &TraySettings) -> Result<(), SettingsError> {
            let content = serde_json::to_string_pretty(settings)?;
            fs::write(&self.settings_path, content)?;
            Ok(())
        }

        fn update_preferences(
            &self,
            preferences: TrayPreferences,
        ) -> Result<TraySettings, SettingsError> {
            self.validate_preferences(&preferences)?;

            let mut settings = self.load_settings().unwrap_or_default();
            settings.preferences = preferences;
            settings.last_updated = chrono::Utc::now();
            settings.version += 1;

            self.save_settings(&settings)?;
            Ok(settings)
        }

        fn validate_preferences(&self, preferences: &TrayPreferences) -> Result<(), SettingsError> {
            let mut errors = Vec::new();

            if !["light", "dark", "system"].contains(&preferences.theme.as_str()) {
                errors.push(SettingsValidationError {
                    field: "theme".to_string(),
                    message: "Theme must be 'light', 'dark', or 'system'".to_string(),
                });
            }

            if !["auto", "center"].contains(&preferences.position.as_str()) {
                errors.push(SettingsValidationError {
                    field: "position".to_string(),
                    message: "Position must be 'auto' or 'center'".to_string(),
                });
            }

            if preferences.hotkey.is_empty() {
                errors.push(SettingsValidationError {
                    field: "hotkey".to_string(),
                    message: "Hotkey cannot be empty".to_string(),
                });
            }

            let valid_actions = [
                "start-session",
                "stop-session",
                "create-proof-pack",
                "recent-sessions",
                "settings",
                "verify-proof",
            ];

            for action in &preferences.quick_actions {
                if !valid_actions.contains(&action.as_str()) {
                    errors.push(SettingsValidationError {
                        field: "quick_actions".to_string(),
                        message: format!("Invalid quick action: {}", action),
                    });
                }
            }

            if !errors.is_empty() {
                return Err(SettingsError::ValidationError(
                    serde_json::to_string(&errors).unwrap_or_default(),
                ));
            }

            Ok(())
        }

        fn reset_settings(&self) -> Result<TraySettings, SettingsError> {
            let settings = TraySettings::default();
            self.save_settings(&settings)?;
            Ok(settings)
        }

        fn export_settings(&self) -> Result<String, SettingsError> {
            let settings = self.load_settings()?;
            Ok(serde_json::to_string_pretty(&settings)?)
        }

        fn import_settings(&self, json_data: &str) -> Result<TraySettings, SettingsError> {
            let settings: TraySettings = serde_json::from_str(json_data)?;
            self.validate_preferences(&settings.preferences)?;
            self.save_settings(&settings)?;
            Ok(settings)
        }
    }

    #[test]
    fn test_default_preferences() {
        let prefs = TrayPreferences::default();

        assert_eq!(prefs.theme, "system");
        assert_eq!(prefs.position, "auto");
        assert!(prefs.show_notifications);
        assert!(prefs.auto_hide);
        assert_eq!(prefs.quick_actions.len(), 3);

        // Check platform-specific hotkey
        if cfg!(target_os = "macos") {
            assert!(prefs.hotkey.contains("Cmd"));
        } else {
            assert!(prefs.hotkey.contains("Ctrl"));
        }
    }

    #[test]
    fn test_settings_serialization() {
        let settings = TraySettings::default();

        let json = serde_json::to_string(&settings).unwrap();
        let deserialized: TraySettings = serde_json::from_str(&json).unwrap();

        assert_eq!(settings.preferences.theme, deserialized.preferences.theme);
        assert_eq!(
            settings.preferences.position,
            deserialized.preferences.position
        );
        assert_eq!(settings.version, deserialized.version);
    }

    #[test]
    fn test_load_nonexistent_settings() {
        let (_temp_dir, settings_path) = create_test_manager();
        let manager = create_test_settings_manager(settings_path);

        let settings = manager.load_settings().unwrap();

        // Should return default settings
        assert_eq!(settings.preferences.theme, "system");
        assert_eq!(settings.version, 1);
    }

    #[test]
    fn test_save_and_load_settings() {
        let (_temp_dir, settings_path) = create_test_manager();
        let manager = create_test_settings_manager(settings_path);

        let mut settings = TraySettings::default();
        settings.preferences.theme = "dark".to_string();
        settings.preferences.position = "center".to_string();

        manager.save_settings(&settings).unwrap();

        let loaded_settings = manager.load_settings().unwrap();
        assert_eq!(loaded_settings.preferences.theme, "dark");
        assert_eq!(loaded_settings.preferences.position, "center");
    }

    #[test]
    fn test_update_preferences() {
        let (_temp_dir, settings_path) = create_test_manager();
        let manager = create_test_settings_manager(settings_path);

        let mut preferences = TrayPreferences::default();
        preferences.theme = "light".to_string();
        preferences.show_notifications = false;

        let updated_settings = manager.update_preferences(preferences).unwrap();

        assert_eq!(updated_settings.preferences.theme, "light");
        assert!(!updated_settings.preferences.show_notifications);
        assert_eq!(updated_settings.version, 2); // Should increment version
    }

    #[test]
    fn test_validate_preferences() {
        let (_temp_dir, settings_path) = create_test_manager();
        let manager = create_test_settings_manager(settings_path);

        // Valid preferences
        let valid_prefs = TrayPreferences::default();
        assert!(manager.validate_preferences(&valid_prefs).is_ok());

        // Invalid theme
        let mut invalid_prefs = TrayPreferences::default();
        invalid_prefs.theme = "invalid".to_string();
        assert!(manager.validate_preferences(&invalid_prefs).is_err());

        // Invalid position
        let mut invalid_prefs = TrayPreferences::default();
        invalid_prefs.position = "invalid".to_string();
        assert!(manager.validate_preferences(&invalid_prefs).is_err());

        // Empty hotkey
        let mut invalid_prefs = TrayPreferences::default();
        invalid_prefs.hotkey = "".to_string();
        assert!(manager.validate_preferences(&invalid_prefs).is_err());

        // Invalid quick action
        let mut invalid_prefs = TrayPreferences::default();
        invalid_prefs.quick_actions = vec!["invalid-action".to_string()];
        assert!(manager.validate_preferences(&invalid_prefs).is_err());
    }

    #[test]
    fn test_reset_settings() {
        let (_temp_dir, settings_path) = create_test_manager();
        let manager = create_test_settings_manager(settings_path);

        // First, save some custom settings
        let mut custom_settings = TraySettings::default();
        custom_settings.preferences.theme = "dark".to_string();
        custom_settings.version = 5;
        manager.save_settings(&custom_settings).unwrap();

        // Reset to defaults
        let reset_settings = manager.reset_settings().unwrap();

        assert_eq!(reset_settings.preferences.theme, "system");
        assert_eq!(reset_settings.version, 1);
    }

    #[test]
    fn test_export_import_settings() {
        let (_temp_dir, settings_path) = create_test_manager();
        let manager = create_test_settings_manager(settings_path);

        // Create and save custom settings
        let mut custom_settings = TraySettings::default();
        custom_settings.preferences.theme = "dark".to_string();
        custom_settings.preferences.position = "center".to_string();
        manager.save_settings(&custom_settings).unwrap();

        // Export settings
        let exported_json = manager.export_settings().unwrap();
        assert!(exported_json.contains("\"theme\":\"dark\""));

        // Reset settings
        manager.reset_settings().unwrap();

        // Import settings
        let imported_settings = manager.import_settings(&exported_json).unwrap();
        assert_eq!(imported_settings.preferences.theme, "dark");
        assert_eq!(imported_settings.preferences.position, "center");
    }

    #[test]
    fn test_import_invalid_settings() {
        let (_temp_dir, settings_path) = create_test_manager();
        let manager = create_test_settings_manager(settings_path);

        let invalid_json = r#"{"preferences": {"theme": "invalid"}}"#;

        let result = manager.import_settings(invalid_json);
        assert!(result.is_err());
    }
}
