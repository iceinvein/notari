use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::process::Child;
use std::sync::{Arc, Mutex};

use crate::error::NotariResult;
use crate::state_machine::{RecordingPreferencesSnapshot, RecordingSessionState};

// Builder module for fluent API construction
pub mod builder;
pub use builder::ActiveRecordingBuilder;

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

impl RecordingPreferences {
    /// Convert to state machine preferences snapshot
    pub fn to_snapshot(&self) -> RecordingPreferencesSnapshot {
        RecordingPreferencesSnapshot {
            fps: 30, // Default FPS
            quality: format!("{:?}", self.video_quality),
            audio_enabled: self.include_audio,
            encryption_enabled: false, // Will be set based on password presence
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

/// Recipient for public key encryption
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionRecipient {
    pub id: String,
    pub public_key: String,
}

/// Information about an active recording session (internal, no status field)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveRecording {
    pub session_id: String,
    pub window_id: String,
    pub start_time: DateTime<Utc>,
    pub output_path: PathBuf,
    // Note: status is derived from state machine, not stored here
    pub preferences: RecordingPreferences,
    pub window_metadata: Option<WindowMetadata>,
    // Encryption settings
    #[serde(skip_serializing)]
    pub encryption_password: Option<String>,
    pub encryption_method: Option<String>, // "password" or "public-key"
    pub encryption_recipients: Option<Vec<EncryptionRecipient>>,
    // Custom metadata fields
    pub recording_title: Option<String>,
    pub recording_description: Option<String>,
    pub recording_tags: Option<Vec<String>>,
}

impl ActiveRecording {
    /// Convert to a serializable version with status from state machine
    pub fn with_status(self, status: RecordingStatus) -> ActiveRecordingWithStatus {
        ActiveRecordingWithStatus {
            session_id: self.session_id,
            window_id: self.window_id,
            start_time: self.start_time,
            output_path: self.output_path,
            status,
            preferences: self.preferences,
            window_metadata: self.window_metadata,
            recording_title: self.recording_title,
            recording_description: self.recording_description,
            recording_tags: self.recording_tags,
        }
    }
}

/// Active recording with status (for serialization to frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveRecordingWithStatus {
    pub session_id: String,
    pub window_id: String,
    pub start_time: DateTime<Utc>,
    pub output_path: PathBuf,
    pub status: RecordingStatus,
    pub preferences: RecordingPreferences,
    pub window_metadata: Option<WindowMetadata>,
    // Custom metadata fields
    pub recording_title: Option<String>,
    pub recording_description: Option<String>,
    pub recording_tags: Option<Vec<String>>,
}

/// Enhanced recording status with more detailed information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum RecordingStatus {
    Idle,
    Preparing,
    Recording,
    Stopping,
    Processing,
    Completed,
    Failed,
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

/// Internal recording state that includes process handle and state machine
pub struct InternalRecordingState {
    pub session: ActiveRecording,
    pub process: Option<Child>,
    pub last_health_check: DateTime<Utc>,
    /// Type-safe state machine for recording lifecycle
    pub state_machine: RecordingSessionState,
}

impl InternalRecordingState {
    /// Get the current recording status from the state machine
    pub fn get_status(&self) -> RecordingStatus {
        match self.state_machine.state_name() {
            "Idle" => RecordingStatus::Idle,
            "Preparing" => RecordingStatus::Preparing,
            "Recording" => RecordingStatus::Recording,
            "Stopping" => RecordingStatus::Stopping,
            "Processing" => RecordingStatus::Processing,
            "Completed" => RecordingStatus::Completed,
            "Failed" => RecordingStatus::Failed,
            _ => RecordingStatus::Idle,
        }
    }
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
            // Use state machine to check if active
            recording.state_machine.is_active()
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

    /// Clear active recording
    pub fn clear_active_recording(&mut self) {
        self.active_recording = None;
    }
}

/// Thread-safe recording state manager
pub type SharedRecordingState = Arc<Mutex<RecordingState>>;

/// Trait for platform-specific recording implementations
pub trait RecordingManager: Send + Sync {
    /// Get a reference to self as Any for downcasting
    fn as_any(&self) -> &dyn std::any::Any;

    /// Start recording a specific window
    fn start_recording(
        &self,
        window_id: &str,
        preferences: &RecordingPreferences,
        window_info: Option<crate::window_manager::WindowInfo>,
        state: SharedRecordingState,
    ) -> NotariResult<ActiveRecording>;

