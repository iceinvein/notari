use crate::events::EventEmitter;
use crate::evidence::proof_pack::ProofPackMetadata;
use crate::logger::{LogEntry, LogLevel, LOGGER};
use crate::recording_manager::{
    create_recording_manager, ActiveRecordingWithStatus, RecordingInfo, RecordingManager,
    RecordingPreferences, RecordingState, SharedRecordingState,
};
use crate::window_manager::{create_window_manager, PermissionStatus, WindowInfo};

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, State};

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
    pub fn count(&self) -> usize {
        self.0.load(Ordering::SeqCst)
    }
}

#[tauri::command]
pub fn popover_guard_push(guard: State<'_, PopoverGuard>) {
    let _ = guard.0.fetch_add(1, Ordering::SeqCst);
}

#[tauri::command]
pub fn popover_guard_pop(guard: State<'_, PopoverGuard>) {
    let _ = guard.0.fetch_sub(1, Ordering::SeqCst);
}

/// Get system temp directory
#[tauri::command]
pub fn get_temp_dir() -> Result<String, String> {
    std::env::temp_dir()
        .to_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to get temp directory".to_string())
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
    manager.request_permission().map_err(Into::into)
}

/// Get list of available windows for recording
#[tauri::command]
pub async fn get_available_windows(
    state: State<'_, WindowManagerState>,
) -> Result<Vec<WindowInfo>, String> {
    LOGGER.log(
        LogLevel::Info,
        "Frontend requested available windows",
        "backend",
    );
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    let windows = manager.get_windows().map_err(Into::into);
    match &windows {
        Ok(window_list) => LOGGER.log(
            LogLevel::Info,
            &format!("Returning {} windows to frontend", window_list.len()),
            "backend",
        ),
        Err(e) => LOGGER.log(
            LogLevel::Error,
            &format!("Failed to get windows: {}", e),
            "backend",
        ),
    }
    windows
}

/// Get thumbnail for a specific window
#[tauri::command]
pub async fn get_window_thumbnail(
    window_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<Option<String>, String> {
    LOGGER.log(
        LogLevel::Info,
        &format!("Frontend requested thumbnail for window: {}", window_id),
        "backend",
    );
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    let result = manager.get_window_thumbnail(&window_id).map_err(Into::into);
    match &result {
        Ok(Some(thumbnail)) => LOGGER.log(
            LogLevel::Info,
            &format!(
                "Thumbnail generated successfully for {}, length: {}",
                window_id,
                thumbnail.len()
            ),
            "backend",
        ),
        Ok(None) => LOGGER.log(
            LogLevel::Warn,
            &format!("No thumbnail generated for {}", window_id),
            "backend",
        ),
        Err(e) => LOGGER.log(
            LogLevel::Error,
            &format!("Thumbnail generation failed for {}: {}", window_id, e),
            "backend",
        ),
    }
    result
}

/// Open system settings for permission management
#[tauri::command]
pub async fn open_system_settings(state: State<'_, WindowManagerState>) -> Result<(), String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    manager.open_system_settings().map_err(Into::into)
}

/// Start recording a specific window
#[tauri::command]
pub async fn start_window_recording(
    window_id: String,
    preferences: Option<RecordingPreferences>,
    encryption_password: Option<String>,
    encryption_method: Option<String>,
    encryption_recipients: Option<Vec<serde_json::Value>>,
    recording_title: Option<String>,
    recording_description: Option<String>,
    recording_tags: Option<Vec<String>>,
    state: State<'_, WindowManagerState>,
    app: AppHandle,
) -> Result<ActiveRecordingWithStatus, String> {
    let method = encryption_method.as_deref().unwrap_or("password");
    LOGGER.log(
        LogLevel::Info,
        &format!(
            "Starting recording for window: {} (encryption_password: {:?}, encryption_method: {:?}, encryption_recipients: {:?})",
            window_id,
            encryption_password.as_ref().map(|_| "<redacted>"),
            encryption_method,
            encryption_recipients.as_ref().map(|r| r.len())
        ),
        "recording_commands",
    );

    let prefs = preferences.unwrap_or_default();

    // Validate encryption settings
    if method == "password" {
        if let Some(ref pwd) = encryption_password {
            use crate::evidence::validate_password;
            validate_password(pwd)?;
        }
    } else if method == "public-key" {
        if encryption_recipients.is_none() || encryption_recipients.as_ref().unwrap().is_empty() {
            return Err("At least one recipient is required for public key encryption".to_string());
        }
    }

    // Get window information before starting recording
    let window_info = {
        let manager = state.manager.lock().map_err(|e| e.to_string())?;
        manager
            .get_windows()?
            .into_iter()
            .find(|w| w.id == window_id)
    };

    let mut session = state.recording_manager.start_recording(
        &window_id,
        &prefs,
        window_info,
        state.recording_state.clone(),
    )?;

    // Store encryption settings and metadata in session (will be used during stop_recording)
    session.encryption_password = encryption_password;
    session.encryption_method = encryption_method;

    // Convert recipients to EncryptionRecipient structs
    session.encryption_recipients = encryption_recipients.map(|recipients| {
        recipients
            .into_iter()
            .filter_map(|r| {
                Some(crate::recording_manager::EncryptionRecipient {
                    id: r["id"].as_str()?.to_string(),
                    public_key: r["publicKey"].as_str()?.to_string(),
                })
            })
            .collect()
    });

    session.recording_title = recording_title;
    session.recording_description = recording_description;
    session.recording_tags = recording_tags;

    // Update the session in the recording state
    {
        let mut recording_state = state.recording_state.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut active) = recording_state.active_recording {
            active.session.encryption_password = session.encryption_password.clone();
            active.session.encryption_method = session.encryption_method.clone();
            active.session.encryption_recipients = session.encryption_recipients.clone();
            active.session.recording_title = session.recording_title.clone();
            active.session.recording_description = session.recording_description.clone();
            active.session.recording_tags = session.recording_tags.clone();
        }
    }

    LOGGER.log(
        LogLevel::Info,
        &format!("Recording started successfully: {}", session.session_id),
        "recording_commands",
    );

    // Transition state machine: Idle → Preparing → Recording
    #[cfg(target_os = "macos")]
    {
        use crate::recording_manager::macos::MacOSRecordingManager;
        if let Some(manager) = state
            .recording_manager
            .as_any()
            .downcast_ref::<MacOSRecordingManager>()
        {
            // Transition to Preparing
            if let Err(e) = manager.transition_to_preparing(
                &session.session_id,
                state.recording_state.clone(),
                &app,
            ) {
                LOGGER.log(
                    LogLevel::Warn,
                    &format!("Failed to transition to Preparing: {}", e),
                    "recording_commands",
                );
            }

            // Transition to Recording
            if let Err(e) = manager.transition_to_recording(
                &session.session_id,
                state.recording_state.clone(),
                &app,
            ) {
                LOGGER.log(
                    LogLevel::Warn,
                    &format!("Failed to transition to Recording: {}", e),
                    "recording_commands",
                );
            }
        }
    }

    // Get status from state machine
    let status = {
        let state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;
        if let Some(ref recording) = state_guard.active_recording {
            recording.get_status()
        } else {
            crate::recording_manager::RecordingStatus::Idle
        }
    };

    Ok(session.with_status(status))
}

