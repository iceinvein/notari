use crate::window::{PopoverManager, WindowPosition, PopoverWindowConfig};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

pub type PopoverManagerState = Arc<Mutex<PopoverManager>>;

#[derive(Debug, Serialize, Deserialize)]
pub struct PopoverStatusResponse {
    pub is_visible: bool,
    pub position: Option<WindowPosition>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PopoverConfigRequest {
    pub config: PopoverWindowConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PopoverPositionResponse {
    pub position: WindowPosition,
}

pub fn init_popover_state(app_handle: AppHandle) -> PopoverManagerState {
    let popover_manager = PopoverManager::new(app_handle);
    Arc::new(Mutex::new(popover_manager))
}

#[tauri::command]
pub async fn show_popover(popover_state: State<'_, PopoverManagerState>) -> Result<(), String> {
    let popover_manager = popover_state
        .lock()
        .map_err(|e| format!("Failed to acquire popover manager lock: {}", e))?;

    popover_manager
        .show_popover()
        .map_err(|e| format!("Failed to show popover: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn hide_popover(popover_state: State<'_, PopoverManagerState>) -> Result<(), String> {
    let popover_manager = popover_state
        .lock()
        .map_err(|e| format!("Failed to acquire popover manager lock: {}", e))?;

    popover_manager
        .hide_popover()
        .map_err(|e| format!("Failed to hide popover: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn toggle_popover(popover_state: State<'_, PopoverManagerState>) -> Result<(), String> {
    let popover_manager = popover_state
        .lock()
        .map_err(|e| format!("Failed to acquire popover manager lock: {}", e))?;

    popover_manager
        .toggle_popover()
        .map_err(|e| format!("Failed to toggle popover: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_popover_status(
    popover_state: State<'_, PopoverManagerState>,
) -> Result<PopoverStatusResponse, String> {
    let popover_manager = popover_state
        .lock()
        .map_err(|e| format!("Failed to acquire popover manager lock: {}", e))?;

    let is_visible = popover_manager.is_visible();
    let position = if is_visible {
        popover_manager.calculate_position().ok()
    } else {
        None
    };

    Ok(PopoverStatusResponse {
        is_visible,
        position,
    })
}

#[tauri::command]
pub async fn update_popover_config(
    config: PopoverWindowConfig,
    popover_state: State<'_, PopoverManagerState>,
) -> Result<(), String> {
    let mut popover_manager = popover_state
        .lock()
        .map_err(|e| format!("Failed to acquire popover manager lock: {}", e))?;

    popover_manager.update_config(config);

    Ok(())
}

#[tauri::command]
pub async fn calculate_popover_position(
    popover_state: State<'_, PopoverManagerState>,
) -> Result<PopoverPositionResponse, String> {
    let popover_manager = popover_state
        .lock()
        .map_err(|e| format!("Failed to acquire popover manager lock: {}", e))?;

    let position = popover_manager
        .calculate_position()
        .map_err(|e| format!("Failed to calculate popover position: {}", e))?;

    Ok(PopoverPositionResponse { position })
}

#[tauri::command]
pub async fn destroy_popover(popover_state: State<'_, PopoverManagerState>) -> Result<(), String> {
    let popover_manager = popover_state
        .lock()
        .map_err(|e| format!("Failed to acquire popover manager lock: {}", e))?;

    popover_manager
        .destroy_popover()
        .map_err(|e| format!("Failed to destroy popover: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::window::PositionAnchor;

    #[tokio::test]
    async fn test_popover_status_response_serialization() {
        let position = WindowPosition {
            x: 100.0,
            y: 200.0,
            anchor: PositionAnchor::Tray,
        };

        let response = PopoverStatusResponse {
            is_visible: true,
            position: Some(position),
        };

        let json = serde_json::to_string(&response).expect("Failed to serialize PopoverStatusResponse");
        let deserialized: PopoverStatusResponse =
            serde_json::from_str(&json).expect("Failed to deserialize PopoverStatusResponse");

        assert!(deserialized.is_visible);
        assert!(deserialized.position.is_some());
        
        let pos = deserialized.position.unwrap();
        assert_eq!(pos.x, 100.0);
        assert_eq!(pos.y, 200.0);
        assert!(matches!(pos.anchor, PositionAnchor::Tray));
    }

    #[tokio::test]
    async fn test_popover_config_request_serialization() {
        let config = PopoverWindowConfig {
            width: 500.0,
            height: 700.0,
            frameless: false,
            always_on_top: false,
            skip_taskbar: false,
            transparent: false,
            resizable: true,
            auto_hide_on_blur: false,
        };

        let request = PopoverConfigRequest { config };

        let json = serde_json::to_string(&request).expect("Failed to serialize PopoverConfigRequest");
        let deserialized: PopoverConfigRequest =
            serde_json::from_str(&json).expect("Failed to deserialize PopoverConfigRequest");

        assert_eq!(deserialized.config.width, 500.0);
        assert_eq!(deserialized.config.height, 700.0);
        assert!(!deserialized.config.frameless);
        assert!(!deserialized.config.always_on_top);
        assert!(!deserialized.config.skip_taskbar);
        assert!(!deserialized.config.transparent);
        assert!(deserialized.config.resizable);
        assert!(!deserialized.config.auto_hide_on_blur);
    }

    #[tokio::test]
    async fn test_popover_position_response_serialization() {
        let position = WindowPosition {
            x: 300.0,
            y: 400.0,
            anchor: PositionAnchor::Center,
        };

        let response = PopoverPositionResponse { position };

        let json = serde_json::to_string(&response).expect("Failed to serialize PopoverPositionResponse");
        let deserialized: PopoverPositionResponse =
            serde_json::from_str(&json).expect("Failed to deserialize PopoverPositionResponse");

        assert_eq!(deserialized.position.x, 300.0);
        assert_eq!(deserialized.position.y, 400.0);
        assert!(matches!(deserialized.position.anchor, PositionAnchor::Center));
    }
}