    /// Stop the current recording
    fn stop_recording(&self, session_id: &str, state: SharedRecordingState) -> NotariResult<()>;

    /// Pause the current recording (if supported)
    fn pause_recording(&self, session_id: &str, state: SharedRecordingState) -> NotariResult<()>;

    /// Resume a paused recording (if supported)
    fn resume_recording(&self, session_id: &str, state: SharedRecordingState) -> NotariResult<()>;

    /// Get detailed information about a recording session
    fn get_recording_info(
        &self,
        session_id: &str,
        state: SharedRecordingState,
    ) -> NotariResult<RecordingInfo>;

    /// Check health of active recording and update status
    fn check_recording_health(&self, state: SharedRecordingState) -> NotariResult<()>;

    /// Clean up any orphaned processes or temp files
    fn cleanup_orphaned_recordings(&self) -> NotariResult<()>;

    /// Get default save directory for recordings
    fn get_default_save_directory(&self) -> NotariResult<PathBuf>;

    /// Validate that a directory is writable for recordings
    fn validate_save_directory(&self, path: &PathBuf) -> NotariResult<bool>;
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
///
/// # Deprecated
/// Use `ActiveRecordingBuilder` instead for a more flexible and type-safe API.
///
/// # Example
/// ```ignore
/// // This example requires internal types from the recording_manager module
/// use app_lib::recording_manager::{ActiveRecordingBuilder, RecordingPreferences};
/// use std::path::PathBuf;
///
/// let window_id = "window-123";
/// let output_path = PathBuf::from("/tmp/recording.mov");
/// let preferences = RecordingPreferences::default();
///
/// let session = ActiveRecordingBuilder::new(window_id)
///     .output_path(output_path)
///     .preferences(preferences)
///     .build()
///     .unwrap();
/// ```
#[deprecated(
    since = "0.2.0",
    note = "Use ActiveRecordingBuilder for a more flexible API"
)]
#[allow(dead_code)]
pub fn create_recording_session(
    window_id: &str,
    preferences: &RecordingPreferences,
    output_path: PathBuf,
) -> ActiveRecording {
    // Use builder internally for consistency
    ActiveRecordingBuilder::new(window_id)
        .output_path(output_path)
        .preferences(preferences.clone())
        .build()
        .expect("Builder should not fail with valid inputs from legacy function")
}

