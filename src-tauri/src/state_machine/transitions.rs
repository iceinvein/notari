/// State transition implementations
///
/// Each transition is a method that consumes the current state and returns a new state.
/// This ensures that invalid transitions are impossible at compile time.
use super::states::*;
use super::{RecordingSession, SessionMetadata};
use std::path::PathBuf;
use uuid::Uuid;

// ============================================================================
// Idle State Transitions
// ============================================================================

impl RecordingSession<Idle> {
    /// Create a new idle session
    pub fn new(window_id: String, preferences: super::RecordingPreferencesSnapshot) -> Self {
        Self {
            session_id: Uuid::new_v4(),
            state: Idle::new(),
            metadata: SessionMetadata {
                window_id,
                preferences,
                created_at: chrono::Utc::now(),
                custom_title: None,
                custom_description: None,
                custom_tags: vec![],
            },
        }
    }

    /// Transition to Preparing state
    pub fn prepare(self) -> RecordingSession<Preparing> {
        RecordingSession {
            session_id: self.session_id,
            state: Preparing::new(),
            metadata: self.metadata,
        }
    }
}

// ============================================================================
// Preparing State Transitions
// ============================================================================

impl RecordingSession<Preparing> {
    /// Transition to Recording state
    pub fn start(
        self,
        output_path: PathBuf,
        process_id: u32,
        encryption_password: Option<String>,
    ) -> RecordingSession<Recording> {
        RecordingSession {
            session_id: self.session_id,
            state: Recording::new(output_path, process_id, encryption_password),
            metadata: self.metadata,
        }
    }

    /// Transition to Failed state
    pub fn fail(self, error: String) -> RecordingSession<Failed> {
        RecordingSession {
            session_id: self.session_id,
            state: Failed::new(error, FailedStage::Preparing, None),
            metadata: self.metadata,
        }
    }
}

// ============================================================================
// Recording State Transitions
// ============================================================================

impl RecordingSession<Recording> {
    /// Transition to Stopping state
    pub fn stop(self) -> RecordingSession<Stopping> {
        RecordingSession {
            session_id: self.session_id,
            state: Stopping::from_recording(self.state),
            metadata: self.metadata,
        }
    }

    /// Transition to Failed state
    pub fn fail(self, error: String) -> RecordingSession<Failed> {
        RecordingSession {
            session_id: self.session_id,
            state: Failed::new(
                error,
                FailedStage::Recording,
                Some(self.state.output_path.clone()),
            ),
            metadata: self.metadata,
        }
    }
}

// ============================================================================
// Stopping State Transitions
// ============================================================================

impl RecordingSession<Stopping> {
    /// Transition to Processing state
    pub fn process(self, file_size: u64, duration: f64) -> RecordingSession<Processing> {
        RecordingSession {
            session_id: self.session_id,
            state: Processing::from_stopping(self.state, file_size, duration),
            metadata: self.metadata,
        }
    }

    /// Transition to Failed state
    pub fn fail(self, error: String) -> RecordingSession<Failed> {
        RecordingSession {
            session_id: self.session_id,
            state: Failed::new(
                error,
                FailedStage::Stopping,
                Some(self.state.output_path.clone()),
            ),
            metadata: self.metadata,
        }
    }
}

// ============================================================================
// Processing State Transitions
// ============================================================================

impl RecordingSession<Processing> {
    /// Transition to Completed state
    pub fn complete(
        self,
        proof_pack_path: PathBuf,
        plaintext_hash: String,
        encrypted: bool,
    ) -> RecordingSession<Completed> {
        RecordingSession {
            session_id: self.session_id,
            state: Completed::new(
                self.state.started_at,
                self.state.stopped_at,
                proof_pack_path,
                plaintext_hash,
                self.state.file_size,
                self.state.duration,
                encrypted,
            ),
            metadata: self.metadata,
        }
    }

    /// Transition to Failed state
    pub fn fail(self, error: String) -> RecordingSession<Failed> {
        RecordingSession {
            session_id: self.session_id,
            state: Failed::new(
                error,
                FailedStage::Processing,
                Some(self.state.output_path.clone()),
            ),
            metadata: self.metadata,
        }
    }
}

// ============================================================================
// Completed State Transitions
// ============================================================================

impl RecordingSession<Completed> {
    /// Transition back to Idle state (clear session)
    pub fn clear(self) -> RecordingSession<Idle> {
        RecordingSession {
            session_id: Uuid::new_v4(), // New session ID
            state: Idle::new(),
            metadata: SessionMetadata {
                window_id: self.metadata.window_id,
                preferences: self.metadata.preferences,
                created_at: chrono::Utc::now(),
                custom_title: None,
                custom_description: None,
                custom_tags: vec![],
            },
        }
    }
}

