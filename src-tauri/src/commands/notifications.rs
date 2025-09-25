use crate::notifications::{NotificationManager, NotificationPreferences, Notification, NotificationError};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, State};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex;

/// State wrapper for NotificationManager
pub struct NotificationManagerState(pub Arc<Mutex<NotificationManager>>);

/// Initialize notification manager state
pub fn init_notification_state(app_handle: AppHandle) -> NotificationManagerState {
    let manager = NotificationManager::new(app_handle);
    NotificationManagerState(Arc::new(Mutex::new(manager)))
}

/// Response for notification operations
#[derive(Debug, Serialize)]
pub struct NotificationResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<serde_json::Value>,
}

/// Request for updating notification preferences
#[derive(Debug, Deserialize)]
pub struct UpdatePreferencesRequest {
    pub preferences: NotificationPreferences,
}

/// Request for sending session start notification
#[derive(Debug, Deserialize)]
pub struct SessionStartRequest {
    pub session_name: String,
    pub duration_estimate_seconds: Option<u64>,
}

/// Request for sending session stop notification
#[derive(Debug, Deserialize)]
pub struct SessionStopRequest {
    pub session_name: String,
    pub duration_seconds: u64,
    pub activity_count: u32,
}

/// Request for sending proof pack created notification
#[derive(Debug, Deserialize)]
pub struct ProofPackCreatedRequest {
    pub proof_pack_name: String,
    pub file_size: u64,
    pub export_path: String,
}

/// Request for sending blockchain anchor notification
#[derive(Debug, Deserialize)]
pub struct BlockchainAnchorRequest {
    pub transaction_hash: String,
    pub blockchain: String,
    pub verification_url: String,
}

/// Request for sending error notification
#[derive(Debug, Deserialize)]
pub struct ErrorNotificationRequest {
    pub error_message: String,
    pub error_code: Option<String>,
    pub actionable_info: Option<String>,
}

/// Request for sending warning notification
#[derive(Debug, Deserialize)]
pub struct WarningNotificationRequest {
    pub warning_message: String,
    pub suggestion: Option<String>,
}

/// Request for getting notification history
#[derive(Debug, Deserialize)]
pub struct GetHistoryRequest {
    pub limit: Option<usize>,
}