// Platform-specific implementations
#[cfg(target_os = "macos")]
pub mod macos;
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

    #[test]
    fn test_custom_save_directory() {
        let mut prefs = RecordingPreferences::default();
        prefs.save_directory = Some(PathBuf::from("/custom/path"));

        let default_dir = PathBuf::from("/tmp");
        let timestamp = Utc::now();
        let path = prefs.get_output_path(&default_dir, timestamp);

        assert!(path.starts_with("/custom/path"));
    }

    #[test]
    fn test_custom_filename_pattern() {
        let mut prefs = RecordingPreferences::default();
        prefs.filename_pattern = "my_recording_{timestamp}".to_string();

        let timestamp = DateTime::parse_from_rfc3339("2024-01-15T10:30:45Z")
            .unwrap()
            .with_timezone(&Utc);
        let filename = prefs.generate_filename(timestamp);

        assert_eq!(filename, "my_recording_20240115_103045");
    }

    #[test]
    fn test_recording_status_serialization() {
        let statuses = vec![
            RecordingStatus::Idle,
            RecordingStatus::Preparing,
            RecordingStatus::Recording,
            RecordingStatus::Stopping,
            RecordingStatus::Processing,
            RecordingStatus::Completed,
            RecordingStatus::Failed,
            RecordingStatus::Error("test error".to_string()),
        ];

        for status in statuses {
            let json = serde_json::to_string(&status).unwrap();
            let deserialized: RecordingStatus = serde_json::from_str(&json).unwrap();
            // Compare debug representations since RecordingStatus doesn't implement PartialEq
            assert_eq!(format!("{:?}", status), format!("{:?}", deserialized));
        }
    }

    #[test]
    fn test_create_recording_session() {
        let window_id = "test_window_123";
        let prefs = RecordingPreferences::default();
        let output_path = PathBuf::from("/tmp/test.mov");

        let session = create_recording_session(window_id, &prefs, output_path.clone());

        assert_eq!(session.window_id, window_id);
        assert_eq!(session.output_path, output_path);
        assert!(session.encryption_password.is_none());
        assert!(session.recording_title.is_none());
    }

    #[test]
    fn test_window_metadata_serialization() {
        let metadata = WindowMetadata {
            title: "Test Window".to_string(),
            app_name: "Test App".to_string(),
            app_bundle_id: "com.test.app".to_string(),
            width: 1920,
            height: 1080,
        };

        let json = serde_json::to_string(&metadata).unwrap();
        let deserialized: WindowMetadata = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.title, metadata.title);
        assert_eq!(deserialized.app_name, metadata.app_name);
        assert_eq!(deserialized.width, metadata.width);
        assert_eq!(deserialized.height, metadata.height);
    }

    #[test]
    fn test_video_quality_serialization() {
        let qualities = vec![VideoQuality::High, VideoQuality::Medium, VideoQuality::Low];

        for quality in qualities {
            let json = serde_json::to_string(&quality).unwrap();
            let deserialized: VideoQuality = serde_json::from_str(&json).unwrap();
            assert_eq!(format!("{:?}", quality), format!("{:?}", deserialized));
        }
    }

    #[test]
    fn test_recording_preferences_default() {
        let prefs = RecordingPreferences::default();

        assert!(prefs.save_directory.is_none());
        assert_eq!(prefs.filename_pattern, "notari_recording_{timestamp}");
        assert!(!prefs.include_audio);
        assert!(matches!(prefs.video_quality, VideoQuality::High));
    }

    #[test]
    fn test_active_recording_serialization() {
        let session = ActiveRecording {
            session_id: "test-session-123".to_string(),
            window_id: "window-456".to_string(),
            start_time: Utc::now(),
            output_path: PathBuf::from("/tmp/test.mov"),
            preferences: RecordingPreferences::default(),
            window_metadata: Some(WindowMetadata {
                title: "Test".to_string(),
                app_name: "Test App".to_string(),
                app_bundle_id: "com.test".to_string(),
                width: 1920,
                height: 1080,
            }),
            encryption_password: None,
            encryption_method: None,
            encryption_recipients: None,
            recording_title: Some("My Recording".to_string()),
            recording_description: Some("Test description".to_string()),
            recording_tags: Some(vec!["test".to_string(), "demo".to_string()]),
        };

        let json = serde_json::to_string(&session).unwrap();
        let deserialized: ActiveRecording = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.session_id, session.session_id);
        assert_eq!(deserialized.window_id, session.window_id);
        assert_eq!(deserialized.recording_title, session.recording_title);
        assert_eq!(deserialized.recording_tags, session.recording_tags);
        // encryption_password should not be serialized
        assert!(deserialized.encryption_password.is_none());
    }

    #[test]
    fn test_active_recording_encryption_settings() {
        // Test that encryption settings are properly stored in ActiveRecording
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

        let session = ActiveRecording {
            session_id: "test-session-123".to_string(),
            window_id: "window-456".to_string(),
            start_time: Utc::now(),
            output_path: PathBuf::from("/tmp/test.mov"),
            preferences: RecordingPreferences::default(),
            window_metadata: None,
            encryption_password: None,
            encryption_method: Some("public-key".to_string()),
            encryption_recipients: Some(recipients.clone()),
            recording_title: None,
            recording_description: None,
            recording_tags: None,
        };

        // Verify encryption settings are stored
        assert_eq!(session.encryption_method, Some("public-key".to_string()));
        assert!(session.encryption_recipients.is_some());
        assert_eq!(session.encryption_recipients.as_ref().unwrap().len(), 2);
        assert_eq!(
            session.encryption_recipients.as_ref().unwrap()[0].id,
            "user1"
        );
        assert_eq!(
            session.encryption_recipients.as_ref().unwrap()[0].public_key,
            "test_public_key_1"
        );
    }

    #[test]
    fn test_active_recording_password_encryption() {
        // Test password-based encryption settings
        let session = ActiveRecording {
            session_id: "test-session-123".to_string(),
            window_id: "window-456".to_string(),
            start_time: Utc::now(),
            output_path: PathBuf::from("/tmp/test.mov"),
            preferences: RecordingPreferences::default(),
            window_metadata: None,
            encryption_password: Some("test_password".to_string()),
            encryption_method: Some("password".to_string()),
            encryption_recipients: None,
            recording_title: None,
            recording_description: None,
            recording_tags: None,
        };

        // Verify password encryption settings
        assert_eq!(session.encryption_method, Some("password".to_string()));
        assert_eq!(
            session.encryption_password,
            Some("test_password".to_string())
        );
        assert!(session.encryption_recipients.is_none());
    }
}
