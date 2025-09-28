use crate::window_manager::{create_window_manager, PermissionStatus, WindowInfo};
use crate::recording_manager::{
    create_recording_manager, RecordingManager, RecordingPreferences,
    RecordingState, SharedRecordingState, ActiveRecording, RecordingInfo
};
use crate::dev_logger::{DEV_LOGGER, LogEntry};

use std::sync::{Arc, Mutex};
use tauri::State;
use std::sync::atomic::{AtomicUsize, Ordering};


// Global state for the window manager and recording
pub struct WindowManagerState {
    pub manager: Mutex<Box<dyn crate::window_manager::WindowManager + Send>>,
    pub recording_manager: Box<dyn RecordingManager>,
    pub recording_state: SharedRecordingState,
}

impl WindowManagerState {
    pub fn new() -> Self {
        Self {
            manager: Mutex::new(create_window_manager()),
            recording_manager: create_recording_manager(),
            recording_state: Arc::new(Mutex::new(RecordingState::new())),
        }
    }
}

#[derive(Default)]
pub struct PopoverGuard(pub AtomicUsize);
impl PopoverGuard {
    pub fn count(&self) -> usize { self.0.load(Ordering::SeqCst) }
}

#[tauri::command]
pub fn popover_guard_push(guard: State<'_, PopoverGuard>) {
    let _ = guard.0.fetch_add(1, Ordering::SeqCst);
}

#[tauri::command]
pub fn popover_guard_pop(guard: State<'_, PopoverGuard>) {
    let _ = guard.0.fetch_sub(1, Ordering::SeqCst);
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
    DEV_LOGGER.log("info", "Frontend requested available windows", "backend");
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    let windows = manager.get_windows();
    match &windows {
        Ok(window_list) => DEV_LOGGER.log("info", &format!("Returning {} windows to frontend", window_list.len()), "backend"),
        Err(e) => DEV_LOGGER.log("error", &format!("Failed to get windows: {}", e), "backend"),
    }
    windows
}

