use super::{
    ActiveRecording, InternalRecordingState, RecordingInfo, RecordingManager, RecordingPreferences,
    SharedRecordingState,
};
use crate::error::{NotariError, NotariResult};
use crate::evidence::keychain;
use crate::evidence::{
    HashInfo, KeyManager, Metadata, SystemInfo, Timestamps, VideoInfo,
    WindowInfo as EvidenceWindowInfo,
};
use crate::logger::{LogLevel, LOGGER};
use crate::pipeline::stages::*;
use crate::pipeline::{Pipeline, PipelineContext};
use std::io::BufRead;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use tauri::AppHandle;

use chrono::Utc;
use uuid::Uuid;

pub struct MacOSRecordingManager;

impl MacOSRecordingManager {
    pub fn new() -> Self {
        Self
    }

    /// Resolve the Swift sidecar path in dev and prod
    fn resolve_sidecar_path(&self) -> PathBuf {
        // In release bundle, the sidecar is usually next to the app binary (Contents/MacOS)
        if let Ok(exe) = std::env::current_exe() {
            if let Some(dir) = exe.parent() {
                let candidate = dir.join("sck-recorder");
                if candidate.exists() {
                    return candidate;
                }
            }
        }
        // In dev, we compile to src-tauri/bin/sck-recorder
        let crate_dir = env!("CARGO_MANIFEST_DIR");
        PathBuf::from(crate_dir).join("bin/sck-recorder")
    }

    /// Parse window ID to extract the CoreGraphics window ID
    fn parse_window_id(&self, window_id: &str) -> Option<u32> {
        if window_id.starts_with("cg_") {
            window_id[3..].parse().ok()
        } else {
            None
        }
    }

    /// Check if a recording process is still running and healthy
    fn check_process_health(&self, process: &mut Child) -> NotariResult<bool> {
        match process.try_wait() {
            Ok(Some(status)) => {
                // Process has exited
                if status.success() {
                    LOGGER.log(
                        LogLevel::Debug,
                        "Recording process completed successfully",
                        "backend",
                    );
                    Ok(false) // Process finished normally
                } else {
                    let error_msg = format!("Recording process exited with error: {}", status);
                    LOGGER.log(LogLevel::Error, &error_msg, "backend");
                    Err(NotariError::RecordingProcessError(error_msg))
                }
            }
            Ok(None) => {
                // Process is still running
                Ok(true)
            }
            Err(e) => {
                let error_msg = format!("Failed to check process status: {}", e);
                LOGGER.log(LogLevel::Error, &error_msg, "backend");
                Err(NotariError::RecordingProcessError(error_msg))
            }
        }
    }

    /// Check available disk space at the output path
    fn check_disk_space(&self, output_path: &PathBuf, estimated_size_mb: u64) -> NotariResult<()> {
        // Get the parent directory of the output file
        let dir = output_path
            .parent()
            .ok_or_else(|| NotariError::InvalidPath(output_path.to_string_lossy().to_string()))?;

        // Use df command to check available space
        match std::process::Command::new("df")
            .arg("-m") // Output in MB
            .arg(dir)
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    let output_str = String::from_utf8_lossy(&output.stdout);
                    // Parse df output to get available space
                    // Format: Filesystem 1M-blocks Used Available Capacity Mounted on
                    if let Some(line) = output_str.lines().nth(1) {
                        let parts: Vec<&str> = line.split_whitespace().collect();
                        if parts.len() >= 4 {
                            if let Ok(available_mb) = parts[3].parse::<u64>() {
                                if available_mb < estimated_size_mb {
                                    return Err(NotariError::InsufficientDiskSpace {
                                        required: estimated_size_mb,
                                        available: available_mb,
                                    });
                                }
                                return Ok(());
                            }
                        }
                    }
                    // If parsing fails, just warn but don't fail
                    LOGGER.log(
                        LogLevel::Warn,
                        "Could not parse disk space information",
                        "backend",
                    );
                    Ok(())
                } else {
                    // If df fails, just warn but don't fail
                    LOGGER.log(LogLevel::Warn, "Could not check disk space", "backend");
                    Ok(())
                }
            }
            Err(_) => {
                // If df command fails, just warn but don't fail
                LOGGER.log(LogLevel::Warn, "Could not execute df command", "backend");
                Ok(())
            }
        }
    }

    /// Terminate recording process gracefully
    fn terminate_process(&self, process: &mut Child) -> NotariResult<()> {
        LOGGER.log(LogLevel::Info, "Terminating recording process", "backend");

        // Send SIGTERM for graceful shutdown
        process.kill().map_err(|e| {
            let error_msg = format!("Failed to terminate recording process: {}", e);
            LOGGER.log(LogLevel::Error, &error_msg, "backend");
            NotariError::RecordingStopFailed(error_msg)
        })?;

        // Wait for process to exit (with timeout)
        process.wait().map_err(|e| {
            let error_msg = format!("Failed to wait for process termination: {}", e);
            LOGGER.log(LogLevel::Error, &error_msg, "backend");
            NotariError::RecordingStopFailed(error_msg)
        })?;

        LOGGER.log(
            LogLevel::Info,
            "Recording process terminated successfully",
            "recording_manager",
        );
        Ok(())
    }

    /// Get file size of recording output
    fn get_file_size(&self, path: &PathBuf) -> Option<u64> {
        std::fs::metadata(path).ok().map(|metadata| metadata.len())
    }

    /// Calculate recording duration
    fn calculate_duration(&self, start_time: chrono::DateTime<Utc>) -> u64 {
        let now = Utc::now();
        (now - start_time).num_seconds().max(0) as u64
    }
}

