use crate::logger::{LogEntry, LogLevel, LOGGER};
use crate::recording_manager::{
    create_recording_manager, ActiveRecording, RecordingInfo, RecordingManager,
    RecordingPreferences, RecordingState, SharedRecordingState,
};
use crate::window_manager::{create_window_manager, PermissionStatus, WindowInfo};

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use tauri::State;

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
    LOGGER.log(
        LogLevel::Info,
        "Frontend requested available windows",
        "backend",
    );
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    let windows = manager.get_windows();
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
    let result = manager.get_window_thumbnail(&window_id);
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
    manager.open_system_settings()
}

/// Start recording a specific window
#[tauri::command]
pub async fn start_window_recording(
    window_id: String,
    preferences: Option<RecordingPreferences>,
    encryption_password: Option<String>,
    state: State<'_, WindowManagerState>,
) -> Result<ActiveRecording, String> {
    LOGGER.log(
        LogLevel::Info,
        &format!("Starting recording for window: {} (encryption: {})", window_id, encryption_password.is_some()),
        "recording_commands",
    );

    let prefs = preferences.unwrap_or_default();

    // Validate encryption password if provided
    if let Some(ref pwd) = encryption_password {
        use crate::evidence::validate_password;
        validate_password(pwd)?;
    }

    // Get window information before starting recording
    let window_info = {
        let manager = state.manager.lock().map_err(|e| e.to_string())?;
        manager.get_windows()?
            .into_iter()
            .find(|w| w.id == window_id)
    };

    let mut session = state.recording_manager.start_recording(
        &window_id,
        &prefs,
        window_info,
        state.recording_state.clone(),
    )?;

    // Store encryption password in session (will be used during stop_recording)
    session.encryption_password = encryption_password;

    // Update the session in the recording state
    {
        let mut recording_state = state.recording_state.lock().map_err(|e| e.to_string())?;
        if let Some(ref mut active) = recording_state.active_recording {
            active.session.encryption_password = session.encryption_password.clone();
        }
    }

    LOGGER.log(
        LogLevel::Info,
        &format!("Recording started successfully: {}", session.session_id),
        "recording_commands",
    );

    Ok(session)
}

/// Stop recording session
#[tauri::command]
pub async fn stop_recording(
    session_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    LOGGER.log(
        LogLevel::Info,
        &format!("Stopping recording session: {}", session_id),
        "recording_commands",
    );

    state
        .recording_manager
        .stop_recording(&session_id, state.recording_state.clone())?;

    LOGGER.log(
        LogLevel::Info,
        &format!("Recording stopped successfully: {}", session_id),
        "recording_commands",
    );

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
    let info = state
        .recording_manager
        .get_recording_info(&session_id, state.recording_state.clone())?;
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
    LOGGER.log(
        LogLevel::Info,
        "Recording preferences updated",
        "recording_commands",
    );
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
    state.recording_manager.cleanup_orphaned_recordings()
}

/// Pause recording session
#[tauri::command]
pub async fn pause_recording(
    session_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    LOGGER.log(
        LogLevel::Info,
        &format!("Pausing recording session: {}", session_id),
        "recording_commands",
    );

    state
        .recording_manager
        .pause_recording(&session_id, state.recording_state.clone())
}

/// Resume recording session
#[tauri::command]
pub async fn resume_recording(
    session_id: String,
    state: State<'_, WindowManagerState>,
) -> Result<(), String> {
    LOGGER.log(
        LogLevel::Info,
        &format!("Resuming recording session: {}", session_id),
        "recording_commands",
    );

    state
        .recording_manager
        .resume_recording(&session_id, state.recording_state.clone())
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

/// Verify a recording's evidence
#[tauri::command]
pub async fn verify_recording(
    manifest_path: String,
    video_path: String,
) -> Result<crate::evidence::VerificationReport, String> {
    crate::evidence::Verifier::verify(&manifest_path, &video_path)
        .map_err(|e| format!("Verification failed: {}", e))
}

/// Get evidence manifest for a recording
#[tauri::command]
pub async fn get_evidence_manifest(
    manifest_path: String,
) -> Result<crate::evidence::EvidenceManifest, String> {
    crate::evidence::EvidenceManifest::load(&manifest_path)
        .map_err(|e| format!("Failed to load manifest: {}", e))
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

/// Validate encryption password strength
#[tauri::command]
pub async fn validate_encryption_password(password: String) -> Result<(), String> {
    use crate::evidence::validate_password;
    validate_password(&password)
}

/// Read a file's contents as a string
#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    use std::fs;
    fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
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
}

/// List all recordings in the save directory
#[tauri::command]
pub async fn list_recordings(state: State<'_, WindowManagerState>) -> Result<Vec<RecordingEntry>, String> {
    use std::fs;

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
    let entries = fs::read_dir(&save_dir)
        .map_err(|e| format!("Failed to read directory: {}", e))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Failed to read entry: {}", e))?;
        let path = entry.path();

        // Only process .mov and .mov.enc files
        if let Some(extension) = path.extension() {
            let ext_str = extension.to_string_lossy();
            let is_video = ext_str == "mov" || ext_str == "enc";

            if is_video {
                let video_path = path.to_string_lossy().to_string();
                let filename = path.file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or("unknown")
                    .to_string();

                // Check if encrypted
                let is_encrypted = ext_str == "enc";

                // Get manifest path
                let manifest_path = if is_encrypted {
                    // For .mov.enc, replace .enc with .json
                    video_path.replace(".enc", ".json")
                } else {
                    // For .mov, replace .mov with .json
                    video_path.replace(".mov", ".json")
                };

                let has_manifest = std::path::Path::new(&manifest_path).exists();

                // Get file metadata
                let metadata = fs::metadata(&path)
                    .map_err(|e| format!("Failed to get metadata: {}", e))?;

                let file_size_bytes = metadata.len();
                let created_at = metadata.created()
                    .or_else(|_| metadata.modified())
                    .map(|time| {
                        use std::time::SystemTime;
                        let duration = time.duration_since(SystemTime::UNIX_EPOCH)
                            .unwrap_or_default();
                        chrono::DateTime::<chrono::Utc>::from_timestamp(duration.as_secs() as i64, 0)
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

    // Create temp directory for decrypted video
    let temp_dir = env::temp_dir();
    let path_buf = PathBuf::from(&encrypted_path);
    let file_name = path_buf
        .file_stem()
        .and_then(|s| s.to_str())
        .ok_or("Invalid file name")?;

    let temp_path = temp_dir.join(format!("{}_decrypted.mov", file_name));

    LOGGER.log(
        LogLevel::Info,
        &format!("Decrypting video to temp location: {}", temp_path.display()),
        "recording_commands",
    );

    // Decrypt the video
    let temp_path_str = temp_path.to_string_lossy().to_string();
    VideoEncryptor::decrypt_file(&encrypted_path, &temp_path_str, &password, &encryption_info)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    // Open in default player
    open_file_in_default_app(temp_path_str.clone()).await?;

    LOGGER.log(
        LogLevel::Info,
        "Video decrypted and opened successfully",
        "recording_commands",
    );

    Ok(temp_path_str)
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
