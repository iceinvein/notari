/// State Machine Pattern for Recording Sessions
///
/// This module implements a type-safe state machine that enforces valid state transitions
/// at compile time. Invalid states and transitions are impossible to represent.
///
/// # States
///
/// - `Idle` - No active recording
/// - `Preparing` - Setting up recording
/// - `Recording` - Actively capturing video
/// - `Stopping` - Gracefully shutting down
/// - `Processing` - Running post-recording pipeline
/// - `Completed` - Recording ready for verification/anchoring
/// - `Failed` - Error occurred
///
/// # Example
///
/// ```ignore
/// // This example shows the conceptual API, but requires internal types
/// use app_lib::state_machine::RecordingSession;
/// use app_lib::error::NotariResult;
///
/// # fn main() -> NotariResult<()> {
/// let window_id = "window-123".to_string();
/// let preferences = /* RecordingPreferencesSnapshot */;
///
/// let session = RecordingSession::new(window_id, preferences);
/// let session = session.prepare();
/// let session = session.start()?;
/// let session = session.stop();
/// let session = session.process()?;
/// let session = session.complete()?;
/// # Ok(())
/// # }
/// ```
pub mod states;
pub mod transitions;
pub mod wrapper;

pub use states::*;
pub use wrapper::*;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Recording session with type-safe state
///
/// The generic parameter `S` represents the current state of the session.
/// This ensures that only valid operations for the current state can be called.
#[derive(Debug, Clone)]
pub struct RecordingSession<S> {
    /// Unique session identifier
    pub session_id: Uuid,

    /// Current state (type parameter ensures type safety)
    pub state: S,

    /// Session metadata (available in all states)
    pub metadata: SessionMetadata,
}

/// Metadata available in all states
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionMetadata {
    /// Window ID being recorded
    pub window_id: String,

    /// Recording preferences
    pub preferences: RecordingPreferencesSnapshot,

    /// When the session was created
    pub created_at: DateTime<Utc>,

    /// Optional custom title
    pub custom_title: Option<String>,

    /// Optional custom description
    pub custom_description: Option<String>,

    /// Optional custom tags
    pub custom_tags: Vec<String>,
}

/// Snapshot of recording preferences (immutable for the session)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingPreferencesSnapshot {
    pub fps: u32,
    pub quality: String,
    pub audio_enabled: bool,
    pub encryption_enabled: bool,
}

impl<S> RecordingSession<S> {
    /// Get the session ID
    pub fn session_id(&self) -> Uuid {
        self.session_id
    }

    /// Get the window ID
    pub fn window_id(&self) -> &str {
        &self.metadata.window_id
    }

    /// Get session metadata
    pub fn metadata(&self) -> &SessionMetadata {
        &self.metadata
    }

    /// Get mutable session metadata
    pub fn metadata_mut(&mut self) -> &mut SessionMetadata {
        &mut self.metadata
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_metadata() -> SessionMetadata {
        SessionMetadata {
            window_id: "test-window".to_string(),
            preferences: RecordingPreferencesSnapshot {
                fps: 30,
                quality: "high".to_string(),
                audio_enabled: true,
                encryption_enabled: false,
            },
            created_at: Utc::now(),
            custom_title: None,
            custom_description: None,
            custom_tags: vec![],
        }
    }

    #[test]
    fn test_session_metadata_access() {
        let session = RecordingSession {
            session_id: Uuid::new_v4(),
            state: states::Idle,
            metadata: create_test_metadata(),
        };

        assert_eq!(session.window_id(), "test-window");
        assert_eq!(session.metadata().preferences.fps, 30);
    }

    #[test]
    fn test_session_id_access() {
        let id = Uuid::new_v4();
        let session = RecordingSession {
            session_id: id,
            state: states::Idle,
            metadata: create_test_metadata(),
        };

        assert_eq!(session.session_id(), id);
    }
}
