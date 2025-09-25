use tauri::{AppHandle, Manager, Emitter, tray::{TrayIcon, TrayIconBuilder, TrayIconEvent}, menu::{Menu, MenuItem}};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use crate::capture::types::SessionStatus;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TrayState {
    Idle,
    Recording,
    Processing,
}

impl From<SessionStatus> for TrayState {
    fn from(session_status: SessionStatus) -> Self {
        match session_status {
            SessionStatus::Active => TrayState::Recording,
            SessionStatus::Paused => TrayState::Recording, // Paused is still considered recording state
            SessionStatus::Completed => TrayState::Processing,
            SessionStatus::Failed(_) => TrayState::Idle,
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum TrayError {
    #[error("Failed to create system tray: {0}")]
    CreationFailed(String),
    
    #[error("Failed to update tray icon: {0}")]
    IconUpdateFailed(String),
    
    #[error("Failed to set tray tooltip: {0}")]
    TooltipUpdateFailed(String),
    
    #[error("Failed to set tray menu: {0}")]
    MenuUpdateFailed(String),
    
    #[error("Tray not initialized")]
    NotInitialized,
    
    #[error("Icon resource not found: {0}")]
    IconNotFound(String),
}

pub type TrayResult<T> = Result<T, TrayError>;

pub struct TrayManager {
    app_handle: AppHandle,
    current_state: Arc<Mutex<TrayState>>,
    tray_icon: Option<TrayIcon>,
}

impl TrayManager {
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            current_state: Arc::new(Mutex::new(TrayState::Idle)),
            tray_icon: None,
        }
    }

    pub fn setup_tray(&mut self) -> TrayResult<()> {
        let menu = self.create_tray_menu()?;
        
        let tray_icon = TrayIconBuilder::new()
            .menu(&menu)
            .tooltip("Notari - Proof of Work System")
            .icon(self.get_icon_for_state(&TrayState::Idle)?)
            .on_tray_icon_event(|tray, event| {
                // Handle tray events - we'll emit to the app handle
                if let Some(app_handle) = tray.app_handle().get_webview_window("main") {
                    match event {
                        TrayIconEvent::Click { button, .. } => {
                            let _ = app_handle.emit("tray-click", button);
                        }
                        TrayIconEvent::DoubleClick { button, .. } => {
                            let _ = app_handle.emit("tray-double-click", button);
                        }
                        _ => {}
                    }
                }
            })
            .build(&self.app_handle)
            .map_err(|e| TrayError::CreationFailed(e.to_string()))?;

        self.tray_icon = Some(tray_icon);
        Ok(())
    }

    pub fn update_icon(&self, state: TrayState) -> TrayResult<()> {
        let tray_icon = self.tray_icon.as_ref()
            .ok_or(TrayError::NotInitialized)?;

        let icon = self.get_icon_for_state(&state)?;
        
        tray_icon
            .set_icon(Some(icon))
            .map_err(|e| TrayError::IconUpdateFailed(e.to_string()))?;

        // Update internal state
        if let Ok(mut current_state) = self.current_state.lock() {
            *current_state = state.clone();
        }

        // Update tooltip based on state
        let tooltip = match state {
            TrayState::Idle => "Notari - Ready",
            TrayState::Recording => "Notari - Recording Session",
            TrayState::Processing => "Notari - Processing Data",
        };

        tray_icon
            .set_tooltip(Some(tooltip))
            .map_err(|e| TrayError::TooltipUpdateFailed(e.to_string()))?;

        Ok(())
    }

    pub fn update_from_session_status(&self, session_status: SessionStatus) -> TrayResult<()> {
        let tray_state = TrayState::from(session_status);
        self.update_icon(tray_state)
    }

    pub fn get_current_state(&self) -> TrayState {
        self.current_state
            .lock()
            .map(|state| state.clone())
            .unwrap_or(TrayState::Idle)
    }

    pub fn handle_tray_event(&self, event: TrayIconEvent) {
        match event {
            TrayIconEvent::Click { button, .. } => {
                match button {
                    tauri::tray::MouseButton::Left => {
                        // Emit event to frontend to show popover
                        if let Err(e) = self.app_handle.emit("tray-left-click", ()) {
                            eprintln!("Failed to emit tray left click event: {}", e);
                        }
                    }
                    tauri::tray::MouseButton::Right => {
                        // Context menu is handled automatically by the system tray
                    }
                    _ => {}
                }
            }
            TrayIconEvent::DoubleClick { .. } => {
                // Handle double click if needed
            }
            _ => {}
        }
    }

    fn create_tray_menu(&self) -> TrayResult<Menu<tauri::Wry>> {
        let show_app = MenuItem::with_id(&self.app_handle, "show_app", "Show Notari", true, None::<&str>)
            .map_err(|e| TrayError::MenuUpdateFailed(e.to_string()))?;
        let start_session = MenuItem::with_id(&self.app_handle, "start_session", "Start Session", true, None::<&str>)
            .map_err(|e| TrayError::MenuUpdateFailed(e.to_string()))?;
        let stop_session = MenuItem::with_id(&self.app_handle, "stop_session", "Stop Session", false, None::<&str>)
            .map_err(|e| TrayError::MenuUpdateFailed(e.to_string()))?;
        let quit = MenuItem::with_id(&self.app_handle, "quit", "Quit", true, None::<&str>)
            .map_err(|e| TrayError::MenuUpdateFailed(e.to_string()))?;

        let menu = Menu::with_items(&self.app_handle, &[
            &show_app,
            &start_session,
            &stop_session,
            &quit,
        ]).map_err(|e| TrayError::MenuUpdateFailed(e.to_string()))?;

        Ok(menu)
    }

    pub fn handle_menu_item_click(&self, id: &str) {
        match id {
            "show_app" => {
                if let Err(e) = self.app_handle.emit("show-popover", ()) {
                    eprintln!("Failed to emit show popover event: {}", e);
                }
            }
            "start_session" => {
                if let Err(e) = self.app_handle.emit("start-session", ()) {
                    eprintln!("Failed to emit start session event: {}", e);
                }
            }
            "stop_session" => {
                if let Err(e) = self.app_handle.emit("stop-session", ()) {
                    eprintln!("Failed to emit stop session event: {}", e);
                }
            }
            "quit" => {
                self.app_handle.exit(0);
            }
            _ => {}
        }
    }

    fn get_icon_for_state(&self, state: &TrayState) -> TrayResult<tauri::image::Image<'static>> {
        let icon_path = match state {
            TrayState::Idle => "icons/tray/tray-idle.png",
            TrayState::Recording => "icons/tray/tray-recording.png", 
            TrayState::Processing => "icons/tray/tray-processing.png",
        };

        // Try to load the icon from the resource
        let resource_path = self.app_handle
            .path()
            .resolve(icon_path, tauri::path::BaseDirectory::Resource)
            .map_err(|e| TrayError::IconNotFound(format!("Failed to resolve path {}: {}", icon_path, e)))?;

        let bytes = std::fs::read(resource_path)
            .map_err(|e| TrayError::IconNotFound(format!("Failed to read icon file {}: {}", icon_path, e)))?;

        // For now, use a simple approach - we'll need to decode the image to get dimensions
        // This is a simplified implementation that assumes PNG format
        let image = image::load_from_memory(&bytes)
            .map_err(|e| TrayError::IconNotFound(format!("Failed to decode image: {}", e)))?;
        
        let rgba = image.to_rgba8();
        let (width, height) = rgba.dimensions();
        
        Ok(tauri::image::Image::new_owned(rgba.into_raw(), width, height))
    }