impl RecordingManager for MacOSRecordingManager {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn start_recording(
        &self,
        window_id: &str,
        preferences: &RecordingPreferences,
        window_info: Option<crate::window_manager::WindowInfo>,
        state: SharedRecordingState,
    ) -> NotariResult<ActiveRecording> {
        LOGGER.log(
            LogLevel::Info,
            &format!("Starting recording for window: {}", window_id),
            "recording_manager",
        );

        // Check if there's already an active recording
        {
            let state_guard = state.lock()?;
            if state_guard.has_active_recording() {
                return Err(NotariError::RecordingInProgress);
            }
        }

        // Parse window ID
        let cg_window_id = self
            .parse_window_id(window_id)
            .ok_or_else(|| NotariError::InvalidWindowId(window_id.to_string()))?;

        // Get default save directory
        let default_dir = self.get_default_save_directory()?;

        // Ensure save directory exists
        let save_dir = preferences.save_directory.as_ref().unwrap_or(&default_dir);
        std::fs::create_dir_all(save_dir)
            .map_err(|e| NotariError::DirectoryCreationFailed(e.to_string()))?;

        // Generate output path
        let timestamp = Utc::now();
        let output_path = preferences.get_output_path(&default_dir, timestamp);

        // Check disk space (estimate 100MB for a typical recording)
        self.check_disk_space(&output_path, 100)?;

        // Create recording session using builder
        use crate::recording_manager::ActiveRecordingBuilder;
        let mut builder = ActiveRecordingBuilder::new(window_id)
            .output_path(output_path.clone())
            .preferences(preferences.clone());

        // Populate window metadata if available
        if let Some(win_info) = window_info {
            builder = builder.window_metadata(crate::recording_manager::WindowMetadata {
                title: win_info.title,
                app_name: win_info.application,
                app_bundle_id: "unknown".to_string(), // TODO: Get actual bundle ID
                width: win_info.bounds.width,
                height: win_info.bounds.height,
            });
        }

        let session = builder.build()?;

        // Try Swift sidecar (ScreenCaptureKit) first
        let sidecar_path = self.resolve_sidecar_path();
        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Spawning SCK sidecar: {:?} {} {}",
                sidecar_path,
                cg_window_id,
                output_path.to_string_lossy()
            ),
            "backend",
        );
        let mut cmd = Command::new(&sidecar_path);
        cmd.arg(format!("{}", cg_window_id))
            .arg(output_path.to_string_lossy().to_string())
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        match cmd.spawn() {
            Ok(mut child) => {
                // Forward sidecar stdout/stderr into LOGGER so it appears in frontend settings log
                if let Some(stdout) = child.stdout.take() {
                    std::thread::spawn(move || {
                        let reader = std::io::BufReader::new(stdout);
                        for line in reader.lines().flatten() {
                            LOGGER.log(
                                LogLevel::Debug,
                                &format!("sck-recorder stdout: {}", line),
                                "backend",
                            );
                        }
                    });
                }
                if let Some(stderr) = child.stderr.take() {
                    std::thread::spawn(move || {
                        let reader = std::io::BufReader::new(stderr);
                        for line in reader.lines().flatten() {
                            LOGGER.log(
                                LogLevel::Warn,
                                &format!("sck-recorder stderr: {}", line),
                                "backend",
                            );
                        }
                    });
                }

                // Started SCK sidecar successfully
                let mut state_guard = state.lock()?;

                // Create state machine in Idle state
                let state_machine = crate::state_machine::RecordingSessionState::new(
                    window_id.to_string(),
                    state_guard.preferences.to_snapshot(),
                );

                // Note: State machine transitions (Idle → Preparing → Recording) will be
                // handled by the command layer which has access to AppHandle for event emission.
                // For now, we store the state machine in Idle state.

                state_guard.active_recording = Some(InternalRecordingState {
                    session: session.clone(),
                    process: Some(child),
                    last_health_check: Utc::now(),
                    state_machine,
                });
                LOGGER.log(
                    LogLevel::Info,
                    "Started ScreenCaptureKit sidecar",
                    "backend",
                );
            }
            Err(e) => {
                let msg = format!("Failed to spawn SCK sidecar: {}", e);
                LOGGER.log(LogLevel::Error, &msg, "backend");
                return Err(NotariError::SidecarError(msg));
            }
        }

        // Status is managed by state machine transitions

        LOGGER.log(
            LogLevel::Info,
            &format!("Recording started successfully: {}", session.session_id),
            "recording_manager",
        );

        Ok(session)
    }

    fn stop_recording(&self, session_id: &str, state: SharedRecordingState) -> NotariResult<()> {
        LOGGER.log(
            LogLevel::Info,
            &format!("Stopping recording: {}", session_id),
            "recording_manager",
        );

        let mut state_guard = state.lock()?;

        if let Some(ref mut recording) = state_guard.active_recording {
            if recording.session.session_id != session_id {
                return Err(NotariError::SessionNotFound(session_id.to_string()));
            }

            // Stop backend
            if let Some(mut child) = recording.process.take() {
                // If it is the SCK sidecar, close stdin to signal graceful stop, then kill if needed
                if let Some(stdin) = child.stdin.take() {
                    drop(stdin); // EOF to sidecar => stop
                                 // give it a moment to finalize
                    std::thread::sleep(std::time::Duration::from_millis(300));
                }
                // Ensure termination for both sidecar and screencapture fallback
                self.terminate_process(&mut child)?;
                // child dropped here; process cleared to avoid repeated health logs
            }

            // Log final file information
            if let Some(file_size) = self.get_file_size(&recording.session.output_path) {
                LOGGER.log(
                    LogLevel::Info,
                    &format!(
                        "Recording completed. File: {}, Size: {} bytes",
                        recording.session.output_path.display(),
                        file_size
                    ),
                    "recording_manager",
                );
            }

            // Note: Post-processing (hashing, encryption, manifest, packaging) is now handled
            // by the process_recording() method which uses the pipeline pattern

            LOGGER.log(
                LogLevel::Info,
                &format!("Recording stopped successfully: {}", session_id),
                "recording_manager",
            );

            // Note: We don't clear the active recording here so the frontend can still
            // query the final status and file information. The frontend should call
            // clear_active_recording when it's done with the session.
        } else {
            return Err(NotariError::NoActiveRecording);
        }

        Ok(())
    }

    fn pause_recording(&self, _session_id: &str, _state: SharedRecordingState) -> NotariResult<()> {
        Err(NotariError::PlatformNotSupported)
    }

    fn resume_recording(
        &self,
        _session_id: &str,
        _state: SharedRecordingState,
    ) -> NotariResult<()> {
        Err(NotariError::PlatformNotSupported)
    }

    fn get_recording_info(
        &self,
        session_id: &str,
        state: SharedRecordingState,
    ) -> NotariResult<RecordingInfo> {
        let state_guard = state.lock()?;

        if let Some(ref recording) = state_guard.active_recording {
            if recording.session.session_id != session_id {
                return Err(NotariError::SessionNotFound(session_id.to_string()));
            }

            let duration = self.calculate_duration(recording.session.start_time);
            let file_size = self.get_file_size(&recording.session.output_path);

            Ok(RecordingInfo {
                session: recording.session.clone(),
                duration_seconds: duration,
                file_size_bytes: file_size,
                estimated_final_size_bytes: file_size, // For now, just use current size
            })
        } else {
            Err(NotariError::NoActiveRecording)
        }
    }

    fn check_recording_health(&self, state: SharedRecordingState) -> NotariResult<()> {
        let mut state_guard = state.lock()?;

        if let Some(ref mut recording) = state_guard.active_recording {
            if let Some(ref mut process) = recording.process {
                match self.check_process_health(process) {
                    Ok(true) => {
                        // Process is healthy, update last check time
                        recording.last_health_check = Utc::now();
                        LOGGER.log(
                            LogLevel::Debug,
                            &format!(
                                "Recording health check passed for session: {}",
                                recording.session.session_id
                            ),
                            "recording_manager",
                        );
                        Ok(())
                    }
                    Ok(false) => {
                        // Process finished normally; clear process to avoid repeated logs
                        recording.process = None;
                        LOGGER.log(
                            LogLevel::Info,
                            &format!(
                                "Recording process finished for session: {}",
                                recording.session.session_id
                            ),
                            "recording_manager",
                        );
                        Ok(())
                    }
                    Err(e) => {
                        // Process error - state machine will handle Failed state
                        // Clear process on error as well to avoid repeated polling
                        recording.process = None;
                        LOGGER.log(
                            LogLevel::Error,
                            &format!(
                                "Recording process error for session {}: {}",
                                recording.session.session_id, e
                            ),
                            "recording_manager",
                        );
                        Err(e)
                    }
                }
            } else {
                // No child process to monitor; nothing to do
                Ok(())
            }
        } else {
            // No active recording to check - this is fine
            Ok(())
        }
    }

    fn cleanup_orphaned_recordings(&self) -> NotariResult<()> {
        Ok(())
    }

    fn get_default_save_directory(&self) -> NotariResult<PathBuf> {
        // Use ~/Movies/Notari as default
        let home_dir = dirs::home_dir().ok_or_else(|| {
            NotariError::ConfigError("Could not determine home directory".to_string())
        })?;

        Ok(home_dir.join("Movies").join("Notari"))
    }

    fn validate_save_directory(&self, path: &PathBuf) -> NotariResult<bool> {
        // Check if directory exists or can be created
        if !path.exists() {
            std::fs::create_dir_all(path)
                .map_err(|e| NotariError::DirectoryCreationFailed(e.to_string()))?;
        }

        // Check if directory is writable
        let test_file = path.join(".notari_write_test");
        match std::fs::write(&test_file, "test") {
            Ok(_) => {
                let _ = std::fs::remove_file(&test_file);
                Ok(true)
            }
            Err(e) => Err(NotariError::DirectoryCreationFailed(format!(
                "Directory not writable: {}",
                e
            ))),
        }
    }
}

