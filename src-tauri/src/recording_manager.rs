use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Child;
use std::sync::{Arc, Mutex};
use uuid::Uuid;

/// Recording preferences that can be configured by the user
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingPreferences {
    /// Custom save directory, None means use default
    pub save_directory: Option<PathBuf>,
    /// Filename pattern with {timestamp} placeholder
    pub filename_pattern: String,
    /// Whether to include system audio in recording
    pub include_audio: bool,
    /// Video quality setting
    pub video_quality: VideoQuality,
}

impl Default for RecordingPreferences {
    fn default() -> Self {
        Self {
            save_directory: None,
            filename_pattern: "notari_recording_{timestamp}".to_string(),
            include_audio: false,
            video_quality: VideoQuality::High,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VideoQuality {
    High,
    Medium,
    Low,
}

/// Metadata about the window being recorded
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowMetadata {
    pub title: String,
    pub app_name: String,
    pub app_bundle_id: String,
    pub width: u32,
    pub height: u32,
}

/// Information about an active recording session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveRecording {
    pub session_id: String,
    pub window_id: String,
    pub start_time: DateTime<Utc>,
    pub output_path: PathBuf,
    pub status: RecordingStatus,
    pub preferences: RecordingPreferences,
    pub window_metadata: Option<WindowMetadata>,
    #[serde(skip_serializing)]
    pub encryption_password: Option<String>,
    // Custom metadata fields
    pub recording_title: Option<String>,
    pub recording_description: Option<String>,
    pub recording_tags: Option<Vec<String>>,
}

/// Enhanced recording status with more detailed information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecordingStatus {
    Preparing,
    Recording,
    Paused,
    Stopping,
    Stopped,
    Error(String),
}

/// Detailed information about a recording session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingInfo {
    pub session: ActiveRecording,
    pub duration_seconds: u64,
    pub file_size_bytes: Option<u64>,
    pub estimated_final_size_bytes: Option<u64>,
}

/// Internal recording state that includes process handle
pub struct InternalRecordingState {
    pub session: ActiveRecording,
    pub process: Option<Child>,
    pub last_health_check: DateTime<Utc>,
}

/// Global recording state manager
pub struct RecordingState {
    pub active_recording: Option<InternalRecordingState>,
    pub preferences: RecordingPreferences,
}

impl RecordingState {
    pub fn new() -> Self {
        Self {
            active_recording: None,
            preferences: RecordingPreferences::default(),
        }
    }

    /// Check if there's an active recording session
    pub fn has_active_recording(&self) -> bool {
        if let Some(ref recording) = self.active_recording {
            // Only consider it active if the status is actually recording or preparing
            matches!(
                recording.session.status,
                RecordingStatus::Recording | RecordingStatus::Preparing | RecordingStatus::Paused
            )
        } else {
            false
        }
    }

    /// Get the active recording session info (without process handle)
    pub fn get_active_session(&self) -> Option<ActiveRecording> {
        self.active_recording
            .as_ref()
            .map(|state| state.session.clone())
    }

    /// Update recording status
    pub fn update_status(&mut self, status: RecordingStatus) {
        if let Some(ref mut recording) = self.active_recording {
            recording.session.status = status;
        }
    }

    /// Clear active recording
    pub fn clear_active_recording(&mut self) {
        self.active_recording = None;
    }
}

/// Thread-safe recording state manager
pub type SharedRecordingState = Arc<Mutex<RecordingState>>;

/// Trait for platform-specific recording implementations
pub trait RecordingManager: Send + Sync {
    /// Start recording a specific window
    fn start_recording(
        &self,
        window_id: &str,
        preferences: &RecordingPreferences,
        window_info: Option<crate::window_manager::WindowInfo>,
        state: SharedRecordingState,
    ) -> Result<ActiveRecording, String>;

    /// Stop the current recording
    fn stop_recording(&self, session_id: &str, state: SharedRecordingState) -> Result<(), String>;

    /// Pause the current recording (if supported)
    fn pause_recording(&self, session_id: &str, state: SharedRecordingState) -> Result<(), String>;

    /// Resume a paused recording (if supported)
    fn resume_recording(&self, session_id: &str, state: SharedRecordingState)
        -> Result<(), String>;

    /// Get detailed information about a recording session
    fn get_recording_info(
        &self,
        session_id: &str,
        state: SharedRecordingState,
    ) -> Result<RecordingInfo, String>;

    /// Check health of active recording and update status
    fn check_recording_health(&self, state: SharedRecordingState) -> Result<(), String>;

    /// Clean up any orphaned processes or temp files
    fn cleanup_orphaned_recordings(&self) -> Result<(), String>;

    /// Get default save directory for recordings
    fn get_default_save_directory(&self) -> Result<PathBuf, String>;

    /// Validate that a directory is writable for recordings
    fn validate_save_directory(&self, path: &PathBuf) -> Result<bool, String>;
}

/// Utility functions for recording management
impl RecordingPreferences {
    /// Generate output filename with timestamp
    pub fn generate_filename(&self, timestamp: DateTime<Utc>) -> String {
        let timestamp_str = timestamp.format("%Y%m%d_%H%M%S").to_string();
        self.filename_pattern.replace("{timestamp}", &timestamp_str)
    }

    /// Get the full output path for a recording
    pub fn get_output_path(&self, default_dir: &PathBuf, timestamp: DateTime<Utc>) -> PathBuf {
        let save_dir = self.save_directory.as_ref().unwrap_or(default_dir);
        let filename = format!("{}.mov", self.generate_filename(timestamp));
        save_dir.join(filename)
    }
}

/// Helper function to create a new recording session
pub fn create_recording_session(
    window_id: &str,
    preferences: &RecordingPreferences,
    output_path: PathBuf,
) -> ActiveRecording {
    ActiveRecording {
        session_id: Uuid::new_v4().to_string(),
        window_id: window_id.to_string(),
        start_time: Utc::now(),
        output_path,
        status: RecordingStatus::Preparing,
        preferences: preferences.clone(),
        window_metadata: None,     // Will be set after window lookup
        encryption_password: None, // Will be set if encryption is enabled
        recording_title: None,
        recording_description: None,
        recording_tags: None,
    }
}

// Platform-specific implementations
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::MacOSRecordingManager as PlatformRecordingManager;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::WindowsRecordingManager as PlatformRecordingManager;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::LinuxRecordingManager as PlatformRecordingManager;

/// Create a platform-specific recording manager instance
pub fn create_recording_manager() -> Box<dyn RecordingManager> {
    Box::new(PlatformRecordingManager::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_recording_state_creation() {
        let state = RecordingState::new();
        assert!(!state.has_active_recording());
        assert_eq!(
            state.preferences.filename_pattern,
            "notari_recording_{timestamp}"
        );
    }

    #[test]
    fn test_filename_generation() {
        let prefs = RecordingPreferences::default();
        let timestamp = DateTime::parse_from_rfc3339("2024-01-15T10:30:45Z")
            .unwrap()
            .with_timezone(&Utc);
        let filename = prefs.generate_filename(timestamp);
        assert_eq!(filename, "notari_recording_20240115_103045");
    }

    #[test]
    fn test_output_path_generation() {
        let prefs = RecordingPreferences::default();
        let default_dir = PathBuf::from("/tmp");
        let timestamp = DateTime::parse_from_rfc3339("2024-01-15T10:30:45Z")
            .unwrap()
            .with_timezone(&Utc);
        let path = prefs.get_output_path(&default_dir, timestamp);
        assert_eq!(
            path,
            PathBuf::from("/tmp/notari_recording_20240115_103045.mov")
        );
    }
}