// ============================================================================
// Failed State Transitions
// ============================================================================

impl RecordingSession<Failed> {
    /// Transition back to Idle state (clear error and reset)
    pub fn clear(self) -> RecordingSession<Idle> {
        RecordingSession {
            session_id: Uuid::new_v4(), // New session ID
            state: Idle::new(),
            metadata: SessionMetadata {
                window_id: self.metadata.window_id,
                preferences: self.metadata.preferences,
                created_at: chrono::Utc::now(),
                custom_title: None,
                custom_description: None,
                custom_tags: vec![],
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state_machine::RecordingPreferencesSnapshot;

    fn create_test_preferences() -> RecordingPreferencesSnapshot {
        RecordingPreferencesSnapshot {
            fps: 30,
            quality: "high".to_string(),
            audio_enabled: true,
            encryption_enabled: false,
        }
    }

    #[test]
    fn test_idle_to_preparing() {
        let session = RecordingSession::new("window-1".to_string(), create_test_preferences());
        let session_id = session.session_id();

        let session = session.prepare();

        assert_eq!(session.session_id(), session_id);
        assert_eq!(session.window_id(), "window-1");
    }

    #[test]
    fn test_preparing_to_recording() {
        let session = RecordingSession::new("window-1".to_string(), create_test_preferences());
        let session = session.prepare();

        let session = session.start(PathBuf::from("/tmp/test.mp4"), 12345, None);

        assert_eq!(session.state.output_path, PathBuf::from("/tmp/test.mp4"));
        assert_eq!(session.state.process_id, 12345);
    }

    #[test]
    fn test_recording_to_stopping() {
        let session = RecordingSession::new("window-1".to_string(), create_test_preferences());
        let session = session.prepare();
        let session = session.start(PathBuf::from("/tmp/test.mp4"), 12345, None);

        let session = session.stop();

        assert_eq!(session.state.output_path, PathBuf::from("/tmp/test.mp4"));
        assert!(session.state.stopped_at >= session.state.started_at);
    }

    #[test]
    fn test_stopping_to_processing() {
        let session = RecordingSession::new("window-1".to_string(), create_test_preferences());
        let session = session.prepare();
        let session = session.start(PathBuf::from("/tmp/test.mp4"), 12345, None);
        let session = session.stop();

        let session = session.process(1024, 10.5);

        assert_eq!(session.state.file_size, 1024);
        assert_eq!(session.state.duration, 10.5);
    }

    #[test]
    fn test_processing_to_completed() {
        let session = RecordingSession::new("window-1".to_string(), create_test_preferences());
        let session = session.prepare();
        let session = session.start(PathBuf::from("/tmp/test.mp4"), 12345, None);
        let session = session.stop();
        let session = session.process(1024, 10.5);

        let session = session.complete(
            PathBuf::from("/tmp/test.notari"),
            "abc123".to_string(),
            false,
        );

        assert_eq!(
            session.state.proof_pack_path,
            PathBuf::from("/tmp/test.notari")
        );
        assert_eq!(session.state.plaintext_hash, "abc123");
        assert_eq!(session.state.file_size, 1024);
        assert_eq!(session.state.duration, 10.5);
        assert!(!session.state.encrypted);
    }

    #[test]
    fn test_completed_to_idle() {
        let session = RecordingSession::new("window-1".to_string(), create_test_preferences());
        let original_id = session.session_id();

        let session = session.prepare();
        let session = session.start(PathBuf::from("/tmp/test.mp4"), 12345, None);
        let session = session.stop();
        let session = session.process(1024, 10.5);
        let session = session.complete(
            PathBuf::from("/tmp/test.notari"),
            "abc123".to_string(),
            false,
        );

        let session = session.clear();

        // Should have new session ID
        assert_ne!(session.session_id(), original_id);
        assert_eq!(session.window_id(), "window-1");
    }

    #[test]
    fn test_preparing_to_failed() {
        let session = RecordingSession::new("window-1".to_string(), create_test_preferences());
        let session = session.prepare();

        let session = session.fail("Disk space check failed".to_string());

        assert_eq!(session.state.error, "Disk space check failed");
        assert!(matches!(session.state.failed_stage, FailedStage::Preparing));
    }

    #[test]
    fn test_failed_to_idle() {
        let session = RecordingSession::new("window-1".to_string(), create_test_preferences());
        let session = session.prepare();
        let session = session.fail("Test error".to_string());

        let session = session.clear();

        assert_eq!(session.window_id(), "window-1");
    }
}
