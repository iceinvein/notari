use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

/// Event names - centralized for consistency
pub mod event_names {
    pub const RECORDING_STATE_CHANGED: &str = "recording:state-changed";
    pub const RECORDING_PROGRESS: &str = "recording:progress";
    pub const RECORDING_ERROR: &str = "recording:error";
    pub const BLOCKCHAIN_ANCHOR_STARTED: &str = "blockchain:anchor-started";
    pub const BLOCKCHAIN_ANCHOR_PROGRESS: &str = "blockchain:anchor-progress";
    pub const BLOCKCHAIN_ANCHOR_COMPLETED: &str = "blockchain:anchor-completed";
    pub const BLOCKCHAIN_ANCHOR_FAILED: &str = "blockchain:anchor-failed";
    pub const WINDOW_LIST_CHANGED: &str = "windows:list-changed";
    pub const BACKEND_LOG: &str = "backend:log";
}

/// Recording state change event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingStateChangedEvent {
    pub session_id: Uuid,
    pub status: String, // "Recording", "Paused", "Stopped", "Processing"
    pub timestamp: String,
}

/// Recording progress event (emitted periodically during recording)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingProgressEvent {
    pub session_id: Uuid,
    pub duration_seconds: u64,
    pub file_size_bytes: u64,
    pub timestamp: String,
}

/// Recording error event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordingErrorEvent {
    pub session_id: Option<Uuid>,
    pub error: String,
    pub timestamp: String,
}

/// Blockchain anchor started event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockchainAnchorStartedEvent {
    pub session_id: Uuid,
    pub hash: String,
    pub timestamp: String,
}

/// Blockchain anchor progress event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockchainAnchorProgressEvent {
    pub session_id: Uuid,
    pub status: String, // "Submitting", "Confirming", "Confirmed"
    pub tx_hash: Option<String>,
    pub timestamp: String,
}

/// Blockchain anchor completed event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockchainAnchorCompletedEvent {
    pub session_id: Uuid,
    pub tx_hash: String,
    pub block_number: u64,
    pub explorer_url: String,
    pub timestamp: String,
}

/// Blockchain anchor failed event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockchainAnchorFailedEvent {
    pub session_id: Uuid,
    pub error: String,
    pub timestamp: String,
}

/// Window list changed event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowListChangedEvent {
    pub timestamp: String,
}

/// Backend log event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackendLogEvent {
    pub level: String,
    pub message: String,
    pub source: String,
    pub timestamp: String,
}

/// Event emitter helper functions
pub struct EventEmitter;

impl EventEmitter {
    /// Emit recording state changed event
    pub fn recording_state_changed(
        app: &AppHandle,
        session_id: Uuid,
        status: &str,
    ) -> Result<(), String> {
        let event = RecordingStateChangedEvent {
            session_id,
            status: status.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        app.emit(event_names::RECORDING_STATE_CHANGED, event)
            .map_err(|e| format!("Failed to emit recording state changed event: {}", e))
    }

    /// Emit recording progress event
    pub fn recording_progress(
        app: &AppHandle,
        session_id: Uuid,
        duration_seconds: u64,
        file_size_bytes: u64,
    ) -> Result<(), String> {
        let event = RecordingProgressEvent {
            session_id,
            duration_seconds,
            file_size_bytes,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        app.emit(event_names::RECORDING_PROGRESS, event)
            .map_err(|e| format!("Failed to emit recording progress event: {}", e))
    }

    /// Emit recording error event
    pub fn recording_error(
        app: &AppHandle,
        session_id: Option<Uuid>,
        error: &str,
    ) -> Result<(), String> {
        let event = RecordingErrorEvent {
            session_id,
            error: error.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        app.emit(event_names::RECORDING_ERROR, event)
            .map_err(|e| format!("Failed to emit recording error event: {}", e))
    }

    /// Emit blockchain anchor started event
    pub fn blockchain_anchor_started(
        app: &AppHandle,
        session_id: Uuid,
        hash: &str,
    ) -> Result<(), String> {
        let event = BlockchainAnchorStartedEvent {
            session_id,
            hash: hash.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        app.emit(event_names::BLOCKCHAIN_ANCHOR_STARTED, event)
            .map_err(|e| format!("Failed to emit blockchain anchor started event: {}", e))
    }

    /// Emit blockchain anchor progress event
    pub fn blockchain_anchor_progress(
        app: &AppHandle,
        session_id: Uuid,
        status: &str,
        tx_hash: Option<String>,
    ) -> Result<(), String> {
        let event = BlockchainAnchorProgressEvent {
            session_id,
            status: status.to_string(),
            tx_hash,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        app.emit(event_names::BLOCKCHAIN_ANCHOR_PROGRESS, event)
            .map_err(|e| format!("Failed to emit blockchain anchor progress event: {}", e))
    }

    /// Emit blockchain anchor completed event
    pub fn blockchain_anchor_completed(
        app: &AppHandle,
        session_id: Uuid,
        tx_hash: &str,
        block_number: u64,
        explorer_url: &str,
    ) -> Result<(), String> {
        let event = BlockchainAnchorCompletedEvent {
            session_id,
            tx_hash: tx_hash.to_string(),
            block_number,
            explorer_url: explorer_url.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        app.emit(event_names::BLOCKCHAIN_ANCHOR_COMPLETED, event)
            .map_err(|e| format!("Failed to emit blockchain anchor completed event: {}", e))
    }

    /// Emit blockchain anchor failed event
    pub fn blockchain_anchor_failed(
        app: &AppHandle,
        session_id: Uuid,
        error: &str,
    ) -> Result<(), String> {
        let event = BlockchainAnchorFailedEvent {
            session_id,
            error: error.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        app.emit(event_names::BLOCKCHAIN_ANCHOR_FAILED, event)
            .map_err(|e| format!("Failed to emit blockchain anchor failed event: {}", e))
    }

    /// Emit window list changed event
    pub fn window_list_changed(app: &AppHandle) -> Result<(), String> {
        let event = WindowListChangedEvent {
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        app.emit(event_names::WINDOW_LIST_CHANGED, event)
            .map_err(|e| format!("Failed to emit window list changed event: {}", e))
    }

    /// Emit backend log event
    pub fn backend_log(
        app: &AppHandle,
        level: &str,
        message: &str,
        source: &str,
    ) -> Result<(), String> {
        let event = BackendLogEvent {
            level: level.to_string(),
            message: message.to_string(),
            source: source.to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        app.emit(event_names::BACKEND_LOG, event)
            .map_err(|e| format!("Failed to emit backend log event: {}", e))
    }
}

