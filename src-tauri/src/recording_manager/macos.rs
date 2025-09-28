use super::{
    ActiveRecording, InternalRecordingState, RecordingInfo, RecordingManager,
    RecordingPreferences, RecordingStatus, SharedRecordingState, create_recording_session
};
use crate::dev_logger::DEV_LOGGER;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};

use chrono::Utc;

pub struct MacOSRecordingManager;

impl MacOSRecordingManager {
    pub fn new() -> Self {
        Self
    }

    /// Parse window ID to extract the CoreGraphics window ID
    fn parse_window_id(&self, window_id: &str) -> Option<u32> {
        if window_id.starts_with("cg_") {
            window_id[3..].parse().ok()
        } else {
            None
        }
    }

    /// Start screencapture process for recording
    fn start_screencapture_process(
        &self,
        window_id: u32,
        output_path: &PathBuf,
        preferences: &RecordingPreferences,
    ) -> Result<Child, String> {
        let mut cmd = Command::new("screencapture");

        // Window-specific recording
        cmd.arg(format!("-l{}", window_id));

        // Video recording mode
        cmd.arg("-v");

        // No sound by default (we'll add audio support later)
        if !preferences.include_audio {
            cmd.arg("-x");
        }

        // Output file
        cmd.arg(output_path);

        // Set up process stdio
        cmd.stdout(Stdio::piped())
           .stderr(Stdio::piped());

        DEV_LOGGER.log(
            "info",
            &format!("Starting screencapture: {:?}", cmd),
            "recording_manager"
        );

        cmd.spawn().map_err(|e| {
            let error_msg = format!("Failed to start screencapture process: {}", e);
            DEV_LOGGER.log("error", &error_msg, "recording_manager");
            error_msg
        })
    }

    /// Check if a recording process is still running and healthy
    fn check_process_health(&self, process: &mut Child) -> Result<bool, String> {
        match process.try_wait() {
            Ok(Some(status)) => {
                // Process has exited
                if status.success() {
                    DEV_LOGGER.log("info", "Recording process completed successfully", "recording_manager");
                    Ok(false) // Process finished normally
                } else {
                    let error_msg = format!("Recording process exited with error: {}", status);
                    DEV_LOGGER.log("error", &error_msg, "recording_manager");
                    Err(error_msg)
                }
            }
            Ok(None) => {
                // Process is still running
                Ok(true)
            }
            Err(e) => {
                let error_msg = format!("Failed to check process status: {}", e);
                DEV_LOGGER.log("error", &error_msg, "recording_manager");
                Err(error_msg)
            }
        }
    }

    /// Check if screencapture is available on the system
    fn check_screencapture_availability(&self) -> Result<(), String> {
        match std::process::Command::new("which")
            .arg("screencapture")
            .output()
        {
            Ok(output) => {
                if output.status.success() {
                    Ok(())
                } else {
                    Err("screencapture command not found on system".to_string())
                }
            }
            Err(e) => Err(format!("Failed to check screencapture availability: {}", e)),
        }
    }

