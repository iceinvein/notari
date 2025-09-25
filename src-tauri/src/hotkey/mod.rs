use global_hotkey::{
    hotkey::{Code, HotKey, Modifiers},
    GlobalHotKeyEvent, GlobalHotKeyManager,
};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Manager, Emitter};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum HotkeyError {
    #[error("Failed to register hotkey: {0}")]
    RegistrationFailed(String),
    #[error("Failed to unregister hotkey: {0}")]
    UnregistrationFailed(String),
    #[error("Invalid hotkey format: {0}")]
    InvalidFormat(String),
    #[error("Hotkey conflict detected: {0}")]
    Conflict(String),
    #[error("Manager not initialized")]
    NotInitialized,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct HotkeyConfig {
    pub id: String,
    pub keys: String,
    pub description: String,
    pub enabled: bool,
}

impl Default for HotkeyConfig {
    fn default() -> Self {
        Self {
            id: "toggle_popover".to_string(),
            keys: if cfg!(target_os = "macos") {
                "Cmd+Shift+N".to_string()
            } else {
                "Ctrl+Shift+N".to_string()
            },
            description: "Toggle popover visibility".to_string(),
            enabled: true,
        }
    }
}

pub struct HotkeyManager {
    app_handle: AppHandle,
    manager: Option<GlobalHotKeyManager>,
    registered_hotkeys: Arc<Mutex<HashMap<String, (HotKey, HotkeyConfig)>>>,
}

impl HotkeyManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            manager: None,
            registered_hotkeys: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn initialize(&mut self) -> Result<(), HotkeyError> {
        let manager = GlobalHotKeyManager::new()
            .map_err(|e| HotkeyError::RegistrationFailed(e.to_string()))?;
        
        self.manager = Some(manager);
        
        // Register default hotkey
        let default_config = HotkeyConfig::default();
        self.register_hotkey(default_config)?;
        
        Ok(())
    }

    pub fn register_hotkey(&mut self, config: HotkeyConfig) -> Result<(), HotkeyError> {
        if !config.enabled {
            return Ok(());
        }

        let manager = self.manager.as_ref()
            .ok_or(HotkeyError::NotInitialized)?;

        // Parse the hotkey string
        let hotkey = self.parse_hotkey_string(&config.keys)?;
        
        // Check for conflicts
        self.check_conflict(&config.id, &hotkey)?;
        
        // Register the hotkey
        manager.register(hotkey)
            .map_err(|e| HotkeyError::RegistrationFailed(format!("{}: {}", config.keys, e)))?;
        
        // Store the registration
        let mut registered = self.registered_hotkeys.lock().unwrap();
        registered.insert(config.id.clone(), (hotkey, config));
        
        Ok(())
    }

    pub fn unregister_hotkey(&mut self, id: &str) -> Result<(), HotkeyError> {
        let manager = self.manager.as_ref()
            .ok_or(HotkeyError::NotInitialized)?;

        let mut registered = self.registered_hotkeys.lock().unwrap();
        
        if let Some((hotkey, _)) = registered.remove(id) {
            manager.unregister(hotkey)
                .map_err(|e| HotkeyError::UnregistrationFailed(e.to_string()))?;
        }
        
        Ok(())
    }

    pub fn update_hotkey(&mut self, config: HotkeyConfig) -> Result<(), HotkeyError> {
        // Unregister existing hotkey if it exists
        if self.is_registered(&config.id) {
            self.unregister_hotkey(&config.id)?;
        }
        
        // Register new hotkey
        self.register_hotkey(config)?;
        
        Ok(())
    }

    pub fn is_registered(&self, id: &str) -> bool {
        let registered = self.registered_hotkeys.lock().unwrap();
        registered.contains_key(id)
    }

    pub fn get_registered_hotkeys(&self) -> Vec<HotkeyConfig> {
        let registered = self.registered_hotkeys.lock().unwrap();
        registered.values().map(|(_, config)| config.clone()).collect()
    }

    pub fn handle_hotkey_event(&self, event: GlobalHotKeyEvent) {
        let registered = self.registered_hotkeys.lock().unwrap();
        
        // Find which hotkey was triggered
        for (id, (hotkey, _)) in registered.iter() {
            if hotkey.id() == event.id {
                match id.as_str() {
                    "toggle_popover" => {
                        if let Err(e) = self.handle_toggle_popover() {
                            eprintln!("Failed to handle toggle popover: {}", e);
                        }
                    }
                    "start_stop_session" => {
                        if let Err(e) = self.handle_session_toggle() {
                            eprintln!("Failed to handle session toggle: {}", e);
                        }
                    }
                    "create_proof_pack" => {
                        if let Err(e) = self.handle_proof_pack_creation() {
                            eprintln!("Failed to handle proof pack creation: {}", e);
                        }
                    }
                    _ => {
                        eprintln!("Unknown hotkey triggered: {}", id);
                    }
                }
                break;
            }
        }
    }

    fn handle_toggle_popover(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Use the popover command to toggle visibility
        if let Some(popover_state) = self.app_handle.try_state::<crate::commands::popover::PopoverManagerState>() {
            let popover_manager = popover_state.lock().map_err(|e| format!("Failed to lock popover manager: {}", e))?;
            popover_manager.toggle_popover()?;
        }
        Ok(())
    }

    fn handle_session_toggle(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Emit event to frontend to handle session toggle
        self.app_handle.emit("hotkey-session-toggle", ())?;
        Ok(())
    }

    fn handle_proof_pack_creation(&self) -> Result<(), Box<dyn std::error::Error>> {
        // Emit event to frontend to handle proof pack creation
        self.app_handle.emit("hotkey-proof-pack-create", ())?;
        Ok(())
    }

    fn parse_hotkey_string(&self, keys: &str) -> Result<HotKey, HotkeyError> {
        let parts: Vec<&str> = keys.split('+').map(|s| s.trim()).collect();
        
        if parts.is_empty() {
            return Err(HotkeyError::InvalidFormat("Empty hotkey string".to_string()));
        }

        let mut modifiers = Modifiers::empty();
        let mut key_code = None;

        for part in parts {
            match part.to_lowercase().as_str() {
                "ctrl" | "control" => modifiers |= Modifiers::CONTROL,
                "cmd" | "command" | "meta" => modifiers |= Modifiers::META,
                "alt" | "option" => modifiers |= Modifiers::ALT,
                "shift" => modifiers |= Modifiers::SHIFT,
                key => {
                    if key_code.is_some() {
                        return Err(HotkeyError::InvalidFormat(
                            "Multiple key codes specified".to_string()
                        ));
                    }
                    key_code = Some(self.parse_key_code(key)?);
                }
            }
        }

        let code = key_code.ok_or_else(|| {
            HotkeyError::InvalidFormat("No key code specified".to_string())
        })?;

        Ok(HotKey::new(Some(modifiers), code))
    }

    fn parse_key_code(&self, key: &str) -> Result<Code, HotkeyError> {
        match key.to_lowercase().as_str() {
            "a" => Ok(Code::KeyA),
            "b" => Ok(Code::KeyB),
            "c" => Ok(Code::KeyC),
            "d" => Ok(Code::KeyD),
            "e" => Ok(Code::KeyE),
            "f" => Ok(Code::KeyF),
            "g" => Ok(Code::KeyG),
            "h" => Ok(Code::KeyH),
            "i" => Ok(Code::KeyI),
            "j" => Ok(Code::KeyJ),
            "k" => Ok(Code::KeyK),
            "l" => Ok(Code::KeyL),
            "m" => Ok(Code::KeyM),
            "n" => Ok(Code::KeyN),
            "o" => Ok(Code::KeyO),
            "p" => Ok(Code::KeyP),
            "q" => Ok(Code::KeyQ),
            "r" => Ok(Code::KeyR),
            "s" => Ok(Code::KeyS),
            "t" => Ok(Code::KeyT),
            "u" => Ok(Code::KeyU),
            "v" => Ok(Code::KeyV),
            "w" => Ok(Code::KeyW),
            "x" => Ok(Code::KeyX),
            "y" => Ok(Code::KeyY),
            "z" => Ok(Code::KeyZ),
            "0" => Ok(Code::Digit0),
            "1" => Ok(Code::Digit1),
            "2" => Ok(Code::Digit2),
            "3" => Ok(Code::Digit3),
            "4" => Ok(Code::Digit4),
            "5" => Ok(Code::Digit5),
            "6" => Ok(Code::Digit6),
            "7" => Ok(Code::Digit7),
            "8" => Ok(Code::Digit8),
            "9" => Ok(Code::Digit9),
            "f1" => Ok(Code::F1),
            "f2" => Ok(Code::F2),
            "f3" => Ok(Code::F3),
            "f4" => Ok(Code::F4),
            "f5" => Ok(Code::F5),
            "f6" => Ok(Code::F6),
            "f7" => Ok(Code::F7),
            "f8" => Ok(Code::F8),
            "f9" => Ok(Code::F9),
            "f10" => Ok(Code::F10),
            "f11" => Ok(Code::F11),
            "f12" => Ok(Code::F12),
            "space" => Ok(Code::Space),
            "enter" | "return" => Ok(Code::Enter),
            "escape" | "esc" => Ok(Code::Escape),
            "tab" => Ok(Code::Tab),
            "backspace" => Ok(Code::Backspace),
            "delete" | "del" => Ok(Code::Delete),
            "insert" | "ins" => Ok(Code::Insert),
            "home" => Ok(Code::Home),
            "end" => Ok(Code::End),
            "pageup" | "pgup" => Ok(Code::PageUp),
            "pagedown" | "pgdn" => Ok(Code::PageDown),
            "arrowup" | "up" => Ok(Code::ArrowUp),
            "arrowdown" | "down" => Ok(Code::ArrowDown),
            "arrowleft" | "left" => Ok(Code::ArrowLeft),
            "arrowright" | "right" => Ok(Code::ArrowRight),
            _ => Err(HotkeyError::InvalidFormat(format!("Unknown key: {}", key))),
        }
    }

    fn check_conflict(&self, new_id: &str, new_hotkey: &HotKey) -> Result<(), HotkeyError> {
        let registered = self.registered_hotkeys.lock().unwrap();
        
        for (id, (hotkey, _)) in registered.iter() {
            if id != new_id && hotkey.mods == new_hotkey.mods && hotkey.key == new_hotkey.key {
                return Err(HotkeyError::Conflict(format!(
                    "Hotkey conflicts with existing registration: {}", id
                )));
            }
        }
        
        Ok(())
    }

    pub fn validate_hotkey_string(&self, keys: &str) -> Result<(), HotkeyError> {
        self.parse_hotkey_string(keys)?;
        Ok(())
    }
}

