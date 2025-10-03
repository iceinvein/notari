/// Type-erased wrapper for RecordingSession<S>
///
/// This enum allows storing any RecordingSession state in a single type,
/// enabling storage in shared state while maintaining type safety during transitions.
use super::states::*;
use super::RecordingSession;
use crate::events::EventEmitter;
use std::path::PathBuf;
use tauri::AppHandle;
use uuid::Uuid;

/// Wrapper enum that can hold RecordingSession in any state
#[derive(Debug, Clone)]
pub enum RecordingSessionState {
    Idle(RecordingSession<Idle>),
    Preparing(RecordingSession<Preparing>),
    Recording(RecordingSession<Recording>),
    Stopping(RecordingSession<Stopping>),
    Processing(RecordingSession<Processing>),
    Completed(RecordingSession<Completed>),
    Failed(RecordingSession<Failed>),
}

impl RecordingSessionState {
    /// Create a new idle session
    pub fn new(window_id: String, preferences: super::RecordingPreferencesSnapshot) -> Self {
        Self::Idle(RecordingSession::new(window_id, preferences))
    }

    /// Get the session ID
    pub fn session_id(&self) -> Uuid {
        match self {
            Self::Idle(s) => s.session_id(),
            Self::Preparing(s) => s.session_id(),
            Self::Recording(s) => s.session_id(),
            Self::Stopping(s) => s.session_id(),
            Self::Processing(s) => s.session_id(),
            Self::Completed(s) => s.session_id(),
            Self::Failed(s) => s.session_id(),
        }
    }

    /// Get the window ID
    pub fn window_id(&self) -> &str {
        match self {
            Self::Idle(s) => s.window_id(),
            Self::Preparing(s) => s.window_id(),
            Self::Recording(s) => s.window_id(),
            Self::Stopping(s) => s.window_id(),
            Self::Processing(s) => s.window_id(),
            Self::Completed(s) => s.window_id(),
            Self::Failed(s) => s.window_id(),
        }
    }

