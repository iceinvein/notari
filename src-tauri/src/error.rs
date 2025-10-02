use thiserror::Error;

/// Central error type for the Notari application
#[derive(Error, Debug)]
pub enum NotariError {
    // ============================================================================
    // Recording Errors
    // ============================================================================
    #[error("Another recording is already in progress")]
    RecordingInProgress,

    #[error("No active recording found")]
    NoActiveRecording,

    #[error("Invalid window ID: {0}")]
    InvalidWindowId(String),

    #[error("Recording session not found: {0}")]
    SessionNotFound(String),

    #[error("Failed to start recording: {0}")]
    RecordingStartFailed(String),

    #[error("Failed to stop recording: {0}")]
    RecordingStopFailed(String),

    #[error("Sidecar process error: {0}")]
    SidecarError(String),

    #[error("Recording process not running")]
    ProcessNotRunning,

    #[error("Recording process error: {0}")]
    RecordingProcessError(String),

    #[error("Recording not implemented for this platform")]
    PlatformNotSupported,

    // ============================================================================
    // Window Manager Errors
    // ============================================================================
    #[error("Screen recording permission not granted")]
    PermissionDenied,

    #[error("Window not found: {0}")]
    WindowNotFound(String),

    #[error("Failed to enumerate windows: {0}")]
    WindowEnumerationFailed(String),

    #[error("Failed to create window thumbnail: {0}")]
    ThumbnailCreationFailed(String),

    #[error("Failed to open system settings: {0}")]
    SystemSettingsOpenFailed(String),

    #[error("Display server not supported: {0}")]
    DisplayServerNotSupported(String),

    // ============================================================================
    // Evidence/Encryption Errors
    // ============================================================================
    #[error("Encryption failed: {0}")]
    EncryptionFailed(String),

    #[error("Decryption failed: {0}")]
    DecryptionFailed(String),

    #[error("Password validation failed: {0}")]
    InvalidPassword(String),

    #[error("Failed to sign manifest: {0}")]
    SigningFailed(String),

    #[error("Signature verification failed: {0}")]
    VerificationFailed(String),

    #[error("Failed to calculate hash: {0}")]
    HashingFailed(String),

    #[error("Failed to create proof pack: {0}")]
    ProofPackCreationFailed(String),

    #[error("Failed to extract proof pack: {0}")]
    ProofPackExtractionFailed(String),

    #[error("Invalid proof pack format: {0}")]
    InvalidProofPack(String),

    // ============================================================================
    // Keychain Errors
    // ============================================================================
    #[error("Failed to store key in keychain: {0}")]
    KeychainStoreFailed(String),

    #[error("Failed to retrieve key from keychain: {0}")]
    KeychainRetrieveFailed(String),

    #[error("Failed to delete key from keychain: {0}")]
    KeychainDeleteFailed(String),

    #[error("No signing key found in keychain: {0}")]
    NoSigningKey(String),

    #[error("Keychain not supported on this platform")]
    KeychainNotSupported,

    // ============================================================================
    // Storage Errors
    // ============================================================================
    #[error("Storage not initialized")]
    StorageNotInitialized,

    #[error("Failed to save to storage: {0}")]
    StorageSaveFailed(String),

    #[error("Failed to load from storage: {0}")]
    StorageLoadFailed(String),

    #[error("Serialization error: {0}")]
    SerializationError(String),

    // ============================================================================
    // Blockchain Errors
    // ============================================================================
    #[error("Blockchain not configured: {0}")]
    BlockchainNotConfigured(String),

    #[error("Failed to anchor to blockchain: {0}")]
    BlockchainAnchorFailed(String),

    #[error("Failed to verify blockchain anchor: {0}")]
    BlockchainVerificationFailed(String),

    #[error("Wallet error: {0}")]
    WalletError(String),

    #[error("Insufficient balance: required {required}, available {available}")]
    InsufficientBalance { required: String, available: String },

    // ============================================================================
    // Video Server Errors
    // ============================================================================
    #[error("Failed to start video server: {0}")]
    VideoServerStartFailed(String),

    #[error("Video stream not found: {0}")]
    StreamNotFound(String),

    #[error("Failed to decrypt video chunk: {0}")]
    ChunkDecryptionFailed(String),

    // ============================================================================
    // File System Errors
    // ============================================================================
    #[error("File not found: {0}")]
    FileNotFound(String),

    #[error("Failed to create directory: {0}")]
    DirectoryCreationFailed(String),

    #[error("Insufficient disk space: required {required} MB, available {available} MB")]
    InsufficientDiskSpace { required: u64, available: u64 },

    #[error("Invalid file path: {0}")]
    InvalidPath(String),

    // ============================================================================
    // Generic/System Errors
    // ============================================================================
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("Mutex lock error")]
    LockError,

    #[error("Network error: {0}")]
    NetworkError(String),

    #[error("Invalid state transition: {0}")]
    InvalidStateTransition(String),

    #[error("Configuration error: {0}")]
    ConfigError(String),

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("{0}")]
    GenericError(String),

    /// Builder pattern validation error
    #[error("Builder error: {0}")]
    BuilderError(String),
}

// Implement conversion from PoisonError for Mutex locks
impl<T> From<std::sync::PoisonError<T>> for NotariError {
    fn from(_: std::sync::PoisonError<T>) -> Self {
        NotariError::LockError
    }
}

// Implement conversion to String for Tauri commands
impl From<NotariError> for String {
    fn from(error: NotariError) -> Self {
        error.to_string()
    }
}

// Automatic conversion from base64::DecodeError
impl From<base64::DecodeError> for NotariError {
    fn from(err: base64::DecodeError) -> Self {
        NotariError::DecryptionFailed(format!("Base64 decode error: {}", err))
    }
}

// Automatic conversion from String (for backward compatibility)
impl From<String> for NotariError {
    fn from(err: String) -> Self {
        NotariError::GenericError(err)
    }
}

// Automatic conversion from &str (for backward compatibility)
impl From<&str> for NotariError {
    fn from(err: &str) -> Self {
        NotariError::GenericError(err.to_string())
    }
}

// Automatic conversion from zip::result::ZipError
impl From<zip::result::ZipError> for NotariError {
    fn from(err: zip::result::ZipError) -> Self {
        NotariError::ProofPackExtractionFailed(format!("ZIP error: {}", err))
    }
}

// Helper type alias for Results
pub type NotariResult<T> = Result<T, NotariError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = NotariError::RecordingInProgress;
        assert_eq!(err.to_string(), "Another recording is already in progress");
    }

    #[test]
    fn test_error_conversion_to_string() {
        let err = NotariError::InvalidWindowId("123".to_string());
        let s: String = err.into();
        assert_eq!(s, "Invalid window ID: 123");
    }

    #[test]
    fn test_io_error_conversion() {
        let io_err = std::io::Error::new(std::io::ErrorKind::NotFound, "file not found");
        let notari_err: NotariError = io_err.into();
        assert!(matches!(notari_err, NotariError::Io(_)));
    }

    #[test]
    fn test_insufficient_disk_space() {
        let err = NotariError::InsufficientDiskSpace {
            required: 100,
            available: 50,
        };
        assert!(err.to_string().contains("100"));
        assert!(err.to_string().contains("50"));
    }
}

