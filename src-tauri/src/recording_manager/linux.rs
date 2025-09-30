use super::{
    ActiveRecording, RecordingInfo, RecordingManager, RecordingPreferences, SharedRecordingState,
};
use std::path::PathBuf;

pub struct LinuxRecordingManager;

impl LinuxRecordingManager {
    pub fn new() -> Self {
        Self
    }
}

impl RecordingManager for LinuxRecordingManager {
    fn start_recording(
        &self,
        _window_id: &str,
        _preferences: &RecordingPreferences,
        _state: SharedRecordingState,
    ) -> Result<ActiveRecording, String> {
        Err("Recording not implemented for Linux yet".to_string())
    }

    fn stop_recording(
        &self,
        _session_id: &str,
        _state: SharedRecordingState,
    ) -> Result<(), String> {
        Err("Recording not implemented for Linux yet".to_string())
    }

    fn pause_recording(
        &self,
        _session_id: &str,
        _state: SharedRecordingState,
    ) -> Result<(), String> {
        Err("Recording not implemented for Linux yet".to_string())
    }

    fn resume_recording(
        &self,
        _session_id: &str,
        _state: SharedRecordingState,
    ) -> Result<(), String> {
        Err("Recording not implemented for Linux yet".to_string())
    }

    fn get_recording_info(
        &self,
        _session_id: &str,
        _state: SharedRecordingState,
    ) -> Result<RecordingInfo, String> {
        Err("Recording not implemented for Linux yet".to_string())
    }

    fn check_recording_health(&self, _state: SharedRecordingState) -> Result<(), String> {
        Ok(()) // No-op for now
    }

    fn cleanup_orphaned_recordings(&self) -> Result<(), String> {
        Ok(()) // No-op for now
    }

    fn get_default_save_directory(&self) -> Result<PathBuf, String> {
        // Use ~/Videos/Notari as default on Linux
        let home_dir =
            dirs::home_dir().ok_or_else(|| "Could not determine home directory".to_string())?;

        Ok(home_dir.join("Videos").join("Notari"))
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