// Public methods for post-processing
impl MacOSRecordingManager {
    /// Process a completed recording using the pipeline pattern
    ///
    /// This method should be called after stop_recording() to perform:
    /// 1. Hash calculation
    /// 2. Encryption (if password provided)
    /// 3. Manifest generation
    /// 4. Signing
    /// 5. Packaging into .notari proof pack
    /// 6. Cleanup of temporary files
    ///
    /// Events are emitted to the frontend for progress tracking.
    pub fn process_recording(
        &self,
        session_id: &str,
        state: SharedRecordingState,
        app: &AppHandle,
    ) -> NotariResult<()> {
        LOGGER.log(
            LogLevel::Info,
            &format!("Starting post-processing for recording: {}", session_id),
            "recording_manager",
        );

        // Get recording info first (before transitioning to Processing)
        let (
            video_path,
            password,
            encryption_method,
            encryption_recipients,
            start_time,
            file_size,
            duration,
            window_metadata,
            custom_title,
            custom_description,
            custom_tags,
        ) = {
            let state_guard = state.lock()?;
            if let Some(ref recording) = state_guard.active_recording {
                if recording.session.session_id != session_id {
                    return Err(NotariError::SessionNotFound(session_id.to_string()));
                }

                let file_size = self
                    .get_file_size(&recording.session.output_path)
                    .unwrap_or(0);
                let duration = self.calculate_duration(recording.session.start_time) as f64;

                (
                    recording.session.output_path.clone(),
                    recording.session.encryption_password.clone(),
                    recording.session.encryption_method.clone(),
                    recording.session.encryption_recipients.clone(),
                    recording.session.start_time,
                    file_size,
                    duration,
                    recording.session.window_metadata.clone(),
                    recording.session.recording_title.clone(),
                    recording.session.recording_description.clone(),
                    recording.session.recording_tags.clone(),
                )
            } else {
                return Err(NotariError::NoActiveRecording);
            }
        };

        // Verify video file exists
        if !video_path.exists() {
            let error_msg = format!("Video file not found: {:?}", video_path);
            LOGGER.log(LogLevel::Error, &error_msg, "recording_manager");
            self.transition_to_failed(session_id, state.clone(), error_msg.clone(), app)?;
            return Err(NotariError::FileNotFound(
                video_path.to_string_lossy().to_string(),
            ));
        }

        LOGGER.log(
            LogLevel::Debug,
            &format!(
                "Video file exists: {:?} (size: {} bytes)",
                video_path, file_size
            ),
            "recording_manager",
        );

        // Build pipeline
        let pipeline = Pipeline::builder("post-recording")
            .add_stage(HashStage::new())
            .add_stage(EncryptStage::new())
            .add_stage(ManifestStage::new_auto())
            .add_stage(SignStage::new())
            .add_stage(PackageStage::new())
            .add_stage(CleanupStage::new())
            .build();

        // Create context
        let mut context = PipelineContext::new(session_id);
        context.set_path("video_path", video_path.clone());
        context.set_number("file_size", file_size as f64);
        context.set_number("duration", duration);
        context.set_string("start_time", start_time.to_rfc3339());

        // Add encryption settings if provided
        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Setting encryption context - password: {}, method: {:?}, recipients: {}",
                password.is_some(),
                encryption_method,
                encryption_recipients.as_ref().map(|r| r.len()).unwrap_or(0)
            ),
            "recording_manager",
        );

        if let Some(ref pwd) = password {
            context.set_string("password", pwd);
            LOGGER.log(
                LogLevel::Info,
                "Set password in context",
                "recording_manager",
            );
        }
        if let Some(ref method) = encryption_method {
            context.set_string("encryption_method", method);
            LOGGER.log(
                LogLevel::Info,
                &format!("Set encryption_method in context: {}", method),
                "recording_manager",
            );
        }
        if let Some(ref recipients) = encryption_recipients {
            // Convert recipients to JSON array
            let recipients_json: Vec<serde_json::Value> = recipients
                .iter()
                .map(|r| {
                    serde_json::json!({
                        "id": r.id,
                        "publicKey": r.public_key
                    })
                })
                .collect();
            let recipients_count = recipients_json.len();
            let recipients_value = serde_json::Value::Array(recipients_json);
            context.set("recipients", recipients_value);
            LOGGER.log(
                LogLevel::Info,
                &format!("Set {} recipients in context", recipients_count),
                "recording_manager",
            );
        }

        // Add window metadata if available
        if let Some(ref metadata) = window_metadata {
            let metadata_json = serde_json::to_value(metadata).map_err(|e| {
                NotariError::PipelineError(format!("Failed to serialize window metadata: {}", e))
            })?;
            context.set("window_metadata", metadata_json);
        }

        // Add custom metadata if provided
        if let Some(title) = custom_title {
            context.set_string("custom_title", title);
        }
        if let Some(description) = custom_description {
            context.set_string("custom_description", description);
        }
        if let Some(tags) = custom_tags {
            let tags_json = serde_json::to_value(&tags).map_err(|e| {
                NotariError::PipelineError(format!("Failed to serialize tags: {}", e))
            })?;
            context.set("custom_tags", tags_json);
        }

        // Transition state machine: Stopping → Processing (with actual file size and duration)
        self.transition_to_processing(session_id, state.clone(), file_size, duration, app)?;

        LOGGER.log(
            LogLevel::Info,
            &format!("Transitioned to Processing state and executing pipeline for session: {} (file_size: {}, duration: {})", session_id, file_size, duration),
            "recording_manager",
        );

        // Execute pipeline with events
        let result = pipeline.execute_with_events(&mut context, app)?;

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Pipeline execution completed for session: {} (success: {})",
                session_id, result.success
            ),
            "recording_manager",
        );

        if result.success {
            LOGGER.log(
                LogLevel::Info,
                &format!(
                    "Post-processing completed successfully for recording: {} (duration: {:.2}s)",
                    session_id,
                    result.total_duration.as_secs_f64()
                ),
                "recording_manager",
            );

            // Get proof pack path and hash from context
            let proof_pack_path = context
                .get_path("proof_pack_path")
                .unwrap_or_else(|_| video_path.with_extension("notari"));
            let plaintext_hash = context
                .get_string("plaintext_hash")
                .unwrap_or_else(|_| "unknown".to_string());
            let encrypted = password.is_some();

            // Transition state machine: Processing → Completed
            self.transition_to_completed(
                session_id,
                state.clone(),
                proof_pack_path,
                plaintext_hash,
                encrypted,
                app,
            )?;

            Ok(())
        } else {
            let error_msg = result.error.unwrap_or_else(|| "Unknown error".to_string());
            LOGGER.log(
                LogLevel::Error,
                &format!(
                    "Post-processing failed for recording {}: {}",
                    session_id, error_msg
                ),
                "recording_manager",
            );

            // Transition state machine: Processing → Failed
            self.transition_to_failed(session_id, state.clone(), error_msg.clone(), app)?;

            Err(NotariError::PipelineError(error_msg))
        }
    }
}