/// Update notification preferences
#[tauri::command]
pub async fn update_notification_preferences(
    request: UpdatePreferencesRequest,
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationResponse, String> {
    let manager = state.0.lock().await;
    
    match manager.update_preferences(request.preferences).await {
        Ok(()) => Ok(NotificationResponse {
            success: true,
            message: "Notification preferences updated successfully".to_string(),
            data: None,
        }),
        Err(e) => Err(format!("Failed to update preferences: {}", e)),
    }
}

/// Get current notification preferences
#[tauri::command]
pub async fn get_notification_preferences(
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationResponse, String> {
    let manager = state.0.lock().await;
    
    match manager.get_preferences().await {
        Ok(preferences) => Ok(NotificationResponse {
            success: true,
            message: "Preferences retrieved successfully".to_string(),
            data: Some(serde_json::to_value(preferences).map_err(|e| format!("Serialization error: {}", e))?),
        }),
        Err(e) => Err(format!("Failed to get preferences: {}", e)),
    }
}

/// Send session start notification
#[tauri::command]
pub async fn notify_session_start(
    request: SessionStartRequest,
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationResponse, String> {
    let manager = state.0.lock().await;
    
    let duration_estimate = request.duration_estimate_seconds.map(Duration::from_secs);
    
    match manager.notify_session_start(&request.session_name, duration_estimate).await {
        Ok(()) => Ok(NotificationResponse {
            success: true,
            message: "Session start notification sent".to_string(),
            data: None,
        }),
        Err(e) => Err(format!("Failed to send session start notification: {}", e)),
    }
}

/// Send session stop notification
#[tauri::command]
pub async fn notify_session_stop(
    request: SessionStopRequest,
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationResponse, String> {
    let manager = state.0.lock().await;
    
    let duration = Duration::from_secs(request.duration_seconds);
    
    match manager.notify_session_stop(&request.session_name, duration, request.activity_count).await {
        Ok(()) => Ok(NotificationResponse {
            success: true,
            message: "Session stop notification sent".to_string(),
            data: None,
        }),
        Err(e) => Err(format!("Failed to send session stop notification: {}", e)),
    }
}

/// Send proof pack created notification
#[tauri::command]
pub async fn notify_proof_pack_created(
    request: ProofPackCreatedRequest,
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationResponse, String> {
    let manager = state.0.lock().await;
    
    match manager.notify_proof_pack_created(&request.proof_pack_name, request.file_size, &request.export_path).await {
        Ok(()) => Ok(NotificationResponse {
            success: true,
            message: "Proof pack created notification sent".to_string(),
            data: None,
        }),
        Err(e) => Err(format!("Failed to send proof pack created notification: {}", e)),
    }
}

/// Send blockchain anchor notification
#[tauri::command]
pub async fn notify_blockchain_anchor(
    request: BlockchainAnchorRequest,
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationResponse, String> {
    let manager = state.0.lock().await;
    
    match manager.notify_blockchain_anchor(&request.transaction_hash, &request.blockchain, &request.verification_url).await {
        Ok(()) => Ok(NotificationResponse {
            success: true,
            message: "Blockchain anchor notification sent".to_string(),
            data: None,
        }),
        Err(e) => Err(format!("Failed to send blockchain anchor notification: {}", e)),
    }
}

/// Send error notification
#[tauri::command]
pub async fn notify_error(
    request: ErrorNotificationRequest,
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationResponse, String> {
    let manager = state.0.lock().await;
    
    match manager.notify_error(
        &request.error_message,
        request.error_code.as_deref(),
        request.actionable_info.as_deref()
    ).await {
        Ok(()) => Ok(NotificationResponse {
            success: true,
            message: "Error notification sent".to_string(),
            data: None,
        }),
        Err(e) => Err(format!("Failed to send error notification: {}", e)),
    }
}

/// Send warning notification
#[tauri::command]
pub async fn notify_warning(
    request: WarningNotificationRequest,
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationResponse, String> {
    let manager = state.0.lock().await;
    
    match manager.notify_warning(&request.warning_message, request.suggestion.as_deref()).await {
        Ok(()) => Ok(NotificationResponse {
            success: true,
            message: "Warning notification sent".to_string(),
            data: None,
        }),
        Err(e) => Err(format!("Failed to send warning notification: {}", e)),
    }
}

/// Get notification history
#[tauri::command]
pub async fn get_notification_history(
    request: GetHistoryRequest,
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationResponse, String> {
    let manager = state.0.lock().await;
    
    match manager.get_history(request.limit).await {
        Ok(history) => Ok(NotificationResponse {
            success: true,
            message: "Notification history retrieved successfully".to_string(),
            data: Some(serde_json::to_value(history).map_err(|e| format!("Serialization error: {}", e))?),
        }),
        Err(e) => Err(format!("Failed to get notification history: {}", e)),
    }
}

/// Process notification queue
#[tauri::command]
pub async fn process_notification_queue(
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationResponse, String> {
    let manager = state.0.lock().await;
    
    match manager.process_queue().await {
        Ok(()) => Ok(NotificationResponse {
            success: true,
            message: "Notification queue processed successfully".to_string(),
            data: None,
        }),
        Err(e) => Err(format!("Failed to process notification queue: {}", e)),
    }
}

/// Clear notification queue
#[tauri::command]
pub async fn clear_notification_queue(
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationResponse, String> {
    let manager = state.0.lock().await;
    
    match manager.clear_queue().await {
        Ok(()) => Ok(NotificationResponse {
            success: true,
            message: "Notification queue cleared successfully".to_string(),
            data: None,
        }),
        Err(e) => Err(format!("Failed to clear notification queue: {}", e)),
    }
}

/// Get notification queue size
#[tauri::command]
pub async fn get_notification_queue_size(
    state: State<'_, NotificationManagerState>,
) -> Result<NotificationResponse, String> {
    let manager = state.0.lock().await;
    
    match manager.get_queue_size().await {
        Ok(size) => Ok(NotificationResponse {
            success: true,
            message: "Queue size retrieved successfully".to_string(),
            data: Some(serde_json::json!({ "queue_size": size })),
        }),
        Err(e) => Err(format!("Failed to get queue size: {}", e)),
    }
}