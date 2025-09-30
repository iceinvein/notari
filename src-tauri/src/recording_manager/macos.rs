use super::{
    create_recording_session, ActiveRecording, InternalRecordingState, RecordingInfo,
    RecordingManager, RecordingPreferences, RecordingStatus, SharedRecordingState,
};
use crate::logger::{LOGGER, LogLevel};
use std::io::BufRead;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};

use chrono::Utc;

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
    fn check_process_health(&self, process: &mut Child) -> Result<bool, String> {
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
                    Err(error_msg)
                }
            }
            Ok(None) => {
                // Process is still running
                Ok(true)
            }
            Err(e) => {
                let error_msg = format!("Failed to check process status: {}", e);
                LOGGER.log(LogLevel::Error, &error_msg, "backend");
                Err(error_msg)
            }
        }
    }

    /// Check available disk space at the output path
    fn check_disk_space(
        &self,
        output_path: &PathBuf,
        estimated_size_mb: u64,
    ) -> Result<(), String> {
        // Get the parent directory of the output file
        let dir = output_path
            .parent()
            .ok_or_else(|| "Invalid output path".to_string())?;

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
                                    return Err(format!(
                                        "Insufficient disk space. Available: {}MB, Required: {}MB",
                                        available_mb, estimated_size_mb
                                    ));
                                }
                                return Ok(());
                            }
                        }
                    }
                    // If parsing fails, just warn but don't fail
                    LOGGER.log(LogLevel::Warn, "Could not parse disk space information", "backend");
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
    fn terminate_process(&self, process: &mut Child) -> Result<(), String> {
        LOGGER.log(LogLevel::Info, "Terminating recording process", "backend");

        // Send SIGTERM for graceful shutdown
        match process.kill() {
            Ok(_) => {
                // Wait for process to exit (with timeout)
                match process.wait() {
                    Ok(status) => {
                        LOGGER.log(
                            LogLevel::Info,
                            &format!("Recording process terminated with status: {}", status),
                            "recording_manager",
                        );
                        Ok(())
                    }
                    Err(e) => {
                        let error_msg = format!("Failed to wait for process termination: {}", e);
                        LOGGER.log(LogLevel::Error, &error_msg, "backend");
                        Err(error_msg)
                    }
                }
            }
            Err(e) => {
                let error_msg = format!("Failed to terminate recording process: {}", e);
                LOGGER.log(LogLevel::Error, &error_msg, "backend");
                Err(error_msg)
            }
        }
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
        state: SharedRecordingState,
    ) -> Result<ActiveRecording, String> {
        LOGGER.log(
            LogLevel::Info,
            &format!("Starting recording for window: {}", window_id),
            "recording_manager",
        );

        // Check if there's already an active recording
        {
            let state_guard = state.lock().map_err(|e| e.to_string())?;
            if state_guard.has_active_recording() {
                return Err("Another recording is already in progress".to_string());
            }
        }

        // Parse window ID
        let cg_window_id = self
            .parse_window_id(window_id)
            .ok_or_else(|| format!("Invalid window ID format: {}", window_id))?;

        // Get default save directory
        let default_dir = self.get_default_save_directory()?;

        // Ensure save directory exists
        let save_dir = preferences.save_directory.as_ref().unwrap_or(&default_dir);
        std::fs::create_dir_all(save_dir)
            .map_err(|e| format!("Failed to create save directory: {}", e))?;

        // Generate output path
        let timestamp = Utc::now();
        let output_path = preferences.get_output_path(&default_dir, timestamp);

        // Check disk space (estimate 100MB for a typical recording)
        self.check_disk_space(&output_path, 100)?;

        // Create recording session
        let mut session = create_recording_session(window_id, preferences, output_path.clone());

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
                let mut state_guard = state.lock().map_err(|e| e.to_string())?;
                state_guard.active_recording = Some(InternalRecordingState {
                    session: session.clone(),
                    process: Some(child),
                    last_health_check: Utc::now(),
                });
                LOGGER.log(LogLevel::Info, "Started ScreenCaptureKit sidecar", "backend");
            }
            Err(e) => {
                let msg = format!("Failed to spawn SCK sidecar: {}", e);
                LOGGER.log(LogLevel::Error, &msg, "backend");
                return Err(msg);
            }
        }

        // Update status to recording
        {
            let mut state_guard = state.lock().map_err(|e| e.to_string())?;
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

    fn stop_recording(&self, session_id: &str, state: SharedRecordingState) -> Result<(), String> {
        LOGGER.log(
            LogLevel::Info,
            &format!("Stopping recording: {}", session_id),
            "recording_manager",
        );

        let mut state_guard = state.lock().map_err(|e| e.to_string())?;

        if let Some(ref mut recording) = state_guard.active_recording {
            if recording.session.session_id != session_id {
                return Err("Session ID mismatch".to_string());
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

            LOGGER.log(
                LogLevel::Info,
                &format!("Recording stopped successfully: {}", session_id),
                "recording_manager",
            );

            // Note: We don't clear the active recording here so the frontend can still
            // query the final status and file information. The frontend should call
            // clear_active_recording when it's done with the session.
        } else {
            return Err("No active recording found".to_string());
        }

        Ok(())
    }

    fn pause_recording(
        &self,
        _session_id: &str,
        _state: SharedRecordingState,
    ) -> Result<(), String> {
        Err("Pause/resume not supported".to_string())
    }

    fn resume_recording(
        &self,
        _session_id: &str,
        _state: SharedRecordingState,
    ) -> Result<(), String> {
        Err("Pause/resume not supported".to_string())
    }

    fn get_recording_info(
        &self,
        session_id: &str,
        state: SharedRecordingState,
    ) -> Result<RecordingInfo, String> {
        let state_guard = state.lock().map_err(|e| e.to_string())?;

        if let Some(ref recording) = state_guard.active_recording {
            if recording.session.session_id != session_id {
                return Err("Session ID mismatch".to_string());
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
            Err("No active recording found".to_string())
        }
    }

    fn check_recording_health(&self, state: SharedRecordingState) -> Result<(), String> {
        let mut state_guard = state.lock().map_err(|e| e.to_string())?;

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
                        recording.session.status = RecordingStatus::Error(e.clone());
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

    fn cleanup_orphaned_recordings(&self) -> Result<(), String> {
        Ok(())
    }

    fn get_default_save_directory(&self) -> Result<PathBuf, String> {
        // Use ~/Movies/Notari as default
        let home_dir =
            dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

        Ok(home_dir.join("Movies").join("Notari"))
    }

    fn validate_save_directory(&self, path: &PathBuf) -> Result<bool, String> {
        // Check if directory exists or can be created
        if !path.exists() {
            std::fs::create_dir_all(path).map_err(|e| format!("Cannot create directory: {}", e))?;
        }

        // Check if directory is writable
        let test_file = path.join(".notari_write_test");
        match std::fs::write(&test_file, "test") {
            Ok(_) => {
                let _ = std::fs::remove_file(&test_file);
                Ok(true)
            }
            Err(e) => Err(format!("Directory not writable: {}", e)),
        }
    }
}