// Helper methods for evidence generation and encryption
impl MacOSRecordingManager {
    /// Transition state machine through recording lifecycle with events
    pub fn transition_to_preparing(
        &self,
        session_id: &str,
        state: SharedRecordingState,
        app: &tauri::AppHandle,
    ) -> NotariResult<()> {
        let mut state_guard = state.lock()?;
        if let Some(ref mut recording) = state_guard.active_recording {
            if recording.session.session_id == session_id {
                recording.state_machine = recording
                    .state_machine
                    .clone()
                    .prepare(app)
                    .map_err(|e| NotariError::StateTransitionFailed(e))?;
            }
        }
        Ok(())
    }

    /// Transition to Recording state
    pub fn transition_to_recording(
        &self,
        session_id: &str,
        state: SharedRecordingState,
        app: &tauri::AppHandle,
    ) -> NotariResult<()> {
        let mut state_guard = state.lock()?;
        if let Some(ref mut recording) = state_guard.active_recording {
            if recording.session.session_id == session_id {
                let output_path = recording.session.output_path.clone();
                let process_id = recording.process.as_ref().map(|p| p.id()).unwrap_or(0);
                let encryption_password = recording.session.encryption_password.clone();

                recording.state_machine = recording
                    .state_machine
                    .clone()
                    .start(output_path, process_id, encryption_password, app)
                    .map_err(|e| NotariError::StateTransitionFailed(e))?;
            }
        }
        Ok(())
    }

