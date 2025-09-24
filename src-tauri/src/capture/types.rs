use serde::{Deserialize, Serialize};
use std::time::SystemTime;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct SessionId(pub Uuid);

impl SessionId {
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl std::fmt::Display for SessionId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    pub capture_screen: bool,
    pub capture_keystrokes: bool,
    pub capture_mouse: bool,
    pub privacy_filters: Vec<PrivacyFilter>,
    pub quality_settings: CaptureQuality,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyFilter {
    pub filter_type: PrivacyFilterType,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PrivacyFilterType {
    PasswordFields,
    CreditCardNumbers,
    SocialSecurityNumbers,
    PersonalEmails,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureQuality {
    pub screen_fps: u32,
    pub screen_resolution_scale: f32,
    pub compression_level: u8,
}

impl Default for CaptureQuality {
    fn default() -> Self {
        Self {
            screen_fps: 30,
            screen_resolution_scale: 1.0,
            compression_level: 5,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionStatus {
    Active,
    Paused,
    Completed,
    Failed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureEvent {
    pub id: Uuid,
    pub session_id: SessionId,
    pub timestamp: SystemTime,
    pub event_type: CaptureEventType,
    pub signature: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CaptureEventType {
    ScreenCapture {
        image_data: Vec<u8>,
        width: u32,
        height: u32,
    },
    KeyboardEvent {
        key_code: u32,
        key_name: String,
        is_pressed: bool,
        modifiers: Vec<String>,
    },
    MouseEvent {
        x: i32,
        y: i32,
        button: Option<MouseButton>,
        event_type: MouseEventType,
    },
    SessionMarker {
        marker_type: SessionMarkerType,
        metadata: Option<String>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MouseButton {
    Left,
    Right,
    Middle,
    Other(u8),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MouseEventType {
    Move,
    Press,
    Release,
    Scroll { delta_x: i32, delta_y: i32 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionMarkerType {
    Start,
    Pause,
    Resume,
    Stop,
    ApplicationSwitch { app_name: String },
    WindowFocus { window_title: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptedSessionData {
    pub session_id: SessionId,
    pub encrypted_events: Vec<u8>,
    pub encryption_metadata: EncryptionMetadata,
    pub integrity_hash: Vec<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionMetadata {
    pub algorithm: String,
    pub key_id: String,
    pub nonce: Vec<u8>,
    pub created_at: SystemTime,
}

#[derive(Debug, thiserror::Error)]
pub enum CaptureError {
    #[error("Platform not supported: {0}")]
    PlatformNotSupported(String),
    
    #[error("Permission denied: {0}")]
    PermissionDenied(String),
    
    #[error("Hardware error: {0}")]
    HardwareError(String),
    
    #[error("Encryption error: {0}")]
    EncryptionError(String),
    
    #[error("Session not found: {0}")]
    SessionNotFound(SessionId),
    
    #[error("Invalid session state: expected {expected}, found {actual}")]
    InvalidSessionState { expected: String, actual: String },
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Serialization error: {0}")]
    SerializationError(#[from] serde_json::Error),
}

pub type CaptureResult<T> = Result<T, CaptureError>;