    pub fn update_menu_for_session_state(&self, has_active_session: bool) -> TrayResult<()> {
        let tray_icon = self.tray_icon.as_ref()
            .ok_or(TrayError::NotInitialized)?;

        let show_app = MenuItem::with_id(&self.app_handle, "show_app", "Show Notari", true, None::<&str>)
            .map_err(|e| TrayError::MenuUpdateFailed(e.to_string()))?;
        let quit = MenuItem::with_id(&self.app_handle, "quit", "Quit", true, None::<&str>)
            .map_err(|e| TrayError::MenuUpdateFailed(e.to_string()))?;

        let menu = if has_active_session {
            let stop_session = MenuItem::with_id(&self.app_handle, "stop_session", "Stop Session", true, None::<&str>)
                .map_err(|e| TrayError::MenuUpdateFailed(e.to_string()))?;
            Menu::with_items(&self.app_handle, &[
                &show_app,
                &stop_session,
                &quit,
            ]).map_err(|e| TrayError::MenuUpdateFailed(e.to_string()))?
        } else {
            let start_session = MenuItem::with_id(&self.app_handle, "start_session", "Start Session", true, None::<&str>)
                .map_err(|e| TrayError::MenuUpdateFailed(e.to_string()))?;
            Menu::with_items(&self.app_handle, &[
                &show_app,
                &start_session,
                &quit,
            ]).map_err(|e| TrayError::MenuUpdateFailed(e.to_string()))?
        };

        tray_icon
            .set_menu(Some(menu))
            .map_err(|e| TrayError::MenuUpdateFailed(e.to_string()))?;

        Ok(())
    }