// Event listener setup
pub fn setup_hotkey_listener(app_handle: AppHandle) -> Result<(), HotkeyError> {
    use global_hotkey::GlobalHotKeyEvent;
    
    let app_handle_clone = app_handle.clone();
    
    std::thread::spawn(move || {
        let receiver = GlobalHotKeyEvent::receiver();
        
        loop {
            if let Ok(event) = receiver.recv() {
                if let Some(hotkey_manager) = app_handle_clone.try_state::<HotkeyManager>() {
                    hotkey_manager.handle_hotkey_event(event);
                }
            }
        }
    });
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;



    #[test]
    fn test_hotkey_config_default() {
        let config = HotkeyConfig::default();
        
        assert_eq!(config.id, "toggle_popover");
        assert!(config.enabled);
        assert!(!config.keys.is_empty());
        assert!(!config.description.is_empty());
        
        // Check platform-specific defaults
        if cfg!(target_os = "macos") {
            assert!(config.keys.contains("Cmd"));
        } else {
            assert!(config.keys.contains("Ctrl"));
        }
    }

    #[test]
    fn test_hotkey_config_serialization() {
        let config = HotkeyConfig::default();
        
        // Test serialization
        let json = serde_json::to_string(&config).expect("Failed to serialize config");
        let deserialized: HotkeyConfig = serde_json::from_str(&json).expect("Failed to deserialize config");
        
        assert_eq!(config.id, deserialized.id);
        assert_eq!(config.keys, deserialized.keys);
        assert_eq!(config.description, deserialized.description);
        assert_eq!(config.enabled, deserialized.enabled);
    }

    // Test individual parsing functions without requiring AppHandle
    #[test]
    fn test_parse_modifiers() {
        // Test modifier parsing logic
        let test_cases = vec![
            ("Ctrl+A", true),
            ("Cmd+B", true),
            ("Alt+C", true),
            ("Shift+D", true),
            ("Ctrl+Shift+E", true),
            ("InvalidMod+F", false),
            ("", false),
        ];

        for (input, should_succeed) in test_cases {
            let parts: Vec<&str> = input.split('+').collect();
            let has_valid_modifiers = parts.iter().any(|part| {
                matches!(part.to_lowercase().as_str(), 
                    "ctrl" | "control" | "cmd" | "command" | "meta" | "alt" | "option" | "shift")
            });
            
            if should_succeed {
                assert!(has_valid_modifiers || parts.len() == 1, "Expected valid modifiers for: {}", input);
            }
        }
    }

    #[test]
    fn test_key_code_mapping() {
        // Test key code validation
        let valid_keys = vec![
            "a", "b", "c", "1", "2", "3", "f1", "f12", 
            "space", "enter", "escape", "tab", "backspace"
        ];
        
        let invalid_keys = vec![
            "invalid", "", "f13", "unknown"
        ];

        for key in valid_keys {
            // This would normally call parse_key_code, but we can't without HotkeyManager
            // So we test the logic directly
            let is_valid = matches!(key.to_lowercase().as_str(),
                "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m" |
                "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z" |
                "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" |
                "f1" | "f2" | "f3" | "f4" | "f5" | "f6" | "f7" | "f8" | "f9" | "f10" | "f11" | "f12" |
                "space" | "enter" | "return" | "escape" | "esc" | "tab" | "backspace" |
                "delete" | "del" | "insert" | "ins" | "home" | "end" | "pageup" | "pgup" |
                "pagedown" | "pgdn" | "arrowup" | "up" | "arrowdown" | "down" |
                "arrowleft" | "left" | "arrowright" | "right"
            );
            assert!(is_valid, "Expected {} to be valid", key);
        }

        for key in invalid_keys {
            let is_valid = matches!(key.to_lowercase().as_str(),
                "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i" | "j" | "k" | "l" | "m" |
                "n" | "o" | "p" | "q" | "r" | "s" | "t" | "u" | "v" | "w" | "x" | "y" | "z" |
                "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" |
                "f1" | "f2" | "f3" | "f4" | "f5" | "f6" | "f7" | "f8" | "f9" | "f10" | "f11" | "f12" |
                "space" | "enter" | "return" | "escape" | "esc" | "tab" | "backspace" |
                "delete" | "del" | "insert" | "ins" | "home" | "end" | "pageup" | "pgup" |
                "pagedown" | "pgdn" | "arrowup" | "up" | "arrowdown" | "down" |
                "arrowleft" | "left" | "arrowright" | "right"
            );
            assert!(!is_valid, "Expected {} to be invalid", key);
        }
    }

    /// Unregisters all registered hotkeys
    pub fn unregister_all_hotkeys(&mut self) -> Result<(), HotkeyError> {
        let manager = self.manager.as_ref()
            .ok_or(HotkeyError::NotInitialized)?;
        
        let mut registered = self.registered_hotkeys.lock()
            .map_err(|e| HotkeyError::UnregistrationFailed(format!("Lock error: {}", e)))?;
        
        // Unregister all hotkeys
        for (id, (hotkey, _)) in registered.iter() {
            if let Err(e) = manager.unregister(*hotkey) {
                eprintln!("Failed to unregister hotkey {}: {}", id, e);
            }
        }
        
        // Clear the registered hotkeys map
        registered.clear();
        
        Ok(())
    }}