/// Stop recording session
#[tauri::command]
pub async fn stop_recording(
    session_id: String,
    state: State<'_, WindowManagerState>,
    app: AppHandle,
) -> Result<(), String> {
    LOGGER.log(
        LogLevel::Info,
        &format!("Stopping recording session: {}", session_id),
        "recording_commands",
    );

    // Parse session_id to UUID for event emission
    let _session_uuid = uuid::Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;

    // Transition state machine: Recording → Stopping
    #[cfg(target_os = "macos")]
    {
        use crate::recording_manager::macos::MacOSRecordingManager;
        if let Some(manager) = state
            .recording_manager
            .as_any()
            .downcast_ref::<MacOSRecordingManager>()
        {
            if let Err(e) =
                manager.transition_to_stopping(&session_id, state.recording_state.clone(), &app)
            {
                LOGGER.log(
                    LogLevel::Warn,
                    &format!("Failed to transition to Stopping: {}", e),
                    "recording_commands",
                );
            }
        }
    }

    // Stop the recording (stops the process)
    state
        .recording_manager
        .stop_recording(&session_id, state.recording_state.clone())?;

    LOGGER.log(
        LogLevel::Info,
        &format!("Recording stopped successfully: {}", session_id),
        "recording_commands",
    );

    // Process the recording using the pipeline (hashing, encryption, manifest, packaging)
    // This is done in a separate step so the frontend can show progress
    #[cfg(target_os = "macos")]
    {
        use crate::recording_manager::macos::MacOSRecordingManager;
        if let Some(manager) = state
            .recording_manager
            .as_any()
            .downcast_ref::<MacOSRecordingManager>()
        {
            LOGGER.log(
                LogLevel::Info,
                &format!("Starting post-processing for recording: {}", session_id),
                "recording_commands",
            );

            match manager.process_recording(&session_id, state.recording_state.clone(), &app) {
                Ok(_) => {
                    LOGGER.log(
                        LogLevel::Info,
                        &format!("Post-processing completed successfully: {}", session_id),
                        "recording_commands",
                    );
                }
                Err(e) => {
                    LOGGER.log(
                        LogLevel::Error,
                        &format!("Post-processing failed: {}", e),
                        "recording_commands",
                    );
                    // Error is already logged and state machine transitioned to Failed
                    // in process_recording(), so we just log here for command context
                }
            }
        }
    }

    Ok(())
}