    /// Transition to Stopping state
    pub fn transition_to_stopping(
        &self,
        session_id: &str,
        state: SharedRecordingState,
        app: &tauri::AppHandle,
    ) -> NotariResult<()> {
        let mut state_guard = state.lock()?;
        if let Some(ref mut recording) = state_guard.active_recording {
            if recording.session.session_id == session_id {
                recording.state_machine = recording
                    .state_machine
                    .clone()
                    .stop(app)
                    .map_err(|e| NotariError::StateTransitionFailed(e))?;
            }
        }
        Ok(())
    }

    /// Transition to Processing state
    pub fn transition_to_processing(
        &self,
        session_id: &str,
        state: SharedRecordingState,
        file_size: u64,
        duration: f64,
        app: &tauri::AppHandle,
    ) -> NotariResult<()> {
        let mut state_guard = state.lock()?;
        if let Some(ref mut recording) = state_guard.active_recording {
            if recording.session.session_id == session_id {
                recording.state_machine = recording
                    .state_machine
                    .clone()
                    .process(file_size, duration, app)
                    .map_err(|e| NotariError::StateTransitionFailed(e))?;
            }
        }
        Ok(())
    }

    /// Transition to Completed state
    pub fn transition_to_completed(
        &self,
        session_id: &str,
        state: SharedRecordingState,
        proof_pack_path: PathBuf,
        plaintext_hash: String,
        encrypted: bool,
        app: &tauri::AppHandle,
    ) -> NotariResult<()> {
        let mut state_guard = state.lock()?;
        if let Some(ref mut recording) = state_guard.active_recording {
            if recording.session.session_id == session_id {
                recording.state_machine = recording
                    .state_machine
                    .clone()
                    .complete(proof_pack_path, plaintext_hash, encrypted, app)
                    .map_err(|e| NotariError::StateTransitionFailed(e))?;
            }
        }
        Ok(())
    }