/// Get thumbnail for a specific window
#[tauri::command]
pub async fn get_window_thumbnail(
    window_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<Option<String>, String> {
    DEV_LOGGER.log("info", &format!("Frontend requested thumbnail for window: {}", window_id), "backend");
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    let result = manager.get_window_thumbnail(&window_id);
    match &result {
        Ok(Some(thumbnail)) => DEV_LOGGER.log("info", &format!("Thumbnail generated successfully for {}, length: {}", window_id, thumbnail.len()), "backend"),
        Ok(None) => DEV_LOGGER.log("warn", &format!("No thumbnail generated for {}", window_id), "backend"),
        Err(e) => DEV_LOGGER.log("error", &format!("Thumbnail generation failed for {}: {}", window_id, e), "backend"),
    }
    result
}



/// Open system settings for permission management
#[tauri::command]
pub async fn open_system_settings(
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.open_system_settings()
}

/// Start recording a specific window
#[tauri::command]
pub async fn start_window_recording(
    window_id: String,
    preferences: Option<RecordingPreferences>,
    state: State<'_, WindowManagerState>,
) -> Result<ActiveRecording, String> {
    DEV_LOGGER.log(
        "info",
        &format!("Starting recording for window: {}", window_id),
        "recording_commands"
    );

    let prefs = preferences.unwrap_or_default();

    let session = state.recording_manager.start_recording(
        &window_id,
        &prefs,
        state.recording_state.clone(),
    )?;

    DEV_LOGGER.log(
        "info",
        &format!("Recording started successfully: {}", session.session_id),
        "recording_commands"
    );

    Ok(session)
}

/// Stop recording session
#[tauri::command]
pub async fn stop_recording(
    session_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    DEV_LOGGER.log(
        "info",
        &format!("Stopping recording session: {}", session_id),
        "recording_commands"
    );

    state.recording_manager.stop_recording(&session_id, state.recording_state.clone())?;

    DEV_LOGGER.log(
        "info",
        &format!("Recording stopped successfully: {}", session_id),
        "recording_commands"
    );

    Ok(())
}

/// Get detailed recording session information
#[tauri::command]
pub async fn get_recording_info(
    session_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<RecordingInfo, String> {
    DEV_LOGGER.log(
        "info",
        &format!("Getting info for recording session: {}", session_id),
        "recording_commands"
    );

    let info = state.recording_manager.get_recording_info(&session_id, state.recording_state.clone())?;

    Ok(info)
}

/// Get recording session status (legacy compatibility)
#[tauri::command]
pub async fn get_recording_status(
    session_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<crate::recording_manager::RecordingStatus, String> {
    let info = state.recording_manager.get_recording_info(&session_id, state.recording_state.clone())?;
    Ok(info.session.status)
}

/// Get current recording preferences
#[tauri::command]
pub async fn get_recording_preferences(
    state: State<'_, WindowManagerState>,
) -> Result<RecordingPreferences, String> {
    let state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;
    Ok(state_guard.preferences.clone())
}

/// Update recording preferences
#[tauri::command]
pub async fn update_recording_preferences(
    preferences: RecordingPreferences,
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    let mut state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;
    state_guard.preferences = preferences;

    // TODO: Persist preferences to Tauri store
    DEV_LOGGER.log("info", "Recording preferences updated", "recording_commands");
    Ok(())
}

/// Get default save directory
#[tauri::command]
pub async fn get_default_save_directory(
    state: State<'_, WindowManagerState>,
) -> Result<String, String> {
    let default_dir = state.recording_manager.get_default_save_directory()?;
    Ok(default_dir.to_string_lossy().to_string())
}

/// Validate a save directory
#[tauri::command]
pub async fn validate_save_directory(
    path: String,
    state: State<'_, WindowManagerState>,
) -> Result<bool, String> {
    let path_buf = std::path::PathBuf::from(path);
    state.recording_manager.validate_save_directory(&path_buf)
}

/// Open file dialog to select save directory
#[tauri::command]
pub async fn select_save_directory(
    app_handle: tauri::AppHandle,
    state: State<'_, WindowManagerState>,
) -> Result<Option<String>, String> {
    DEV_LOGGER.log("info", "Opening folder selection dialog", "recording_commands");

    // Resolve current directory to seed the dialog
    let current_dir = {
        let state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;
        state_guard
            .preferences
            .save_directory
            .clone()
            .or_else(|| state.recording_manager.get_default_save_directory().ok())
    };

    // Use async callback approach instead of blocking
    use tauri_plugin_dialog::DialogExt;
    use tokio::sync::oneshot;

    let (tx, rx) = oneshot::channel();

    // Dispatch the dialog creation to the main thread to avoid macOS threading issues
    let app_handle_clone = app_handle.clone();
    let current_dir_clone = current_dir.clone();

    app_handle
        .run_on_main_thread(move || {
            let mut dialog = app_handle_clone
                .dialog()
                .file()
                .set_title("Select Recording Save Directory");

            if let Some(ref dir) = current_dir_clone {
                dialog = dialog.set_directory(dir);
            }

            dialog.pick_folder(move |result| {
                let _ = tx.send(result);
            });
        })
        .map_err(|e| format!("Failed to dispatch to main thread: {}", e))?;

    // Wait for the dialog result
    let folder_path = rx.await.map_err(|_| "Dialog channel error".to_string())?;

    match folder_path {
        Some(file_path) => {
            // Convert FilePath to PathBuf - handle potential None case
            let path = match file_path.as_path() {
                Some(path) => std::path::PathBuf::from(path),
                None => return Err("Invalid file path selected".to_string()),
            };

            // Validate the selected directory
            match state.recording_manager.validate_save_directory(&path) {
                Ok(true) => {
                    DEV_LOGGER.log(
                        "info",
                        &format!("Save directory selected: {}", path.display()),
                        "recording_commands",
                    );
                    Ok(Some(path.to_string_lossy().to_string()))
                }
                Ok(false) => Err("Selected directory is not writable".to_string()),
                Err(e) => Err(format!("Directory validation failed: {}", e)),
            }
        }
        None => {
            // User cancelled the dialog
            Ok(None)
        }
    }
}

/// Check health of active recording
#[tauri::command]
pub async fn check_recording_health(
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    state.recording_manager.check_recording_health(state.recording_state.clone())
}

/// Clean up any orphaned recording processes
#[tauri::command]
pub async fn cleanup_orphaned_recordings(
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    DEV_LOGGER.log("info", "Cleaning up orphaned recordings", "recording_commands");
    state.recording_manager.cleanup_orphaned_recordings()
}

/// Pause recording session
#[tauri::command]
pub async fn pause_recording(
    session_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    DEV_LOGGER.log(
        "info",
        &format!("Pausing recording session: {}", session_id),
        "recording_commands"
    );

    state.recording_manager.pause_recording(&session_id, state.recording_state.clone())
}

/// Resume recording session
#[tauri::command]
pub async fn resume_recording(
    session_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    DEV_LOGGER.log(
        "info",
        &format!("Resuming recording session: {}", session_id),
        "recording_commands"
    );

    state.recording_manager.resume_recording(&session_id, state.recording_state.clone())
}

/// Get current active recording session (if any)
#[tauri::command]
pub async fn get_active_recording_session(
    state: State<'_, WindowManagerState>,
) -> Result<Option<ActiveRecording>, String> {
    let state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;
    Ok(state_guard.get_active_session())
}

/// Check if there's an active recording
#[tauri::command]
pub async fn has_active_recording(
    state: State<'_, WindowManagerState>,
) -> Result<bool, String> {
    let state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;
    Ok(state_guard.has_active_recording())
}

/// Clear active recording state (for cleanup after errors)
#[tauri::command]
pub async fn clear_active_recording(
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    DEV_LOGGER.log("info", "Clearing active recording state", "recording_commands");
    let mut state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;
    state_guard.clear_active_recording();
    Ok(())
}

/// Initialize recording system (called on app startup)
#[tauri::command]
pub async fn initialize_recording_system(
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    DEV_LOGGER.log("info", "Initializing recording system", "recording_commands");

    // Clean up any orphaned processes from previous sessions
    state.recording_manager.cleanup_orphaned_recordings()?;

    // TODO: Load persisted recording preferences from Tauri store

    DEV_LOGGER.log("info", "Recording system initialized successfully", "recording_commands");
    Ok(())
}

/// Handle app shutdown (cleanup active recordings)
#[tauri::command]
pub async fn shutdown_recording_system(
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    DEV_LOGGER.log("info", "Shutting down recording system", "recording_commands");

    // Check if there's an active recording
    let session_id = {
        let state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;
        state_guard.get_active_session().map(|session| session.session_id)
    };

    // Stop active recording if any
    if let Some(id) = session_id {
        DEV_LOGGER.log("warn", "Stopping active recording due to app shutdown", "recording_commands");
        let _ = state.recording_manager.stop_recording(&id, state.recording_state.clone());
    }

    // TODO: Persist recording preferences to Tauri store

    DEV_LOGGER.log("info", "Recording system shutdown complete", "recording_commands");
    Ok(())
}

/// Validate that a window still exists and is recordable
#[tauri::command]
pub async fn validate_recording_window(
    window_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<bool, String> {
    DEV_LOGGER.log(
        "info",
        &format!("Validating recording window: {}", window_id),
        "recording_commands"
    );

    // Get current windows list
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    let windows = manager.get_windows()?;

    // Check if the window still exists
    let window_exists = windows.iter().any(|w| w.id == window_id);

    if !window_exists {
        DEV_LOGGER.log(
            "warn",
            &format!("Window {} no longer exists", window_id),
            "recording_commands"
        );
    }

    Ok(window_exists)
}

/// Get recording system status and diagnostics
#[tauri::command]
pub async fn get_recording_system_status(
    state: State<'_, WindowManagerState>,
) -> Result<serde_json::Value, String> {
    let state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;

    let status = serde_json::json!({
        "has_active_recording": state_guard.has_active_recording(),
        "active_session": state_guard.get_active_session(),
        "preferences": state_guard.preferences,
        "default_save_directory": state.recording_manager.get_default_save_directory().ok()
            .map(|p| p.to_string_lossy().to_string()),
    });

    Ok(status)
}

// Dev Logger Commands

/// Add a log entry from the frontend
#[tauri::command]
pub async fn dev_log_add(level: String, message: String) -> Result<(), String> {
    DEV_LOGGER.log(&level, &message, "frontend");
    Ok(())
}

/// Get all dev logs
#[tauri::command]
pub async fn dev_log_get() -> Result<Vec<LogEntry>, String> {
    Ok(DEV_LOGGER.get_logs())
}

/// Clear all dev logs
#[tauri::command]
pub async fn dev_log_clear() -> Result<(), String> {
    DEV_LOGGER.clear_logs();
    Ok(())
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
