use crate::window_manager::{create_window_manager, PermissionStatus, WindowInfo};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

// Global state for the window manager
pub struct WindowManagerState {
    pub manager: Mutex<Box<dyn crate::window_manager::WindowManager + Send>>,
}

impl WindowManagerState {
    pub fn new() -> Self {
        Self {
            manager: Mutex::new(create_window_manager()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecordingSession {
    pub id: String,
    pub window_id: String,
    pub start_time: String,
    pub status: RecordingStatus,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum RecordingStatus {
    Preparing,
    Recording,
    Paused,
    Stopped,
    Error(String),
}

/// Check screen recording permission status
#[tauri::command]
pub async fn check_recording_permission(
    state: State<'_, WindowManagerState>,
) -> Result<PermissionStatus, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    Ok(manager.check_permission())
}

/// Request screen recording permission
#[tauri::command]
pub async fn request_recording_permission(
    state: State<'_, WindowManagerState>,
) -> Result<bool, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.request_permission()
}

/// Get list of available windows for recording
#[tauri::command]
pub async fn get_available_windows(
    state: State<'_, WindowManagerState>,
) -> Result<Vec<WindowInfo>, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.get_windows()
}

/// Get thumbnail for a specific window
#[tauri::command]
pub async fn get_window_thumbnail(
    window_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<Option<String>, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.get_window_thumbnail(&window_id)
}

/// Open system settings for permission management
#[tauri::command]
pub async fn open_system_settings(
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.open_system_settings()
}

/// Start recording a specific window (placeholder for Phase 2)
#[tauri::command]
pub async fn start_window_recording(
    window_id: String,
    _state: State<'_, WindowManagerState>,
) -> Result<RecordingSession, String> {
    // TODO: Implement actual recording in Phase 2
    let session = RecordingSession {
        id: uuid::Uuid::new_v4().to_string(),
        window_id,
        start_time: chrono::Utc::now().to_rfc3339(),
        status: RecordingStatus::Preparing,
    };
    
    log::info!("Starting recording session: {:?}", session);
    Ok(session)
}

/// Stop recording session (placeholder for Phase 2)
#[tauri::command]
pub async fn stop_recording(
    session_id: String,
) -> Result<(), String> {
    // TODO: Implement actual recording stop in Phase 2
    log::info!("Stopping recording session: {}", session_id);
    Ok(())
}

/// Get recording session status (placeholder for Phase 2)
#[tauri::command]
pub async fn get_recording_status(
    session_id: String,
) -> Result<RecordingStatus, String> {
    // TODO: Implement actual status tracking in Phase 2
    log::info!("Getting status for recording session: {}", session_id);
    Ok(RecordingStatus::Stopped)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_window_manager_state_creation() {
        let _state = WindowManagerState::new();
        // Just test that we can create the state without panicking
    }
}
