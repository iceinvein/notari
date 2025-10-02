use super::{
    create_recording_session, ActiveRecording, InternalRecordingState, RecordingInfo,
    RecordingManager, RecordingPreferences, RecordingStatus, SharedRecordingState,
};
use crate::error::{NotariError, NotariResult};
use crate::evidence::keychain;
use crate::evidence::{
    EvidenceManifest, HashInfo, KeyManager, Metadata, SystemInfo, Timestamps, VideoInfo,
    WindowInfo as EvidenceWindowInfo,
};
use crate::logger::{LogLevel, LOGGER};
use std::io::BufRead;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};

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
    fn check_disk_space(
        &self,
        output_path: &PathBuf,
        estimated_size_mb: u64,
    ) -> NotariResult<()> {
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

        // Create recording session
        let mut session = create_recording_session(window_id, preferences, output_path.clone());

        // Populate window metadata if available
        if let Some(win_info) = window_info {
            session.window_metadata = Some(crate::recording_manager::WindowMetadata {
                title: win_info.title,
                app_name: win_info.application,
                app_bundle_id: "unknown".to_string(), // TODO: Get actual bundle ID
                width: win_info.bounds.width,
                height: win_info.bounds.height,
            });
        }

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
                state_guard.active_recording = Some(InternalRecordingState {
                    session: session.clone(),
                    process: Some(child),
                    last_health_check: Utc::now(),
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

        // Update status to recording
        {
            let mut state_guard = state.lock()?;
            state_guard.update_status(RecordingStatus::Recording);
            // Update the session status in our local copy too
            session.status = RecordingStatus::Recording;
        }

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

            // Update status to stopping
            recording.session.status = RecordingStatus::Stopping;

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

            // Update status to stopped
            recording.session.status = RecordingStatus::Stopped;

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

            // Compute plaintext hash before encryption
            let plaintext_hash = match HashInfo::from_file(&recording.session.output_path) {
                Ok(hash) => Some(hash),
                Err(e) => {
                    LOGGER.log(
                        LogLevel::Error,
                        &format!("Failed to compute plaintext hash: {}", e),
                        "recording_manager",
                    );
                    None
                }
            };

            // Encrypt video if password was provided
            let (final_video_path, encryption_info) = if let Some(ref password) =
                recording.session.encryption_password
            {
                LOGGER.log(
                    LogLevel::Info,
                    "Encrypting recorded video...",
                    "recording_manager",
                );

                match self.encrypt_recording(&recording.session, password) {
                    Ok((encrypted_path, enc_info)) => {
                        LOGGER.log(
                            LogLevel::Info,
                            &format!("Video encrypted successfully: {}", encrypted_path.display()),
                            "recording_manager",
                        );
                        (encrypted_path, Some(enc_info))
                    }
                    Err(e) => {
                        LOGGER.log(
                            LogLevel::Error,
                            &format!("Failed to encrypt video: {}", e),
                            "recording_manager",
                        );
                        // Continue with unencrypted video
                        (recording.session.output_path.clone(), None)
                    }
                }
            } else {
                (recording.session.output_path.clone(), None)
            };

            // Update session with final path
            let mut final_session = recording.session.clone();
            final_session.output_path = final_video_path.clone();

            // Generate evidence manifest (non-blocking, log errors but don't fail)
            let manifest_path = final_video_path.with_extension("json");
            if let Err(e) =
                self.generate_evidence_manifest(&final_session, encryption_info, plaintext_hash)
            {
                LOGGER.log(
                    LogLevel::Error,
                    &format!("Failed to generate evidence manifest: {}", e),
                    "recording_manager",
                );
            }

            // Package into .notari proof pack
            if manifest_path.exists() {
                let notari_path = final_video_path.with_extension("notari");
                LOGGER.log(
                    LogLevel::Info,
                    &format!(
                        "Packaging recording into proof pack: {}",
                        notari_path.display()
                    ),
                    "recording_manager",
                );

                match crate::evidence::proof_pack::create_proof_pack(
                    &final_video_path,
                    &manifest_path,
                    &notari_path,
                ) {
                    Ok(_) => {
                        LOGGER.log(
                            LogLevel::Info,
                            "Proof pack created successfully, cleaning up source files",
                            "recording_manager",
                        );

                        // Delete the original video and manifest files
                        let _ = std::fs::remove_file(&final_video_path);
                        let _ = std::fs::remove_file(&manifest_path);
                    }
                    Err(e) => {
                        LOGGER.log(
                            LogLevel::Error,
                            &format!("Failed to create proof pack: {}, keeping original files", e),
                            "recording_manager",
                        );
                    }
                }
            }

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

    fn pause_recording(
        &self,
        _session_id: &str,
        _state: SharedRecordingState,
    ) -> NotariResult<()> {
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
                        recording.session.status = RecordingStatus::Stopped;
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
                        // Process error
                        recording.session.status = RecordingStatus::Error(e.to_string());
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
        let home_dir = dirs::home_dir()
            .ok_or_else(|| NotariError::ConfigError("Could not determine home directory".to_string()))?;

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
            Err(e) => Err(NotariError::DirectoryCreationFailed(format!("Directory not writable: {}", e))),
        }
    }
}

// Helper methods for evidence generation and encryption
impl MacOSRecordingManager {
    /// Encrypt a recorded video file
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

        // Create manifest
        let session_uuid = Uuid::parse_str(&session.session_id)
            .map_err(|e| format!("Invalid session ID: {}", e))?;

        let mut manifest = EvidenceManifest::new(
            session_uuid,
            session.output_path.clone(),
            manifest_plaintext_hash.clone(),
            file_size,
            duration,
            metadata,
            system,
            timestamps,
        );

        // Update encryption fields if video was encrypted
        if let Some(enc_info) = encryption_info {
            manifest.recording.encrypted = true;
            manifest.recording.encryption = Some(enc_info);
            // Store the encrypted file hash
            manifest.recording.encrypted_hash = Some(current_file_hash.clone());
            LOGGER.log(
                LogLevel::Info,
                &format!(
                    "Added encryption info to manifest (plaintext hash: {}, encrypted hash: {})",
                    manifest_plaintext_hash.value, current_file_hash.value
                ),
                "recording_manager",
            );
        }

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
    fn get_hostname(&self) -> String {
        std::process::Command::new("hostname")
            .output()
            .ok()
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "unknown".to_string())
    }
}