/// Get detailed recording session information
#[tauri::command]
pub async fn get_recording_info(
    session_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<RecordingInfo, String> {
    LOGGER.log(
        LogLevel::Info,
        &format!("Getting info for recording session: {}", session_id),
        "recording_commands",
    );

    let info = state
        .recording_manager
        .get_recording_info(&session_id, state.recording_state.clone())?;

    Ok(info)
}

/// Get recording session status (legacy compatibility)
#[tauri::command]
pub async fn get_recording_status(
    session_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<crate::recording_manager::RecordingStatus, String> {
    let state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;
    if let Some(ref recording) = state_guard.active_recording {
        if recording.session.session_id == session_id {
            return Ok(recording.get_status());
        }
    }
    Err("Recording not found".to_string())
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
    state_guard.preferences = preferences.clone();

    // Persist preferences to repository
    use crate::repository::PreferencesRepository;
    let repo_manager = crate::repository::get_repository_manager();
    if let Err(e) = repo_manager.preferences().save_preferences(&preferences) {
        LOGGER.log(
            LogLevel::Warn,
            &format!("Failed to persist recording preferences: {}", e),
            "recording_commands",
        );
    } else {
        LOGGER.log(
            LogLevel::Info,
            "Recording preferences updated and persisted",
            "recording_commands",
        );
    }

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
    state
        .recording_manager
        .validate_save_directory(&path_buf)
        .map_err(Into::into)
}

/// Open file dialog to select save directory
#[tauri::command]
pub async fn select_save_directory(
    app_handle: tauri::AppHandle,
    state: State<'_, WindowManagerState>,
) -> Result<Option<String>, String> {
    LOGGER.log(
        LogLevel::Info,
        "Opening folder selection dialog",
        "recording_commands",
    );

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
                    LOGGER.log(
                        LogLevel::Info,
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
pub async fn check_recording_health(state: State<'_, WindowManagerState>) -> Result<(), String> {
    state
        .recording_manager
        .check_recording_health(state.recording_state.clone())
        .map_err(Into::into)
}

/// Clean up any orphaned recording processes
#[tauri::command]
pub async fn cleanup_orphaned_recordings(
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    LOGGER.log(
        LogLevel::Info,
        "Cleaning up orphaned recordings",
        "recording_commands",
    );
    state
        .recording_manager
        .cleanup_orphaned_recordings()
        .map_err(Into::into)
}

/// Pause recording session
#[tauri::command]
pub async fn pause_recording(
    session_id: String,
    state: State<'_, WindowManagerState>,
    app: AppHandle,
) -> Result<(), String> {
    LOGGER.log(
        LogLevel::Info,
        &format!("Pausing recording session: {}", session_id),
        "recording_commands",
    );

    // Parse session_id to UUID for event emission
    let session_uuid = uuid::Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;

    state
        .recording_manager
        .pause_recording(&session_id, state.recording_state.clone())
        .map_err(|e: crate::error::NotariError| e.to_string())?;

    // Emit recording state changed event
    let _ = EventEmitter::recording_state_changed(&app, session_uuid, "Paused");

    Ok(())
}

/// Resume recording session
#[tauri::command]
pub async fn resume_recording(
    session_id: String,
    state: State<'_, WindowManagerState>,
    app: AppHandle,
) -> Result<(), String> {
    LOGGER.log(
        LogLevel::Info,
        &format!("Resuming recording session: {}", session_id),
        "recording_commands",
    );

    // Parse session_id to UUID for event emission
    let session_uuid = uuid::Uuid::parse_str(&session_id).map_err(|e| e.to_string())?;

    state
        .recording_manager
        .resume_recording(&session_id, state.recording_state.clone())
        .map_err(|e: crate::error::NotariError| e.to_string())?;

    // Emit recording state changed event
    let _ = EventEmitter::recording_state_changed(&app, session_uuid, "Recording");

    Ok(())
}

/// Emit recording progress event for active recording (called periodically)
pub async fn emit_recording_progress_event(
    state: State<'_, WindowManagerState>,
    app: &AppHandle,
) -> Result<(), String> {
    // Get active recording info
    let recording_state = state.recording_state.lock().map_err(|e| e.to_string())?;

    if let Some(ref active) = recording_state.active_recording {
        // Only emit if recording is actually active
        if active.get_status() == crate::recording_manager::RecordingStatus::Recording {
            let session_uuid =
                uuid::Uuid::parse_str(&active.session.session_id).map_err(|e| e.to_string())?;

            // Calculate duration
            let start_time = active.session.start_time;
            let duration_seconds = (chrono::Utc::now() - start_time).num_seconds() as u64;

            // Get file size
            let file_size_bytes = if active.session.output_path.exists() {
                std::fs::metadata(&active.session.output_path)
                    .map(|m| m.len())
                    .unwrap_or(0)
            } else {
                0
            };

            // Emit progress event
            let _ = EventEmitter::recording_progress(
                app,
                session_uuid,
                duration_seconds,
                file_size_bytes,
            );
        }
    } else {
        return Err("No active recording".to_string());
    }

    Ok(())
}

/// Get current active recording session (if any)
#[tauri::command]
pub async fn get_active_recording_session(
    state: State<'_, WindowManagerState>,
) -> Result<Option<ActiveRecordingWithStatus>, String> {
    let state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;
    if let Some(session) = state_guard.get_active_session() {
        let status = state_guard
            .active_recording
            .as_ref()
            .map(|r| r.get_status())
            .unwrap_or(crate::recording_manager::RecordingStatus::Idle);
        Ok(Some(session.with_status(status)))
    } else {
        Ok(None)
    }
}

/// Check if there's an active recording
#[tauri::command]
pub async fn has_active_recording(state: State<'_, WindowManagerState>) -> Result<bool, String> {
    let state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;
    Ok(state_guard.has_active_recording())
}

/// Clear active recording state (for cleanup after errors)
#[tauri::command]
pub async fn clear_active_recording(state: State<'_, WindowManagerState>) -> Result<(), String> {
    LOGGER.log(
        LogLevel::Info,
        "Clearing active recording state",
        "recording_commands",
    );
    let mut state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;
    state_guard.clear_active_recording();
    Ok(())
}

/// Initialize recording system (called on app startup)
#[tauri::command]
pub async fn initialize_recording_system(
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    LOGGER.log(
        LogLevel::Info,
        "Initializing recording system",
        "recording_commands",
    );

    // Clean up any orphaned processes from previous sessions
    state.recording_manager.cleanup_orphaned_recordings()?;

    // TODO: Load persisted recording preferences from Tauri store

    LOGGER.log(
        LogLevel::Info,
        "Recording system initialized successfully",
        "recording_commands",
    );
    Ok(())
}

/// Handle app shutdown (cleanup active recordings)
#[tauri::command]
pub async fn shutdown_recording_system(state: State<'_, WindowManagerState>) -> Result<(), String> {
    LOGGER.log(
        LogLevel::Info,
        "Shutting down recording system",
        "recording_commands",
    );

    // Check if there's an active recording
    let session_id = {
        let state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;
        state_guard
            .get_active_session()
            .map(|session| session.session_id)
    };

    // Stop active recording if any
    if let Some(id) = session_id {
        LOGGER.log(
            LogLevel::Warn,
            "Stopping active recording due to app shutdown",
            "recording_commands",
        );
        let _ = state
            .recording_manager
            .stop_recording(&id, state.recording_state.clone());
    }

    // TODO: Persist recording preferences to Tauri store

    LOGGER.log(
        LogLevel::Info,
        "Recording system shutdown complete",
        "recording_commands",
    );
    Ok(())
}

/// Validate that a window still exists and is recordable
#[tauri::command]
pub async fn validate_recording_window(
    window_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<bool, String> {
    LOGGER.log(
        LogLevel::Info,
        &format!("Validating recording window: {}", window_id),
        "recording_commands",
    );

    // Get current windows list
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    let windows = manager.get_windows()?;

    // Check if the window still exists
    let window_exists = windows.iter().any(|w| w.id == window_id);

    if !window_exists {
        LOGGER.log(
            LogLevel::Warn,
            &format!("Window {} no longer exists", window_id),
            "recording_commands",
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

// Logger Commands

/// Add a log entry from the frontend
#[tauri::command]
pub async fn log_add(level: String, message: String) -> Result<(), String> {
    let log_level = LogLevel::from_str(&level).unwrap_or(LogLevel::Info);
    LOGGER.log(log_level, &message, "frontend");
    Ok(())
}

/// Get all logs
#[tauri::command]
pub async fn log_get() -> Result<Vec<LogEntry>, String> {
    Ok(LOGGER.get_logs())
}

/// Clear all logs
#[tauri::command]
pub async fn log_clear() -> Result<(), String> {
    LOGGER.clear_logs();
    Ok(())
}

/// Set minimum log level (runtime filtering)
#[tauri::command]
pub async fn log_set_min_level(level: String) -> Result<(), String> {
    let log_level = LogLevel::from_str(&level).unwrap_or(LogLevel::Info);
    LOGGER.set_min_level(log_level);
    Ok(())
}

/// Get current minimum log level
#[tauri::command]
pub async fn log_get_min_level() -> Result<String, String> {
    Ok(LOGGER.get_min_level().as_str().to_string())
}

// Evidence System Commands

/// Verify a recording's evidence (standard verification - offline only)
#[tauri::command]
pub async fn verify_recording(
    manifest_path: String,
    video_path: String,
) -> Result<crate::evidence::VerificationReport, String> {
    // Extract from .notari file
    let (resolved_video, resolved_manifest, temp_dir) =
        resolve_recording_paths(&video_path, &manifest_path)?;

    let result = crate::evidence::Verifier::verify(&resolved_manifest, &resolved_video)
        .map_err(|e| format!("Verification failed: {}", e));

    // Cleanup temp files
    let _ = std::fs::remove_dir_all(&temp_dir);

    result
}

/// Deep verification with on-chain blockchain verification
#[tauri::command]
pub async fn verify_recording_deep(
    state: tauri::State<'_, crate::blockchain_commands::BlockchainState>,
    manifest_path: String,
    video_path: String,
) -> Result<crate::evidence::VerificationReport, String> {
    use crate::evidence::blockchain::{
        BlockchainAnchorer, BlockchainEnvironment, EthereumAnchorer, MockAnchorer, WalletManager,
    };

    // Extract from .notari file
    let (resolved_video, resolved_manifest, temp_dir) =
        resolve_recording_paths(&video_path, &manifest_path)?;

    // Get blockchain config
    let (environment, chain_config, wallet_config) = {
        let config_lock = state.config.lock().map_err(|e| e.to_string())?;
        let config = config_lock.as_ref().ok_or("Blockchain not configured")?;

        (
            config.environment.clone(),
            config.chain.clone(),
            config.wallet.clone(),
        )
    };

    // Create anchorer for verification
    let anchorer: Box<dyn BlockchainAnchorer> = match environment {
        BlockchainEnvironment::Mock => Box::new(MockAnchorer::new()),
        _ => {
            let wallet = wallet_config.ok_or("No wallet configured for deep verification")?;
            let private_key =
                WalletManager::get_private_key(chain_config.chain_id, &wallet.address)
                    .map_err(|e| e.to_string())?;

            Box::new(
                EthereumAnchorer::new(
                    &chain_config.rpc_url,
                    &private_key,
                    &chain_config.contract_address,
                    chain_config.chain_id,
                    &chain_config.name,
                    &chain_config.explorer_url,
                )
                .map_err(|e| e.to_string())?,
            )
        }
    };

    // Perform deep verification
    let result = crate::evidence::Verifier::verify_deep(
        &resolved_manifest,
        &resolved_video,
        anchorer.as_ref(),
    )
    .await
    .map_err(|e| format!("Deep verification failed: {}", e));

    // Cleanup temp files
    let _ = std::fs::remove_dir_all(&temp_dir);

    result
}

/// Get evidence manifest for a recording (extracts from .notari if needed)
#[tauri::command]
pub async fn get_evidence_manifest(
    manifest_path: String,
) -> Result<crate::evidence::EvidenceManifest, String> {
    // Extract from .notari file
    let (_, resolved_manifest, temp_dir) = resolve_recording_paths(&manifest_path, &manifest_path)?;

    let manifest = crate::evidence::EvidenceManifest::load(&resolved_manifest)
        .map_err(|e| format!("Failed to load manifest: {}", e))?;

    // Cleanup temp files
    let _ = std::fs::remove_dir_all(&temp_dir);

    Ok(manifest)
}

/// Export public key for sharing
#[tauri::command]
pub async fn export_public_key() -> Result<String, String> {
    use crate::evidence::keychain;
    use crate::evidence::signature::KeyManager;

    if !keychain::has_signing_key() {
        return Err("No signing key found".to_string());
    }

    let key_bytes =
        keychain::retrieve_signing_key().map_err(|e| format!("Failed to retrieve key: {}", e))?;

    let key_manager =
        KeyManager::from_bytes(&key_bytes).map_err(|e| format!("Failed to load key: {}", e))?;

    let public_key = key_manager.public_key();
    use base64::{engine::general_purpose, Engine as _};
    Ok(general_purpose::STANDARD.encode(public_key.as_bytes()))
}

/// Check if signing key exists
#[tauri::command]
pub async fn has_signing_key() -> Result<bool, String> {
    use crate::evidence::keychain;
    Ok(keychain::has_signing_key())
}

/// Generate new signing key (overwrites existing)
#[tauri::command]
pub async fn generate_signing_key() -> Result<String, String> {
    use crate::evidence::keychain;
    use crate::evidence::signature::KeyManager;

    let key_manager = KeyManager::generate();
    keychain::store_signing_key(&key_manager.to_bytes())
        .map_err(|e| format!("Failed to store key: {}", e))?;

    let public_key = key_manager.public_key();
    use base64::{engine::general_purpose, Engine as _};
    Ok(general_purpose::STANDARD.encode(public_key.as_bytes()))
}

/// Get diagnostic info about signing key
#[tauri::command]
pub async fn get_signing_key_info() -> Result<serde_json::Value, String> {
    use crate::evidence::keychain;
    use crate::evidence::signature::KeyManager;
    use base64::{engine::general_purpose, Engine as _};

    let has_key = keychain::has_signing_key();

    if !has_key {
        return Ok(serde_json::json!({
            "has_key": false,
            "public_key": null,
            "error": null
        }));
    }

    match keychain::retrieve_signing_key() {
        Ok(key_bytes) => match KeyManager::from_bytes(&key_bytes) {
            Ok(key_manager) => {
                let public_key = key_manager.public_key();
                Ok(serde_json::json!({
                    "has_key": true,
                    "public_key": general_purpose::STANDARD.encode(public_key.as_bytes()),
                    "error": null
                }))
            }
            Err(e) => Ok(serde_json::json!({
                "has_key": true,
                "public_key": null,
                "error": format!("Failed to load key: {}", e)
            })),
        },
        Err(e) => Ok(serde_json::json!({
            "has_key": true,
            "public_key": null,
            "error": format!("Failed to retrieve key: {}", e)
        })),
    }
}

// ============================================================================
// Encryption Key Commands (X25519)
// ============================================================================

/// Generate new encryption key (overwrites existing)
#[tauri::command]
pub async fn generate_encryption_key() -> Result<String, String> {
    use crate::evidence::keychain;
    use crate::evidence::EncryptionKeyManager;

    let key_manager = EncryptionKeyManager::generate();
    keychain::store_encryption_key(&key_manager.to_bytes())
        .map_err(|e| format!("Failed to store encryption key: {}", e))?;

    Ok(key_manager.export_public_key())
}

/// Export encryption public key
#[tauri::command]
pub async fn export_encryption_public_key() -> Result<String, String> {
    use crate::evidence::keychain;
    use crate::evidence::EncryptionKeyManager;

    if !keychain::has_encryption_key() {
        return Err("No encryption key found".to_string());
    }

    let key_bytes = keychain::retrieve_encryption_key()
        .map_err(|e| format!("Failed to retrieve encryption key: {}", e))?;

    let key_manager = EncryptionKeyManager::from_bytes(&key_bytes)
        .map_err(|e| format!("Failed to load encryption key: {}", e))?;

    Ok(key_manager.export_public_key())
}

/// Check if encryption key exists
#[tauri::command]
pub async fn has_encryption_key() -> Result<bool, String> {
    use crate::evidence::keychain;
    Ok(keychain::has_encryption_key())
}

/// Delete encryption key
#[tauri::command]
pub async fn delete_encryption_key() -> Result<(), String> {
    use crate::evidence::keychain;
    keychain::delete_encryption_key().map_err(|e| format!("Failed to delete encryption key: {}", e))
}

/// Import a recipient's public key (for validation)
/// Returns the recipient's public key in base64 format if valid
#[tauri::command]
pub async fn validate_recipient_public_key(public_key_b64: String) -> Result<String, String> {
    use crate::evidence::EncryptionKeyManager;

    // Try to import it to validate
    EncryptionKeyManager::import_public_key(&public_key_b64)
        .map_err(|e| format!("Invalid public key: {}", e))?;

    Ok(public_key_b64)
}

// ============================================================================
// Video Encryption Commands
// ============================================================================

/// Encrypt a video file
#[tauri::command]
pub async fn encrypt_video(
    input_path: String,
    output_path: String,
    password: String,
) -> Result<crate::evidence::EncryptionInfo, String> {
    use crate::evidence::{validate_password, VideoEncryptor};

    validate_password(&password)?;

    VideoEncryptor::encrypt_file(&input_path, &output_path, &password)
        .map_err(|e| format!("Encryption failed: {}", e))
}

/// Decrypt a video file
#[tauri::command]
pub async fn decrypt_video(
    input_path: String,
    output_path: String,
    password: String,
    encryption_info: crate::evidence::EncryptionInfo,
) -> Result<(), String> {
    use crate::evidence::VideoEncryptor;

    VideoEncryptor::decrypt_file(&input_path, &output_path, &password, &encryption_info)
        .map_err(|e| format!("Decryption failed: {}", e))
}

/// Encrypt a video file with public key encryption
///
/// recipients: Array of {id: string, publicKey: string} objects
#[tauri::command]
pub async fn encrypt_video_with_public_keys(
    input_path: String,
    output_path: String,
    recipients: Vec<serde_json::Value>,
) -> Result<crate::evidence::EncryptionInfo, String> {
    use crate::evidence::{EncryptionKeyManager, VideoEncryptor};

    if recipients.is_empty() {
        return Err("At least one recipient is required".to_string());
    }

    // Parse recipients
    let mut recipient_keys = Vec::new();
    for recipient in recipients {
        let id = recipient["id"]
            .as_str()
            .ok_or("Missing recipient id")?
            .to_string();
        let public_key_b64 = recipient["publicKey"]
            .as_str()
            .ok_or("Missing recipient publicKey")?;

        let public_key = EncryptionKeyManager::import_public_key(public_key_b64)
            .map_err(|e| format!("Invalid public key for {}: {}", id, e))?;

        recipient_keys.push((id, public_key));
    }

    VideoEncryptor::encrypt_file_with_public_keys(&input_path, &output_path, recipient_keys)
        .map_err(|e| format!("Encryption failed: {}", e))
}

/// Decrypt a video file with private key
#[tauri::command]
pub async fn decrypt_video_with_private_key(
    input_path: String,
    output_path: String,
    encryption_info: crate::evidence::EncryptionInfo,
) -> Result<(), String> {
    use crate::evidence::{keychain, EncryptionKeyManager, VideoEncryptor};

    // Get private key from keychain
    if !keychain::has_encryption_key() {
        return Err(
            "No encryption key found. Please generate an encryption key first.".to_string(),
        );
    }

    let key_bytes = keychain::retrieve_encryption_key()
        .map_err(|e| format!("Failed to retrieve encryption key: {}", e))?;

    let key_manager = EncryptionKeyManager::from_bytes(&key_bytes)
        .map_err(|e| format!("Failed to load encryption key: {}", e))?;

    let private_key = key_manager.secret_key();

    VideoEncryptor::decrypt_file_with_private_key(
        &input_path,
        &output_path,
        private_key,
        &encryption_info,
    )
    .map_err(|e| format!("Decryption failed: {}", e))
}

/// Validate encryption password strength
#[tauri::command]
pub async fn validate_encryption_password(password: String) -> Result<(), String> {
    use crate::evidence::validate_password;
    validate_password(&password).map_err(Into::into)
}

/// Read a file's contents as a string
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    use std::fs;
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Read manifest from a .notari proof pack file
#[tauri::command]
pub async fn read_manifest_from_notari(notari_path: String) -> Result<String, String> {
    use std::fs::File;
    use std::io::Read;
    use zip::ZipArchive;

    LOGGER.log(
        LogLevel::Info,
        &format!("Reading manifest from .notari file: {}", notari_path),
        "recording_commands",
    );

    let file =
        File::open(&notari_path).map_err(|e| format!("Failed to open .notari file: {}", e))?;

    let mut archive =
        ZipArchive::new(file).map_err(|e| format!("Failed to read .notari archive: {}", e))?;

    // Find the manifest file (evidence/*.json)
    for i in 0..archive.len() {
        let mut file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;

        let name = file.name().to_string();
        if name.starts_with("evidence/") && name.ends_with(".json") {
            let mut contents = String::new();
            file.read_to_string(&mut contents)
                .map_err(|e| format!("Failed to read manifest: {}", e))?;

            LOGGER.log(
                LogLevel::Info,
                &format!("Found manifest in .notari: {}", name),
                "recording_commands",
            );

            return Ok(contents);
        }
    }

    Err("No manifest found in .notari file".to_string())
}

/// Delete a file
#[tauri::command]
pub async fn delete_file(path: String) -> Result<(), String> {
    use std::fs;

    LOGGER.log(
        LogLevel::Info,
        &format!("Deleting file: {}", path),
        "recording_commands",
    );

    fs::remove_file(&path).map_err(|e| format!("Failed to delete file: {}", e))?;

    LOGGER.log(
        LogLevel::Info,
        &format!("File deleted successfully: {}", path),
        "recording_commands",
    );

    Ok(())
}

/// Update custom metadata in a .notari file
#[tauri::command]
pub async fn update_recording_metadata(
    notari_path: String,
    title: Option<String>,
    description: Option<String>,
    tags: Option<Vec<String>>,
) -> Result<(), String> {
    use std::fs;
    use std::io::Write;

    LOGGER.log(
        LogLevel::Info,
        &format!("Updating metadata for: {}", notari_path),
        "recording_commands",
    );

    // Extract the .notari file to temp
    let temp_dir = std::env::temp_dir().join(format!("notari_update_{}", uuid::Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create temp directory: {}", e))?;

    let (video_path, manifest_path, _) = resolve_recording_paths(&notari_path, &notari_path)?;

    // Load manifest
    let mut manifest = crate::evidence::EvidenceManifest::load(&manifest_path)
        .map_err(|e| format!("Failed to load manifest: {}", e))?;

    // Update custom metadata
    let custom_metadata = crate::evidence::CustomMetadata {
        title,
        description,
        tags,
    };
    manifest.metadata.custom = Some(custom_metadata);

    // Re-sign the manifest
    if crate::evidence::keychain::has_signing_key() {
        let key_bytes = crate::evidence::keychain::retrieve_signing_key()
            .map_err(|e| format!("Failed to retrieve signing key: {}", e))?;
        let key_manager = crate::evidence::signature::KeyManager::from_bytes(&key_bytes)
            .map_err(|e| format!("Failed to load key manager: {}", e))?;
        manifest.sign(&key_manager);
    }

    // Save updated manifest
    manifest
        .save(&manifest_path)
        .map_err(|e| format!("Failed to save manifest: {}", e))?;

    // Recreate the .notari file with updated manifest
    let file = fs::File::create(&notari_path)
        .map_err(|e| format!("Failed to create .notari file: {}", e))?;
    let mut zip = zip::ZipWriter::new(file);
    let options: zip::write::FileOptions<()> = zip::write::FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    // Add video file
    let video_data =
        fs::read(&video_path).map_err(|e| format!("Failed to read video file: {}", e))?;
    zip.start_file("recording.mov", options)
        .map_err(|e| format!("Failed to add video to zip: {}", e))?;
    zip.write_all(&video_data)
        .map_err(|e| format!("Failed to write video to zip: {}", e))?;

    // Add manifest file
    let manifest_data =
        fs::read(&manifest_path).map_err(|e| format!("Failed to read manifest file: {}", e))?;
    zip.start_file("manifest.json", options)
        .map_err(|e| format!("Failed to add manifest to zip: {}", e))?;
    zip.write_all(&manifest_data)
        .map_err(|e| format!("Failed to write manifest to zip: {}", e))?;

    // Add metadata.json
    let metadata_json = serde_json::json!({
        "version": "1.0",
        "created_at": chrono::Utc::now().to_rfc3339(),
        "notari_version": env!("CARGO_PKG_VERSION"),
        "recording_filename": "recording.mov",
        "is_encrypted": manifest.recording.encrypted,
    });
    zip.start_file("metadata.json", options)
        .map_err(|e| format!("Failed to add metadata to zip: {}", e))?;
    zip.write_all(
        serde_json::to_string_pretty(&metadata_json)
            .unwrap()
            .as_bytes(),
    )
    .map_err(|e| format!("Failed to write metadata to zip: {}", e))?;

    zip.finish()
        .map_err(|e| format!("Failed to finalize zip: {}", e))?;

    // Cleanup temp directory
    let _ = fs::remove_dir_all(&temp_dir);

    LOGGER.log(
        LogLevel::Info,
        "Metadata updated successfully",
        "recording_commands",
    );

    Ok(())
}

/// Create a proof pack (ZIP archive) containing video + manifest + public key + README
#[tauri::command]
pub async fn create_proof_pack(
    video_path: String,
    manifest_path: String,
    output_path: String,
) -> Result<String, String> {
    LOGGER.log(
        LogLevel::Info,
        &format!("Creating proof pack: {}", output_path),
        "recording_commands",
    );

    let result_path =
        crate::evidence::proof_pack::create_proof_pack(&video_path, &manifest_path, &output_path)
            .map_err(|e| format!("Failed to create proof pack: {}", e))?;

    LOGGER.log(
        LogLevel::Info,
        &format!("Proof pack created successfully: {}", result_path.display()),
        "recording_commands",
    );

    Ok(result_path.to_string_lossy().to_string())
}

/// Extract a proof pack and return paths to extracted files
#[tauri::command]
pub async fn extract_proof_pack(
    proof_pack_path: String,
    extract_dir: String,
) -> Result<(String, String), String> {
    LOGGER.log(
        LogLevel::Info,
        &format!("Extracting proof pack: {}", proof_pack_path),
        "recording_commands",
    );

    let (video_path, manifest_path) =
        crate::evidence::proof_pack::extract_proof_pack(&proof_pack_path, &extract_dir)
            .map_err(|e| format!("Failed to extract proof pack: {}", e))?;

    LOGGER.log(
        LogLevel::Info,
        &format!("Proof pack extracted successfully to: {}", extract_dir),
        "recording_commands",
    );

    Ok((
        video_path.to_string_lossy().to_string(),
        manifest_path.to_string_lossy().to_string(),
    ))
}

/// Recording entry for library view
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingEntry {
    pub video_path: String,
    pub manifest_path: String,
    pub filename: String,
    pub created_at: String,
    pub file_size_bytes: u64,
    pub is_encrypted: bool,
    pub has_manifest: bool,
    pub title: Option<String>,
    pub description: Option<String>,
    pub tags: Option<Vec<String>>,
    pub blockchain_anchor: Option<BlockchainAnchorInfo>,
}

/// Blockchain anchor information for recording entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockchainAnchorInfo {
    pub anchored_at: String,
    pub chain_name: String,
    pub tx_hash: Option<String>,
    pub explorer_url: Option<String>,
}

/// Helper: Extract video and manifest from .notari file
/// Returns (video_path, manifest_path, temp_dir_path)
fn resolve_recording_paths(
    notari_path: &str,
    _manifest_path: &str,
) -> Result<(String, String, String), String> {
    // Extract to temp directory
    let temp_dir = std::env::temp_dir().join(format!("notari_temp_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| format!("Failed to create temp directory: {}", e))?;

    let (extracted_video, extracted_manifest) = crate::evidence::proof_pack::extract_proof_pack(
        notari_path,
        temp_dir.to_str().ok_or("Invalid temp directory path")?,
    )
    .map_err(|e| format!("Failed to extract proof pack: {}", e))?;

    Ok((
        extracted_video.to_string_lossy().to_string(),
        extracted_manifest.to_string_lossy().to_string(),
        temp_dir.to_string_lossy().to_string(),
    ))
}

/// List all recordings in the save directory
#[tauri::command]
pub async fn list_recordings(
    state: State<'_, WindowManagerState>,
) -> Result<Vec<RecordingEntry>, String> {
    use std::fs;
    use std::io::Read;

    // Get save directory
    let save_dir = {
        let state_guard = state.recording_state.lock().map_err(|e| e.to_string())?;
        state_guard
            .preferences
            .save_directory
            .clone()
            .or_else(|| state.recording_manager.get_default_save_directory().ok())
            .ok_or("No save directory configured")?
    };

    if !save_dir.exists() {
        return Ok(Vec::new());
    }

    let mut recordings = Vec::new();

    // Read directory entries
    let entries =
        fs::read_dir(&save_dir).map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        // Only process .notari files
        if let Some(extension) = path.extension() {
            let ext_str = extension.to_string_lossy();

            if ext_str == "notari" {
                let notari_path = path.to_string_lossy().to_string();
                let filename = path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                // Extract metadata (including custom metadata and blockchain anchor) from proof pack
                let (is_encrypted, title, description, tags, blockchain_anchor) = if let Ok(file) =
                    fs::File::open(&path)
                {
                    if let Ok(mut archive) = zip::ZipArchive::new(file) {
                        // Get metadata
                        let (is_encrypted, title, description, tags) = if let Ok(
                            mut metadata_file,
                        ) =
                            archive.by_name("metadata.json")
                        {
                            let mut contents = String::new();
                            if metadata_file.read_to_string(&mut contents).is_ok() {
                                if let Ok(metadata) =
                                    serde_json::from_str::<ProofPackMetadata>(&contents)
                                {
                                    println!("DEBUG: Found metadata - encrypted: {}, title: {:?}, desc: {:?}, tags: {:?}",
                                        metadata.is_encrypted, metadata.title, metadata.description, metadata.tags);
                                    (
                                        metadata.is_encrypted,
                                        metadata.title,
                                        metadata.description,
                                        metadata.tags,
                                    )
                                } else {
                                    println!("DEBUG: Failed to parse metadata.json");
                                    (false, None, None, None)
                                }
                            } else {
                                println!("DEBUG: Failed to read metadata.json contents");
                                (false, None, None, None)
                            }
                        } else {
                            println!("DEBUG: metadata.json not found in archive");
                            (false, None, None, None)
                        };

                        // Get blockchain anchor from manifest
                        // Find the manifest file dynamically (it's in evidence/ directory with .json extension)
                        let mut manifest_filename = None;
                        for i in 0..archive.len() {
                            if let Ok(file) = archive.by_index(i) {
                                let name = file.name();
                                if name.starts_with("evidence/") && name.ends_with(".json") {
                                    manifest_filename = Some(name.to_string());
                                    break;
                                }
                            }
                        }

                        let blockchain_anchor = if let Some(manifest_name) = manifest_filename {
                            if let Ok(mut manifest_file) = archive.by_name(&manifest_name) {
                                let mut contents = String::new();
                                if manifest_file.read_to_string(&mut contents).is_ok() {
                                    if let Ok(manifest) =
                                        serde_json::from_str::<crate::evidence::EvidenceManifest>(
                                            &contents,
                                        )
                                    {
                                        manifest.blockchain_anchor.map(|anchor| {
                                            use crate::evidence::AnchorProof;
                                            match anchor.proof {
                                                AnchorProof::Ethereum {
                                                    chain_name,
                                                    tx_hash,
                                                    explorer_url,
                                                    ..
                                                } => BlockchainAnchorInfo {
                                                    anchored_at: anchor.anchored_at.to_rfc3339(),
                                                    chain_name,
                                                    tx_hash: Some(tx_hash),
                                                    explorer_url: Some(explorer_url),
                                                },
                                                AnchorProof::Mock { .. } => BlockchainAnchorInfo {
                                                    anchored_at: anchor.anchored_at.to_rfc3339(),
                                                    chain_name: "Mock".to_string(),
                                                    tx_hash: None,
                                                    explorer_url: None,
                                                },
                                                AnchorProof::OpenTimestamps { .. } => {
                                                    BlockchainAnchorInfo {
                                                        anchored_at: anchor
                                                            .anchored_at
                                                            .to_rfc3339(),
                                                        chain_name: "Bitcoin (OpenTimestamps)"
                                                            .to_string(),
                                                        tx_hash: None,
                                                        explorer_url: None,
                                                    }
                                                }
                                            }
                                        })
                                    } else {
                                        None
                                    }
                                } else {
                                    None
                                }
                            } else {
                                None
                            }
                        } else {
                            None
                        };

                        (is_encrypted, title, description, tags, blockchain_anchor)
                    } else {
                        println!("DEBUG: Failed to open zip archive");
                        (false, None, None, None, None)
                    }
                } else {
                    println!("DEBUG: Failed to open .notari file");
                    (false, None, None, None, None)
                };

                // For .notari files, the video_path is the .notari file itself
                // The manifest is embedded, so has_manifest is always true
                let video_path = notari_path.clone();
                let manifest_path = notari_path.clone(); // Same file contains both
                let has_manifest = true;

                // Get file metadata
                let metadata =
                    fs::metadata(&path).map_err(|e| format!("Failed to get metadata: {}", e))?;

                let file_size_bytes = metadata.len();
                let created_at = metadata
                    .created()
                    .or_else(|_| metadata.modified())
                    .map(|time| {
                        use std::time::SystemTime;
                        let duration = time
                            .duration_since(SystemTime::UNIX_EPOCH)
                            .unwrap_or_default();
                        chrono::DateTime::<chrono::Utc>::from_timestamp(
                            duration.as_secs() as i64,
                            0,
                        )
                        .map(|dt| dt.to_rfc3339())
                        .unwrap_or_else(|| "Unknown".to_string())
                    })
                    .unwrap_or_else(|_| "Unknown".to_string());

                recordings.push(RecordingEntry {
                    video_path,
                    manifest_path,
                    filename,
                    created_at,
                    file_size_bytes,
                    is_encrypted,
                    has_manifest,
                    title,
                    description,
                    tags,
                    blockchain_anchor,
                });
            }
        }
    }

    // Sort by created_at descending (newest first)
    recordings.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    Ok(recordings)
}

/// Open a file in the system's default application
#[tauri::command]
pub async fn open_file_in_default_app(path: String) -> Result<(), String> {
    use std::process::Command;

    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("cmd")
            .args(&["/C", "start", "", &path])
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open file: {}", e))?;
    }

    Ok(())
}

/// Decrypt video to temporary location and open in default player
#[tauri::command]
pub async fn decrypt_and_play_video(
    encrypted_path: String,
    password: String,
    encryption_info: crate::evidence::EncryptionInfo,
) -> Result<String, String> {
    use crate::evidence::VideoEncryptor;
    use std::env;
    use std::path::PathBuf;

    // Extract from .notari file
    let (resolved_video, _, temp_dir) = resolve_recording_paths(&encrypted_path, &encrypted_path)?;

    // Create temp directory for decrypted video
    let temp_dir_path = env::temp_dir();
    let path_buf = PathBuf::from(&resolved_video);
    let file_name = path_buf
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Invalid file name")?;

    let temp_path = temp_dir_path.join(format!("{}_decrypted.mov", file_name));

    LOGGER.log(
        LogLevel::Info,
        &format!("Decrypting video to temp location: {}", temp_path.display()),
        "recording_commands",
    );

    // Decrypt the video based on encryption method
    let temp_path_str = temp_path.to_string_lossy().to_string();

    if encryption_info.encrypted_keys.is_some() {
        // Public key encryption - use private key
        use crate::evidence::keychain;
        use crate::evidence::EncryptionKeyManager;

        let key_bytes = keychain::retrieve_encryption_key()
            .map_err(|e| format!("Failed to retrieve encryption key: {}", e))?;
        let key_manager = EncryptionKeyManager::from_bytes(&key_bytes)
            .map_err(|e| format!("Failed to load encryption key: {}", e))?;

        VideoEncryptor::decrypt_file_with_private_key(
            &resolved_video,
            &temp_path_str,
            key_manager.secret_key(),
            &encryption_info,
        )
        .map_err(|e| format!("Decryption failed: {}", e))?;
    } else {
        // Password-based encryption
        VideoEncryptor::decrypt_file(&resolved_video, &temp_path_str, &password, &encryption_info)
            .map_err(|e| format!("Decryption failed: {}", e))?;
    }

    // Cleanup extracted files
    let _ = std::fs::remove_dir_all(&temp_dir);

    // Open in default player
    open_file_in_default_app(temp_path_str.clone()).await?;

    LOGGER.log(
        LogLevel::Info,
        "Video decrypted and opened successfully",
        "recording_commands",
    );

    Ok(temp_path_str)
}

// ============================================================================
// Video Streaming Commands
// ============================================================================

use once_cell::sync::Lazy;
use tokio::sync::RwLock as TokioRwLock;

// Global video server state
pub static VIDEO_SERVER: Lazy<TokioRwLock<Option<(u16, crate::video_server::VideoServerState)>>> =
    Lazy::new(|| TokioRwLock::new(None));

/// Start video playback - returns stream URL
#[tauri::command]
pub async fn start_video_playback(
    recording_path: String,
    password: String,
) -> Result<String, String> {
    LOGGER.log(
        LogLevel::Info,
        &format!(
            "Starting video playback for: {} (password length: {})",
            recording_path,
            password.len()
        ),
        "recording_commands",
    );

    // Ensure server is running
    let mut server = VIDEO_SERVER.write().await;
    if server.is_none() {
        LOGGER.log(
            LogLevel::Info,
            "Starting video server...",
            "recording_commands",
        );
        let (port, state) = crate::video_server::start_video_server().await?;
        *server = Some((port, state));
    }

    let (_port, state) = server.as_ref().unwrap();

    // Extract from .notari
    LOGGER.log(
        LogLevel::Info,
        &format!("Extracting from .notari: {}", recording_path),
        "recording_commands",
    );
    let (video_path, manifest_path, temp_dir) =
        resolve_recording_paths(&recording_path, &recording_path)?;

    LOGGER.log(
        LogLevel::Info,
        &format!("Extracted video path: {}", video_path),
        "recording_commands",
    );

    // Get encryption info (if encrypted)
    let manifest = crate::evidence::EvidenceManifest::load(&manifest_path)
        .map_err(|e| format!("Failed to load manifest: {}", e))?;

    let encryption_info = manifest.recording.encryption;
    let is_encrypted = encryption_info.is_some();

    // Determine encryption method
    let (use_password, use_private_key) = if let Some(ref enc_info) = encryption_info {
        let has_password_encryption = enc_info.key_derivation.is_some();
        let has_public_key_encryption = enc_info.encrypted_keys.is_some();

        if has_public_key_encryption {
            // Public key encryption - retrieve private key from keychain
            LOGGER.log(
                LogLevel::Info,
                "Video encrypted with public key encryption, retrieving private key",
                "recording_commands",
            );
            (false, true)
        } else if has_password_encryption {
            // Password-based encryption
            LOGGER.log(
                LogLevel::Info,
                "Video encrypted with password-based encryption",
                "recording_commands",
            );
            (true, false)
        } else {
            return Err("Invalid encryption info: no key derivation or encrypted keys".to_string());
        }
    } else {
        (false, false)
    };

    LOGGER.log(
        LogLevel::Info,
        &format!(
            "Video is encrypted: {}, use_password: {}, use_private_key: {}",
            is_encrypted, use_password, use_private_key
        ),
        "recording_commands",
    );

    // Get file size (encrypted file size)
    let encrypted_file_size = std::fs::metadata(&video_path)
        .map_err(|e| format!("Failed to get file size: {}", e))?
        .len();

    // Calculate plaintext size if encrypted
    let plaintext_size = if let Some(ref enc_info) = encryption_info {
        if let Some(ref chunked) = enc_info.chunked {
            // For chunked encryption, sum up the plaintext sizes
            // Each chunk's plaintext size = chunk_size, except the last chunk
            let full_chunks = (chunked.total_chunks - 1) as u64;
            let full_chunks_size = full_chunks * chunked.chunk_size;

            // Last chunk size from the chunks array
            let last_chunk_plaintext_size = if let Some(last_chunk) = chunked.chunks.last() {
                // Ciphertext size - 16 bytes (AES-GCM tag)
                last_chunk.size.saturating_sub(16)
            } else {
                0
            };

            full_chunks_size + last_chunk_plaintext_size
        } else {
            // For non-chunked encryption, we can't easily determine plaintext size
            // Use encrypted size as approximation (will be slightly larger)
            encrypted_file_size
        }
    } else {
        encrypted_file_size
    };

    LOGGER.log(
        LogLevel::Info,
        &format!(
            "Video file size: {} bytes (encrypted: {}, plaintext: {})",
            plaintext_size, encrypted_file_size, plaintext_size
        ),
        "recording_commands",
    );

    // Retrieve private key if needed
    let private_key = if use_private_key {
        use crate::evidence::keychain;
        match keychain::retrieve_encryption_key() {
            Ok(key_bytes) => {
                use crate::evidence::EncryptionKeyManager;
                match EncryptionKeyManager::from_bytes(&key_bytes) {
                    Ok(key_manager) => Some(key_manager.secret_key().clone()),
                    Err(e) => {
                        return Err(format!("Failed to load encryption key: {}", e));
                    }
                }
            }
            Err(e) => {
                return Err(format!(
                    "Failed to retrieve encryption key from keychain: {}",
                    e
                ));
            }
        }
    } else {
        None
    };

    // Create stream
    let stream_id = uuid::Uuid::new_v4().to_string();
    let stream = crate::video_server::VideoStream {
        video_path: video_path.into(),
        password: if use_password { Some(password) } else { None },
        private_key,
        encryption_info,
        file_size: plaintext_size, // Use plaintext size for streaming
        temp_dir: temp_dir.into(),
    };

    // Store stream
    state
        .streams
        .write()
        .await
        .insert(stream_id.clone(), stream);

    // Return HTTP URL
    let url = format!("http://127.0.0.1:{}/video/{}", _port, stream_id);

    LOGGER.log(
        LogLevel::Info,
        &format!("Video stream created: {}", url),
        "recording_commands",
    );

    // Log health check URL for debugging
    LOGGER.log(
        LogLevel::Info,
        &format!("Health check: http://127.0.0.1:{}/health", _port),
        "recording_commands",
    );

    Ok(url)
}

/// Test video server connectivity
#[tauri::command]
pub async fn test_video_server() -> Result<String, String> {
    let server = VIDEO_SERVER.read().await;
    if let Some((port, _state)) = server.as_ref() {
        Ok(format!("Server running on port {}", port))
    } else {
        Err("Server not running".to_string())
    }
}

/// Get video chunk for streaming
#[tauri::command]
pub async fn get_video_chunk(stream_id: String, start: u64, end: u64) -> Result<Vec<u8>, String> {
    LOGGER.log(
        LogLevel::Debug,
        &format!("Getting video chunk: {} bytes {}-{}", stream_id, start, end),
        "recording_commands",
    );

    let server = VIDEO_SERVER.read().await;
    let (_port, state) = server.as_ref().ok_or("Video server not started")?;

    let streams = state.streams.read().await;
    let stream = streams.get(&stream_id).ok_or("Stream not found")?;

    // Decrypt/read the chunk
    let data = crate::video_server::decrypt_chunk(stream, start, end)
        .await
        .map_err(|e| format!("Failed to get chunk: {}", e))?;

    Ok(data)
}

/// Get video metadata
#[tauri::command]
pub async fn get_video_metadata(stream_id: String) -> Result<(u64, bool), String> {
    let server = VIDEO_SERVER.read().await;
    let (_port, state) = server.as_ref().ok_or("Video server not started")?;

    let streams = state.streams.read().await;
    let stream = streams.get(&stream_id).ok_or("Stream not found")?;

    Ok((stream.file_size, stream.encryption_info.is_some()))
}

/// Stop video playback and cleanup
#[tauri::command]
pub async fn stop_video_playback(stream_id: String) -> Result<(), String> {
    LOGGER.log(
        LogLevel::Info,
        &format!("Stopping video playback: {}", stream_id),
        "recording_commands",
    );

    let server = VIDEO_SERVER.read().await;
    if let Some((_, state)) = server.as_ref() {
        let mut streams = state.streams.write().await;
        if let Some(stream) = streams.remove(&stream_id) {
            // Cleanup temp directory
            LOGGER.log(
                LogLevel::Info,
                &format!("Cleaning up temp directory: {}", stream.temp_dir.display()),
                "recording_commands",
            );
            let _ = std::fs::remove_dir_all(&stream.temp_dir);
        }
    }

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
