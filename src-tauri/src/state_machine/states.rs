/// State type definitions for the recording state machine
///
/// Each state is a distinct type, making invalid states impossible to represent.
/// State-specific data is stored in each state type.
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Idle state - No active recording
///
/// This is the initial state and the state after a session is cleared.
#[derive(Debug, Clone)]
pub struct Idle;

/// Preparing state - Setting up recording
///
/// Validating permissions, checking disk space, initializing codec, etc.
#[derive(Debug, Clone)]
pub struct Preparing {
    /// When preparation started
    pub started_at: DateTime<Utc>,
}

/// Recording state - Actively capturing video
///
/// The recording process is running and capturing frames.
#[derive(Debug, Clone)]
pub struct Recording {
    /// When recording started
    pub started_at: DateTime<Utc>,

    /// Output file path
    pub output_path: PathBuf,

    /// Process ID of the recording process
    pub process_id: u32,

    /// Optional encryption password
    pub encryption_password: Option<String>,
}

/// Stopping state - Gracefully shutting down capture
///
/// The recording process is being stopped gracefully.
#[derive(Debug, Clone)]
pub struct Stopping {
    /// When recording started
    pub started_at: DateTime<Utc>,

    /// When stopping began
    pub stopped_at: DateTime<Utc>,

    /// Output file path
    pub output_path: PathBuf,

    /// Optional encryption password
    pub encryption_password: Option<String>,
}

/// Processing state - Running post-recording pipeline
///
/// Executing the pipeline: hash → encrypt → manifest → sign → package → cleanup
#[derive(Debug, Clone)]
pub struct Processing {
    /// When recording started
    pub started_at: DateTime<Utc>,

    /// When recording stopped
    pub stopped_at: DateTime<Utc>,

    /// When processing began
    pub processing_started_at: DateTime<Utc>,

    /// Output file path
    pub output_path: PathBuf,

    /// Optional encryption password
    pub encryption_password: Option<String>,

    /// File size in bytes
    pub file_size: u64,

    /// Recording duration in seconds
    pub duration: f64,
}

/// Completed state - Recording processed and ready
///
/// The recording has been successfully processed and is ready for verification/anchoring.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Completed {
    /// When recording started
    pub started_at: DateTime<Utc>,

    /// When recording stopped
    pub stopped_at: DateTime<Utc>,

    /// When processing completed
    pub completed_at: DateTime<Utc>,

    /// Path to the .notari proof pack
    pub proof_pack_path: PathBuf,

    /// SHA-256 hash of the plaintext video
    pub plaintext_hash: String,

    /// File size in bytes
    pub file_size: u64,

    /// Recording duration in seconds
    pub duration: f64,

    /// Whether the video was encrypted
    pub encrypted: bool,
}

/// Failed state - Error occurred
///
/// An error occurred during any stage of the recording process.
#[derive(Debug, Clone)]
pub struct Failed {
    /// When the failure occurred
    pub failed_at: DateTime<Utc>,

    /// Error message
    pub error: String,

    /// Which stage failed
    pub failed_stage: FailedStage,

    /// Optional partial output path (if recording got far enough)
    pub partial_output_path: Option<PathBuf>,
}

/// Stage where failure occurred
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FailedStage {
    /// Failed during preparation
    Preparing,

    /// Failed during recording
    Recording,

    /// Failed during stopping
    Stopping,

    /// Failed during processing
    Processing,
}

impl Idle {
    /// Create a new Idle state
    pub fn new() -> Self {
        Self
    }
}

impl Default for Idle {
    fn default() -> Self {
        Self::new()
    }
}

impl Preparing {
    /// Create a new Preparing state
    pub fn new() -> Self {
        Self {
            started_at: Utc::now(),
        }
    }
}

impl Recording {
    /// Create a new Recording state
    pub fn new(output_path: PathBuf, process_id: u32, encryption_password: Option<String>) -> Self {
        Self {
            started_at: Utc::now(),
            output_path,
            process_id,
            encryption_password,
        }
    }

    /// Get recording duration so far
    pub fn duration(&self) -> chrono::Duration {
        Utc::now() - self.started_at
    }
}

impl Stopping {
    /// Create a new Stopping state from Recording
    pub fn from_recording(recording: Recording) -> Self {
        Self {
            started_at: recording.started_at,
            stopped_at: Utc::now(),
            output_path: recording.output_path,
            encryption_password: recording.encryption_password,
        }
    }

    /// Get total recording duration
    pub fn duration(&self) -> chrono::Duration {
        self.stopped_at - self.started_at
    }
}

impl Processing {
    /// Create a new Processing state from Stopping
    pub fn from_stopping(stopping: Stopping, file_size: u64, duration: f64) -> Self {
        Self {
            started_at: stopping.started_at,
            stopped_at: stopping.stopped_at,
            processing_started_at: Utc::now(),
            output_path: stopping.output_path,
            encryption_password: stopping.encryption_password,
            file_size,
            duration,
        }
    }
}

impl Completed {
    /// Create a new Completed state
    pub fn new(
        started_at: DateTime<Utc>,
        stopped_at: DateTime<Utc>,
        proof_pack_path: PathBuf,
        plaintext_hash: String,
        file_size: u64,
        duration: f64,
        encrypted: bool,
    ) -> Self {
        Self {
            started_at,
            stopped_at,
            completed_at: Utc::now(),
            proof_pack_path,
            plaintext_hash,
            file_size,
            duration,
            encrypted,
        }
    }

    /// Get total time from start to completion
    pub fn total_duration(&self) -> chrono::Duration {
        self.completed_at - self.started_at
    }

    /// Get processing time
    pub fn processing_duration(&self) -> chrono::Duration {
        self.completed_at - self.stopped_at
    }
}

impl Failed {
    /// Create a new Failed state
    pub fn new(
        error: String,
        failed_stage: FailedStage,
        partial_output_path: Option<PathBuf>,
    ) -> Self {
        Self {
            failed_at: Utc::now(),
            error,
            failed_stage,
            partial_output_path,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_idle_creation() {
        let idle = Idle::new();
        assert!(matches!(idle, Idle));
    }

    #[test]
    fn test_preparing_creation() {
        let preparing = Preparing::new();
        assert!(preparing.started_at <= Utc::now());
    }

    #[test]
    fn test_recording_duration() {
        let recording = Recording::new(PathBuf::from("/tmp/test.mp4"), 12345, None);

        let duration = recording.duration();
        assert!(duration.num_milliseconds() >= 0);
    }

    #[test]
    fn test_stopping_from_recording() {
        let recording = Recording::new(
            PathBuf::from("/tmp/test.mp4"),
            12345,
            Some("password".to_string()),
        );

        let stopping = Stopping::from_recording(recording);
        assert_eq!(stopping.output_path, PathBuf::from("/tmp/test.mp4"));
        assert_eq!(stopping.encryption_password, Some("password".to_string()));
        assert!(stopping.stopped_at >= stopping.started_at);
    }

    #[test]
    fn test_completed_durations() {
        let started = Utc::now() - chrono::Duration::seconds(10);
        let stopped = Utc::now() - chrono::Duration::seconds(2);

        let completed = Completed::new(
            started,
            stopped,
            PathBuf::from("/tmp/test.notari"),
            "abc123".to_string(),
            1024,
            8.0,
            false,
        );

        assert!(completed.total_duration().num_seconds() >= 10);
        assert!(completed.processing_duration().num_seconds() >= 2);
    }
}