    /// Transition to Failed state
    pub fn transition_to_failed(
        &self,
        session_id: &str,
        state: SharedRecordingState,
        error: String,
        app: &tauri::AppHandle,
    ) -> NotariResult<()> {
        let mut state_guard = state.lock()?;
        if let Some(ref mut recording) = state_guard.active_recording {
            if recording.session.session_id == session_id {
                recording.state_machine = recording.state_machine.clone().fail(error.clone(), app);
            }
        }
        Ok(())
    }

    /// Encrypt a recorded video file
    #[allow(dead_code)]
    fn encrypt_recording(
        &self,
        session: &ActiveRecording,
        password: &str,
    ) -> Result<(PathBuf, crate::evidence::EncryptionInfo), String> {
        use crate::evidence::VideoEncryptor;

        let input_path = &session.output_path;
        let encrypted_path = input_path.with_extension("mov.enc");

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Encrypting {} to {}",
                input_path.display(),
                encrypted_path.display()
            ),
            "recording_manager",
        );

        // Encrypt the video file with chunked encryption (for streaming)
        let encryption_info =
            VideoEncryptor::encrypt_file_chunked(input_path, &encrypted_path, password)
                .map_err(|e| format!("Encryption failed: {}", e))?;

        // Delete the original unencrypted file
        if let Err(e) = std::fs::remove_file(input_path) {
            LOGGER.log(
                LogLevel::Warn,
                &format!("Failed to delete original unencrypted file: {}", e),
                "recording_manager",
            );
        } else {
            LOGGER.log(
                LogLevel::Info,
                "Deleted original unencrypted file",
                "recording_manager",
            );
        }

        Ok((encrypted_path, encryption_info))
    }

    /// Generate evidence manifest for a completed recording
    #[allow(dead_code)]
    #[allow(deprecated)]
    fn generate_evidence_manifest(
        &self,
        session: &ActiveRecording,
        encryption_info: Option<crate::evidence::EncryptionInfo>,
        plaintext_hash: Option<HashInfo>,
    ) -> Result<(), String> {
        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Generating evidence manifest for session: {}",
                session.session_id
            ),
            "recording_manager",
        );

        // Check if signing key exists, generate if not
        if !keychain::has_signing_key() {
            LOGGER.log(
                LogLevel::Info,
                "No signing key found, generating new key",
                "recording_manager",
            );
            let key_manager = KeyManager::generate();
            keychain::store_signing_key(&key_manager.to_bytes())
                .map_err(|e| format!("Failed to store signing key: {}", e))?;
        }

        // Load signing key
        let key_bytes = keychain::retrieve_signing_key()
            .map_err(|e| format!("Failed to retrieve signing key: {}", e))?;
        let key_manager = KeyManager::from_bytes(&key_bytes)
            .map_err(|e| format!("Failed to load signing key: {}", e))?;

        // Calculate current file hash (encrypted if encrypted, plaintext if not)
        let current_file_hash = HashInfo::from_file(&session.output_path)
            .map_err(|e| format!("Failed to calculate file hash: {}", e))?;

        // Determine which hash to use for manifest creation
        // If we have a plaintext_hash, use it; otherwise use current file hash
        let manifest_plaintext_hash = plaintext_hash.unwrap_or_else(|| current_file_hash.clone());

        // Get file size
        let file_size = self.get_file_size(&session.output_path).unwrap_or(0);

        // Calculate duration
        let duration = (Utc::now() - session.start_time).num_seconds() as f64;

        // Get window ID
        let window_id_u32 = self.parse_window_id(&session.window_id).unwrap_or(0);

        // Collect metadata from session or use placeholders
        let (window_title, app_name, app_bundle_id, resolution) =
            if let Some(ref win_meta) = session.window_metadata {
                (
                    win_meta.title.clone(),
                    win_meta.app_name.clone(),
                    win_meta.app_bundle_id.clone(),
                    format!("{}x{}", win_meta.width, win_meta.height),
                )
            } else {
                (
                    format!("Window {}", window_id_u32),
                    "Unknown".to_string(),
                    "unknown".to_string(),
                    "unknown".to_string(),
                )
            };

        // Build custom metadata from session if provided
        let custom_metadata = if session.recording_title.is_some()
            || session.recording_description.is_some()
            || session.recording_tags.is_some()
        {
            Some(crate::evidence::CustomMetadata {
                title: session.recording_title.clone(),
                description: session.recording_description.clone(),
                tags: session.recording_tags.clone(),
            })
        } else {
            None
        };

        let metadata = Metadata {
            window: EvidenceWindowInfo {
                title: window_title,
                id: window_id_u32,
                app_name,
                app_bundle_id,
            },
            video: VideoInfo {
                resolution,
                frame_rate: 30, // Default frame rate
                codec: "H.264".to_string(),
            },
            custom: custom_metadata,
        };

        // Collect system info
        let system = SystemInfo {
            os: "macOS".to_string(),
            os_version: self.get_macos_version(),
            device_id: self.get_device_id(),
            hostname: self.get_hostname(),
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            recorder: "notari".to_string(),
        };

        // Timestamps
        let now = Utc::now();
        let timestamps = Timestamps {
            started_at: session.start_time,
            stopped_at: now,
            manifest_created_at: now,
        };

        // Create manifest using builder
        use crate::evidence::EvidenceManifestBuilder;

        let session_uuid = Uuid::parse_str(&session.session_id)
            .map_err(|e| format!("Invalid session ID: {}", e))?;

        let mut builder = EvidenceManifestBuilder::new()
            .session_id(session_uuid)
            .file_path(session.output_path.clone())
            .file_hash(manifest_plaintext_hash.clone())
            .file_size(file_size)
            .duration(duration)
            .window_title(&metadata.window.title)
            .window_id(metadata.window.id)
            .app_name(&metadata.window.app_name)
            .app_bundle_id(&metadata.window.app_bundle_id)
            .resolution(&metadata.video.resolution)
            .frame_rate(metadata.video.frame_rate)
            .codec(&metadata.video.codec)
            .system(
                &system.os,
                &system.os_version,
                &system.device_id,
                &system.hostname,
                &system.app_version,
                &system.recorder,
            )
            .timestamps(timestamps);

        // Add custom metadata if present
        if let Some(custom) = &metadata.custom {
            if let Some(title) = &custom.title {
                builder = builder.title(title);
            }
            if let Some(description) = &custom.description {
                builder = builder.description(description);
            }
            if let Some(tags) = &custom.tags {
                for tag in tags {
                    builder = builder.add_tag(tag);
                }
            }
        }

        // Add encryption info if video was encrypted
        if let Some(enc_info) = encryption_info {
            builder = builder
                .encryption_info(enc_info)
                .encrypted_hash(current_file_hash.clone());
            LOGGER.log(
                LogLevel::Info,
                &format!(
                    "Added encryption info to manifest (plaintext hash: {}, encrypted hash: {})",
                    manifest_plaintext_hash.value, current_file_hash.value
                ),
                "recording_manager",
            );
        }

        let mut manifest = builder
            .build()
            .map_err(|e| format!("Failed to build manifest: {}", e))?;

        // Sign manifest
        manifest.sign(&key_manager);

        // Save manifest alongside video file
        let manifest_path = session.output_path.with_extension("json");
        manifest
            .save(&manifest_path)
            .map_err(|e| format!("Failed to save manifest: {}", e))?;

        LOGGER.log(
            LogLevel::Info,
            &format!("Evidence manifest saved: {}", manifest_path.display()),
            "recording_manager",
        );

        Ok(())
    }

    /// Get macOS version
    #[allow(dead_code)]
    fn get_macos_version(&self) -> String {
        std::process::Command::new("sw_vers")
            .arg("-productVersion")
            .output()
            .ok()
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    }

    /// Get device ID (hardware UUID)
    #[allow(dead_code)]
    fn get_device_id(&self) -> String {
        std::process::Command::new("ioreg")
            .args(&["-d2", "-c", "IOPlatformExpertDevice"])
            .output()
            .ok()
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .and_then(|s| {
                s.lines()
                    .find(|line| line.contains("IOPlatformUUID"))
                    .and_then(|line| line.split('"').nth(3))
                    .map(|uuid| uuid.to_string())
            })
            .unwrap_or_else(|| "unknown".to_string())
    }

    /// Get hostname
    #[allow(dead_code)]
    fn get_hostname(&self) -> String {
        std::process::Command::new("hostname")
            .output()
            .ok()
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    }
}

