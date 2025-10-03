use super::{
    ActiveRecording, RecordingInfo, RecordingManager, RecordingPreferences, SharedRecordingState,
};
use crate::error::{NotariError, NotariResult};
use std::path::PathBuf;

pub struct LinuxRecordingManager;

impl LinuxRecordingManager {
    pub fn new() -> Self {
        Self
    }
}

impl RecordingManager for LinuxRecordingManager {
    fn as_any(&self) -> &dyn std::any::Any {
        self
    }

    fn start_recording(
        &self,
        _window_id: &str,
        _preferences: &RecordingPreferences,
        _window_info: Option<crate::window_manager::WindowInfo>,
        _state: SharedRecordingState,
    ) -> NotariResult<ActiveRecording> {
        Err(NotariError::PlatformNotSupported)
    }

    fn stop_recording(&self, _session_id: &str, _state: SharedRecordingState) -> NotariResult<()> {
        Err(NotariError::PlatformNotSupported)
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
        _session_id: &str,
        _state: SharedRecordingState,
    ) -> NotariResult<RecordingInfo> {
        Err(NotariError::PlatformNotSupported)
    }

    fn check_recording_health(&self, _state: SharedRecordingState) -> NotariResult<()> {
        Ok(()) // No-op for now
    }

    fn cleanup_orphaned_recordings(&self) -> NotariResult<()> {
        Ok(()) // No-op for now
    }

    fn get_default_save_directory(&self) -> NotariResult<PathBuf> {
        // Use ~/Videos/Notari as default on Linux
        let home_dir = dirs::home_dir().ok_or_else(|| {
            NotariError::ConfigError("Could not determine home directory".to_string())
        })?;

        Ok(home_dir.join("Videos").join("Notari"))
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