    pub fn update_tooltip(&self, tooltip: &str) -> TrayResult<()> {
        let tray_icon = self.tray_icon.as_ref()
            .ok_or(TrayError::NotInitialized)?;

        tray_icon
            .set_tooltip(Some(tooltip))
            .map_err(|e| TrayError::TooltipUpdateFailed(e.to_string()))?;

        Ok(())
    }

    pub fn show_notification(&self, title: &str, message: &str, notification_type: crate::commands::tray::NotificationType) -> TrayResult<()> {
        // For now, we'll emit an event to the frontend to handle notifications
        // In a future version, we could use a notification plugin
        let notification_data = serde_json::json!({
            "title": title,
            "message": message,
            "type": match notification_type {
                crate::commands::tray::NotificationType::Info => "info",
                crate::commands::tray::NotificationType::Success => "success",
                crate::commands::tray::NotificationType::Warning => "warning",
                crate::commands::tray::NotificationType::Error => "error",
            }
        });

        self.app_handle
            .emit("system-notification", notification_data)
            .map_err(|e| TrayError::MenuUpdateFailed(format!("Failed to emit notification event: {}", e)))?;

        Ok(())
    }

    pub fn destroy_tray(&mut self) -> TrayResult<()> {
        if let Some(tray_icon) = self.tray_icon.take() {
            // The tray icon will be automatically destroyed when dropped
            drop(tray_icon);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_tray_state_from_session_status() {
        assert!(matches!(
            TrayState::from(SessionStatus::Active),
            TrayState::Recording
        ));
        
        assert!(matches!(
            TrayState::from(SessionStatus::Paused),
            TrayState::Recording
        ));
        
        assert!(matches!(
            TrayState::from(SessionStatus::Completed),
            TrayState::Processing
        ));
        
        assert!(matches!(
            TrayState::from(SessionStatus::Failed("error".to_string())),
            TrayState::Idle
        ));
    }

    #[test]
    fn test_tray_state_serialization() {
        let idle_state = TrayState::Idle;
        let recording_state = TrayState::Recording;
        let processing_state = TrayState::Processing;

        // Test serialization
        let idle_json = serde_json::to_string(&idle_state).expect("Failed to serialize idle state");
        let recording_json = serde_json::to_string(&recording_state).expect("Failed to serialize recording state");
        let processing_json = serde_json::to_string(&processing_state).expect("Failed to serialize processing state");

        // Test deserialization
        let _: TrayState = serde_json::from_str(&idle_json).expect("Failed to deserialize idle state");
        let _: TrayState = serde_json::from_str(&recording_json).expect("Failed to deserialize recording state");
        let _: TrayState = serde_json::from_str(&processing_json).expect("Failed to deserialize processing state");
    }

    #[test]
    fn test_tray_error_display() {
        let creation_error = TrayError::CreationFailed("test error".to_string());
        let icon_error = TrayError::IconUpdateFailed("icon error".to_string());
        let not_initialized_error = TrayError::NotInitialized;

        assert_eq!(creation_error.to_string(), "Failed to create system tray: test error");
        assert_eq!(icon_error.to_string(), "Failed to update tray icon: icon error");
        assert_eq!(not_initialized_error.to_string(), "Tray not initialized");
    }
}