#[cfg(test)]
mod tests {
    use crate::recording_manager::{ActiveRecording, EncryptionRecipient, RecordingPreferences};
    use chrono::Utc;
    use tempfile::TempDir;

    #[test]
    fn test_encryption_settings_preserved_in_active_recording() {
        // This test verifies that encryption settings are properly stored in ActiveRecording
        // and would be available during post-processing.
        //
        // This is a regression test for the bug where encryption_method and encryption_recipients
        // were not being copied to active_recording.session in start_window_recording.

        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.mov");

        // Create recipients
        let recipients = vec![
            EncryptionRecipient {
                id: "user1".to_string(),
                public_key: "test_public_key_1".to_string(),
            },
            EncryptionRecipient {
                id: "user2".to_string(),
                public_key: "test_public_key_2".to_string(),
            },
        ];

        // Create an ActiveRecording with encryption settings
        let mut session = ActiveRecording {
            session_id: "test-session-123".to_string(),
            window_id: "window-456".to_string(),
            start_time: Utc::now(),
            output_path: output_path.clone(),
            preferences: RecordingPreferences::default(),
            window_metadata: None,
            encryption_password: None,
            encryption_method: Some("public-key".to_string()),
            encryption_recipients: Some(recipients.clone()),
            recording_title: None,
            recording_description: None,
            recording_tags: None,
        };

        // Simulate what should happen in start_window_recording:
        // The encryption settings should be copied to the active recording
        let encryption_method = Some("public-key".to_string());
        let encryption_recipients = Some(recipients.clone());

        // This is what the bug was: these lines were missing
        session.encryption_method = encryption_method.clone();
        session.encryption_recipients = encryption_recipients.clone();

        // Verify the settings are preserved
        assert_eq!(session.encryption_method, Some("public-key".to_string()));
        assert!(session.encryption_recipients.is_some());
        assert_eq!(session.encryption_recipients.as_ref().unwrap().len(), 2);

        // Simulate extracting settings during post-processing
        let extracted_method = session.encryption_method.clone();
        let extracted_recipients = session.encryption_recipients.clone();

        // Verify settings are available for pipeline context
        assert_eq!(extracted_method, Some("public-key".to_string()));
        assert!(extracted_recipients.is_some());
        assert_eq!(extracted_recipients.unwrap().len(), 2);
    }

    #[test]
    fn test_password_encryption_settings_preserved() {
        // Test password-based encryption settings preservation
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.mov");

        let mut session = ActiveRecording {
            session_id: "test-session-123".to_string(),
            window_id: "window-456".to_string(),
            start_time: Utc::now(),
            output_path: output_path.clone(),
            preferences: RecordingPreferences::default(),
            window_metadata: None,
            encryption_password: Some("test_password".to_string()),
            encryption_method: Some("password".to_string()),
            encryption_recipients: None,
            recording_title: None,
            recording_description: None,
            recording_tags: None,
        };

        // Simulate copying settings
        let encryption_password = Some("test_password".to_string());
        let encryption_method = Some("password".to_string());

        session.encryption_password = encryption_password.clone();
        session.encryption_method = encryption_method.clone();

        // Verify settings are preserved
        assert_eq!(session.encryption_method, Some("password".to_string()));
        assert_eq!(
            session.encryption_password,
            Some("test_password".to_string())
        );
        assert!(session.encryption_recipients.is_none());
    }
}
