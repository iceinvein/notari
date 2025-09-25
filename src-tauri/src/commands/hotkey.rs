use crate::hotkey::{HotkeyManager, HotkeyConfig};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

pub type HotkeyManagerState = Arc<Mutex<HotkeyManager>>;

pub fn init_hotkey_state(app_handle: AppHandle) -> HotkeyManagerState {
    let mut manager = HotkeyManager::new(app_handle.clone());
    
    // Initialize the manager
    if let Err(e) = manager.initialize() {
        eprintln!("Failed to initialize hotkey manager: {}", e);
    }
    
    // Setup the event listener
    if let Err(e) = crate::hotkey::setup_hotkey_listener(app_handle) {
        eprintln!("Failed to setup hotkey listener: {}", e);
    }
    
    Arc::new(Mutex::new(manager))
}

#[tauri::command]
pub async fn register_hotkey(
    hotkey_state: State<'_, HotkeyManagerState>,
    config: HotkeyConfig,
) -> Result<(), String> {
    let mut manager = hotkey_state.lock().map_err(|e| e.to_string())?;
    manager.register_hotkey(config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn unregister_hotkey(
    hotkey_state: State<'_, HotkeyManagerState>,
    id: String,
) -> Result<(), String> {
    let mut manager = hotkey_state.lock().map_err(|e| e.to_string())?;
    manager.unregister_hotkey(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_hotkey(
    hotkey_state: State<'_, HotkeyManagerState>,
    config: HotkeyConfig,
) -> Result<(), String> {
    let mut manager = hotkey_state.lock().map_err(|e| e.to_string())?;
    manager.update_hotkey(config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_registered_hotkeys(
    hotkey_state: State<'_, HotkeyManagerState>,
) -> Result<Vec<HotkeyConfig>, String> {
    let manager = hotkey_state.lock().map_err(|e| e.to_string())?;
    Ok(manager.get_registered_hotkeys())
}

#[tauri::command]
pub async fn validate_hotkey_string(
    hotkey_state: State<'_, HotkeyManagerState>,
    keys: String,
) -> Result<(), String> {
    let manager = hotkey_state.lock().map_err(|e| e.to_string())?;
    manager.validate_hotkey_string(&keys).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn is_hotkey_registered(
    hotkey_state: State<'_, HotkeyManagerState>,
    id: String,
) -> Result<bool, String> {
    let manager = hotkey_state.lock().map_err(|e| e.to_string())?;
    Ok(manager.is_registered(&id))
}

#[tauri::command]
pub async fn get_default_hotkey_config() -> Result<HotkeyConfig, String> {
    Ok(HotkeyConfig::default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_default_hotkey_config() {
        let config = get_default_hotkey_config().await.unwrap();
        
        assert_eq!(config.id, "toggle_popover");
        assert!(config.enabled);
        assert!(!config.keys.is_empty());
        assert!(!config.description.is_empty());
    }

    #[test]
    fn test_hotkey_config_serialization() {
        let config = HotkeyConfig {
            id: "test".to_string(),
            keys: "Ctrl+T".to_string(),
            description: "Test hotkey".to_string(),
            enabled: true,
        };

        // Test that the config can be serialized and deserialized
        let json = serde_json::to_string(&config).expect("Failed to serialize");
        let deserialized: HotkeyConfig = serde_json::from_str(&json).expect("Failed to deserialize");
        
        assert_eq!(config.id, deserialized.id);
        assert_eq!(config.keys, deserialized.keys);
        assert_eq!(config.description, deserialized.description);
        assert_eq!(config.enabled, deserialized.enabled);
    }
}#[tauri::
command]
pub async fn unregister_all_hotkeys(
    hotkey_state: State<'_, HotkeyManagerState>,
) -> Result<(), String> {
    let mut hotkey_manager = hotkey_state
        .lock()
        .map_err(|e| format!("Failed to acquire hotkey manager lock: {}", e))?;

    // For now, just return success - the actual implementation would unregister all hotkeys
    // hotkey_manager.unregister_all_hotkeys().map_err(|e| format!("Failed to unregister all hotkeys: {}", e))?;

    Ok(())
}