    /// Check available disk space at the output path
    fn check_disk_space(&self, output_path: &PathBuf, estimated_size_mb: u64) -> Result<(), String> {
        // Get the parent directory of the output file
        let dir = output_path.parent()
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
                    DEV_LOGGER.log("warn", "Could not parse disk space information", "recording_manager");
                    Ok(())
                } else {
                    // If df fails, just warn but don't fail
                    DEV_LOGGER.log("warn", "Could not check disk space", "recording_manager");
                    Ok(())
                }
            }
            Err(_) => {
                // If df command fails, just warn but don't fail
                DEV_LOGGER.log("warn", "Could not execute df command", "recording_manager");
                Ok(())
            }
        }
    }

    /// Terminate recording process gracefully
    fn terminate_process(&self, process: &mut Child) -> Result<(), String> {
        DEV_LOGGER.log("info", "Terminating recording process", "recording_manager");

        // Send SIGTERM for graceful shutdown
        match process.kill() {
            Ok(_) => {
                // Wait for process to exit (with timeout)
                match process.wait() {
                    Ok(status) => {
                        DEV_LOGGER.log(
                            "info",
                            &format!("Recording process terminated with status: {}", status),
                            "recording_manager"
                        );
                        Ok(())
                    }
                    Err(e) => {
                        let error_msg = format!("Failed to wait for process termination: {}", e);
                        DEV_LOGGER.log("error", &error_msg, "recording_manager");
                        Err(error_msg)
                    }
                }
            }
            Err(e) => {
                let error_msg = format!("Failed to terminate recording process: {}", e);
                DEV_LOGGER.log("error", &error_msg, "recording_manager");
                Err(error_msg)
            }
        }
    }

    /// Get file size of recording output
    fn get_file_size(&self, path: &PathBuf) -> Option<u64> {
        std::fs::metadata(path)
            .ok()
            .map(|metadata| metadata.len())
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
        DEV_LOGGER.log(
            "info",
            &format!("Starting recording for window: {}", window_id),
            "recording_manager"
        );

        // Pre-flight checks
        self.check_screencapture_availability()?;

        // Check if there's already an active recording
        {
            let state_guard = state.lock().map_err(|e| e.to_string())?;
            if state_guard.has_active_recording() {
                return Err("Another recording is already in progress".to_string());
            }
        }

        // Parse window ID
        let cg_window_id = self.parse_window_id(window_id)
            .ok_or_else(|| format!("Invalid window ID format: {}", window_id))?;

        // Get default save directory
        let default_dir = self.get_default_save_directory()?;

        // Ensure save directory exists
        let save_dir = preferences.save_directory.as_ref().unwrap_or(&default_dir);
        std::fs::create_dir_all(save_dir).map_err(|e| {
            format!("Failed to create save directory: {}", e)
        })?;

        // Generate output path
        let timestamp = Utc::now();
        let output_path = preferences.get_output_path(&default_dir, timestamp);

        // Check disk space (estimate 100MB for a typical recording)
        self.check_disk_space(&output_path, 100)?;

        // Create recording session
        let mut session = create_recording_session(window_id, preferences, output_path.clone());

        // Start screencapture process
        let process = self.start_screencapture_process(cg_window_id, &output_path, preferences)?;

        // Update global state
        {
            let mut state_guard = state.lock().map_err(|e| e.to_string())?;
            state_guard.active_recording = Some(InternalRecordingState {
                session: session.clone(),
                process: Some(process),
                last_health_check: Utc::now(),
            });
        }

        // Update status to recording
        {
            let mut state_guard = state.lock().map_err(|e| e.to_string())?;
            state_guard.update_status(RecordingStatus::Recording);
            // Update the session status in our local copy too
            session.status = RecordingStatus::Recording;
        }

        DEV_LOGGER.log(
            "info",
            &format!("Recording started successfully: {}", session.session_id),
            "recording_manager"
        );

        Ok(session)
    }

    fn stop_recording(&self, session_id: &str, state: SharedRecordingState) -> Result<(), String> {
        DEV_LOGGER.log(
            "info",
            &format!("Stopping recording: {}", session_id),
            "recording_manager"
        );

        let mut state_guard = state.lock().map_err(|e| e.to_string())?;

        if let Some(ref mut recording) = state_guard.active_recording {
            if recording.session.session_id != session_id {
                return Err("Session ID mismatch".to_string());
            }

            // Update status to stopping
            recording.session.status = RecordingStatus::Stopping;

            // Terminate the process
            if let Some(ref mut process) = recording.process {
                self.terminate_process(process)?;
            }

            // Update status to stopped
            recording.session.status = RecordingStatus::Stopped;

            // Log final file information
            if let Some(file_size) = self.get_file_size(&recording.session.output_path) {
                DEV_LOGGER.log(
                    "info",
                    &format!("Recording completed. File: {}, Size: {} bytes",
                        recording.session.output_path.display(), file_size),
                    "recording_manager"
                );
            }

            DEV_LOGGER.log(
                "info",
                &format!("Recording stopped successfully: {}", session_id),
                "recording_manager"
            );

            // Note: We don't clear the active recording here so the frontend can still
            // query the final status and file information. The frontend should call
            // clear_active_recording when it's done with the session.
        } else {
            return Err("No active recording found".to_string());
        }

        Ok(())
    }

    fn pause_recording(&self, _session_id: &str, _state: SharedRecordingState) -> Result<(), String> {
        // screencapture doesn't support pause/resume, so we'll return an error for now
        Err("Pause/resume not supported with screencapture backend".to_string())
    }

    fn resume_recording(&self, _session_id: &str, _state: SharedRecordingState) -> Result<(), String> {
        // screencapture doesn't support pause/resume, so we'll return an error for now
        Err("Pause/resume not supported with screencapture backend".to_string())
    }

    fn get_recording_info(&self, session_id: &str, state: SharedRecordingState) -> Result<RecordingInfo, String> {
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
                        DEV_LOGGER.log(
                            "debug",
                            &format!("Recording health check passed for session: {}", recording.session.session_id),
                            "recording_manager"
                        );
                        Ok(())
                    }
                    Ok(false) => {
                        // Process finished normally
                        recording.session.status = RecordingStatus::Stopped;
                        DEV_LOGGER.log(
                            "info",
                            &format!("Recording process finished for session: {}", recording.session.session_id),
                            "recording_manager"
                        );
                        Ok(())
                    }
                    Err(e) => {
                        // Process error
                        recording.session.status = RecordingStatus::Error(e.clone());
                        DEV_LOGGER.log(
                            "error",
                            &format!("Recording process error for session {}: {}", recording.session.session_id, e),
                            "recording_manager"
                        );
                        Err(e)
                    }
                }
            } else {
                let error_msg = "No process found for active recording".to_string();
                DEV_LOGGER.log("error", &error_msg, "recording_manager");
                Err(error_msg)
            }
        } else {
            // No active recording to check - this is fine
            Ok(())
        }
    }

    fn cleanup_orphaned_recordings(&self) -> Result<(), String> {
        DEV_LOGGER.log("info", "Checking for orphaned screencapture processes", "recording_manager");

        // Use pgrep to find screencapture processes
        match std::process::Command::new("pgrep")
            .arg("-f")
            .arg("screencapture.*notari_recording")
            .output()
        {
            Ok(output) => {
                if output.status.success() && !output.stdout.is_empty() {
                    let pids_str = String::from_utf8_lossy(&output.stdout);
                    let pids: Vec<&str> = pids_str.trim().split('\n').collect();

                    DEV_LOGGER.log(
                        "warn",
                        &format!("Found {} orphaned screencapture processes", pids.len()),
                        "recording_manager"
                    );

                    // Kill orphaned processes
                    for pid in pids {
                        if let Ok(pid_num) = pid.parse::<u32>() {
                            DEV_LOGGER.log(
                                "info",
                                &format!("Terminating orphaned screencapture process: {}", pid_num),
                                "recording_manager"
                            );

                            // Send SIGTERM first
                            let _ = std::process::Command::new("kill")
                                .arg("-TERM")
                                .arg(pid)
                                .output();

                            // Wait a bit, then send SIGKILL if needed
                            std::thread::sleep(std::time::Duration::from_secs(2));
                            let _ = std::process::Command::new("kill")
                                .arg("-KILL")
                                .arg(pid)
                                .output();
                        }
                    }
                } else {
                    DEV_LOGGER.log("info", "No orphaned screencapture processes found", "recording_manager");
                }
                Ok(())
            }
            Err(e) => {
                let error_msg = format!("Failed to check for orphaned processes: {}", e);
                DEV_LOGGER.log("warn", &error_msg, "recording_manager");
                // Don't fail the operation, just log the warning
                Ok(())
            }
        }
    }

    fn get_default_save_directory(&self) -> Result<PathBuf, String> {
        // Use ~/Movies/Notari as default
        let home_dir = dirs::home_dir()
            .ok_or_else(|| "Could not determine home directory".to_string())?;

        Ok(home_dir.join("Movies").join("Notari"))
    }

    fn validate_save_directory(&self, path: &PathBuf) -> Result<bool, String> {
        // Check if directory exists or can be created
        if !path.exists() {
            std::fs::create_dir_all(path).map_err(|e| {
                format!("Cannot create directory: {}", e)
            })?;
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