    /// Get the current state as a string
    pub fn state_name(&self) -> &'static str {
        match self {
            Self::Idle(_) => "Idle",
            Self::Preparing(_) => "Preparing",
            Self::Recording(_) => "Recording",
            Self::Stopping(_) => "Stopping",
            Self::Processing(_) => "Processing",
            Self::Completed(_) => "Completed",
            Self::Failed(_) => "Failed",
        }
    }

    /// Check if the session is in an active state (not idle, completed, or failed)
    pub fn is_active(&self) -> bool {
        matches!(
            self,
            Self::Preparing(_) | Self::Recording(_) | Self::Stopping(_) | Self::Processing(_)
        )
    }

    /// Transition to Preparing state (only from Idle)
    pub fn prepare(self, app: &AppHandle) -> Result<Self, String> {
        match self {
            Self::Idle(session) => {
                let session_id = session.session_id();
                let session = session.prepare();

                // Emit event
                let _ = EventEmitter::recording_state_changed(app, session_id, "Preparing");

                Ok(Self::Preparing(session))
            }
            _ => Err(format!("Cannot prepare from {} state", self.state_name())),
        }
    }

    /// Transition to Recording state (only from Preparing)
    pub fn start(
        self,
        output_path: PathBuf,
        process_id: u32,
        encryption_password: Option<String>,
        app: &AppHandle,
    ) -> Result<Self, String> {
        match self {
            Self::Preparing(session) => {
                let session_id = session.session_id();
                let session = session.start(output_path, process_id, encryption_password);

                // Emit event
                let _ = EventEmitter::recording_state_changed(app, session_id, "Recording");

                Ok(Self::Recording(session))
            }
            _ => Err(format!("Cannot start from {} state", self.state_name())),
        }
    }

    /// Transition to Stopping state (only from Recording)
    pub fn stop(self, app: &AppHandle) -> Result<Self, String> {
        match self {
            Self::Recording(session) => {
                let session_id = session.session_id();
                let session = session.stop();

                // Emit event
                let _ = EventEmitter::recording_state_changed(app, session_id, "Stopping");

                Ok(Self::Stopping(session))
            }
            _ => Err(format!("Cannot stop from {} state", self.state_name())),
        }
    }

    /// Transition to Processing state (only from Stopping)
    pub fn process(self, file_size: u64, duration: f64, app: &AppHandle) -> Result<Self, String> {
        match self {
            Self::Stopping(session) => {
                let session_id = session.session_id();
                let session = session.process(file_size, duration);

                // Emit event
                let _ = EventEmitter::recording_state_changed(app, session_id, "Processing");

                Ok(Self::Processing(session))
            }
            _ => Err(format!("Cannot process from {} state", self.state_name())),
        }
    }

    /// Transition to Completed state (only from Processing)
    pub fn complete(
        self,
        proof_pack_path: PathBuf,
        plaintext_hash: String,
        encrypted: bool,
        app: &AppHandle,
    ) -> Result<Self, String> {
        match self {
            Self::Processing(session) => {
                let session_id = session.session_id();
                let session = session.complete(proof_pack_path, plaintext_hash, encrypted);

                // Emit event
                let _ = EventEmitter::recording_state_changed(app, session_id, "Completed");

                Ok(Self::Completed(session))
            }
            _ => Err(format!("Cannot complete from {} state", self.state_name())),
        }
    }

    /// Transition to Failed state (from any state)
    pub fn fail(self, error: String, app: &AppHandle) -> Self {
        let session_id = self.session_id();

        let failed_session = match self {
            Self::Idle(session) => Self::Failed(RecordingSession {
                session_id: session.session_id,
                state: Failed::new(error.clone(), FailedStage::Preparing, None),
                metadata: session.metadata,
            }),
            Self::Preparing(session) => Self::Failed(session.fail(error.clone())),
            Self::Recording(session) => Self::Failed(session.fail(error.clone())),
            Self::Stopping(session) => Self::Failed(session.fail(error.clone())),
            Self::Processing(session) => Self::Failed(session.fail(error.clone())),
            Self::Completed(session) => Self::Failed(RecordingSession {
                session_id: session.session_id,
                state: Failed::new(error.clone(), FailedStage::Processing, None),
                metadata: session.metadata,
            }),
            Self::Failed(session) => Self::Failed(session), // Already failed
        };

        // Emit error event
        let _ = EventEmitter::recording_error(app, Some(session_id), &error);

        failed_session
    }

    /// Transition back to Idle state (only from Completed or Failed)
    pub fn clear(self, _app: &AppHandle) -> Result<Self, String> {
        match self {
            Self::Completed(session) => {
                let session = session.clear();
                Ok(Self::Idle(session))
            }
            Self::Failed(session) => {
                let session = session.clear();
                Ok(Self::Idle(session))
            }
            _ => Err(format!("Cannot clear from {} state", self.state_name())),
        }
    }

    /// Get the output path if available
    pub fn output_path(&self) -> Option<&PathBuf> {
        match self {
            Self::Recording(s) => Some(&s.state.output_path),
            Self::Stopping(s) => Some(&s.state.output_path),
            Self::Processing(s) => Some(&s.state.output_path),
            _ => None,
        }
    }

    /// Get the proof pack path if completed
    pub fn proof_pack_path(&self) -> Option<&PathBuf> {
        match self {
            Self::Completed(s) => Some(&s.state.proof_pack_path),
            _ => None,
        }
    }

    /// Get the error message if failed
    pub fn error(&self) -> Option<&str> {
        match self {
            Self::Failed(s) => Some(&s.state.error),
            _ => None,
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
    fn test_new_session() {
        let session = RecordingSessionState::new("window-1".to_string(), create_test_preferences());

        assert_eq!(session.state_name(), "Idle");
        assert_eq!(session.window_id(), "window-1");
        assert!(!session.is_active());
    }

    #[test]
    fn test_is_active() {
        let session = RecordingSessionState::new("window-1".to_string(), create_test_preferences());
        assert!(!session.is_active()); // Idle

        // Note: We can't test transitions without AppHandle, but we can test the is_active logic
    }

    #[test]
    fn test_state_names() {
        let session = RecordingSessionState::new("window-1".to_string(), create_test_preferences());
        assert_eq!(session.state_name(), "Idle");
    }
}
