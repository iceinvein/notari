use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::time::{Duration, Instant};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use thiserror::Error;
use tokio::sync::Mutex;

/// Notification types supported by the system
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum NotificationType {
    SessionStart,
    SessionStop,
    ProofPackCreated,
    BlockchainAnchor,
    Error,
    Warning,
    Info,
}

/// Notification priority levels
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
pub enum NotificationPriority {
    Low,
    Normal,
    High,
    Critical,
}

/// User preferences for notifications
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPreferences {
    pub enabled_types: HashMap<NotificationType, bool>,
    pub show_sounds: bool,
    pub throttle_duration_ms: u64,
    pub max_queue_size: usize,
    pub batch_similar: bool,
}

impl Default for NotificationPreferences {
    fn default() -> Self {
        let mut enabled_types = HashMap::new();
        enabled_types.insert(NotificationType::SessionStart, true);
        enabled_types.insert(NotificationType::SessionStop, true);
        enabled_types.insert(NotificationType::ProofPackCreated, true);
        enabled_types.insert(NotificationType::BlockchainAnchor, true);
        enabled_types.insert(NotificationType::Error, true);
        enabled_types.insert(NotificationType::Warning, true);
        enabled_types.insert(NotificationType::Info, false);

        Self {
            enabled_types,
            show_sounds: true,
            throttle_duration_ms: 1000, // 1 second throttle
            max_queue_size: 10,
            batch_similar: true,
        }
    }
}

/// A notification to be displayed
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Notification {
    pub id: String,
    pub notification_type: NotificationType,
    pub title: String,
    pub body: String,
    pub priority: NotificationPriority,
    pub sound: Option<String>,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub data: Option<serde_json::Value>,
}

/// Notification queue entry with throttling information
#[derive(Debug, Clone)]
pub struct QueuedNotification {
    pub notification: Notification,
    pub last_sent: Option<Instant>,
    pub count: u32,
}

/// Errors that can occur in the notification system
#[derive(Debug, Error)]
pub enum NotificationError {
    #[error("Notification permission denied")]
    PermissionDenied,
    #[error("Notification type disabled: {0:?}")]
    TypeDisabled(NotificationType),
    #[error("Notification queue full")]
    QueueFull,
    #[error("Invalid notification data: {0}")]
    InvalidData(String),
    #[error("System notification error: {0}")]
    SystemError(String),
}

/// Manages system notifications with queuing, throttling, and user preferences
pub struct NotificationManager {
    app_handle: AppHandle,
    preferences: Arc<Mutex<NotificationPreferences>>,
    notification_queue: Arc<Mutex<VecDeque<QueuedNotification>>>,
    throttle_map: Arc<Mutex<HashMap<NotificationType, Instant>>>,
    notification_history: Arc<Mutex<VecDeque<Notification>>>,
}

impl NotificationManager {
    /// Creates a new NotificationManager instance
    pub fn new(app_handle: AppHandle) -> Self {
        Self {
            app_handle,
            preferences: Arc::new(Mutex::new(NotificationPreferences::default())),
            notification_queue: Arc::new(Mutex::new(VecDeque::new())),
            throttle_map: Arc::new(Mutex::new(HashMap::new())),
            notification_history: Arc::new(Mutex::new(VecDeque::new())),
        }
    }

    /// Updates user preferences for notifications
    pub async fn update_preferences(&self, preferences: NotificationPreferences) -> Result<(), NotificationError> {
        let mut prefs = self.preferences.lock().await;
        *prefs = preferences;
        Ok(())
    }

    /// Gets current notification preferences
    pub async fn get_preferences(&self) -> Result<NotificationPreferences, NotificationError> {
        let prefs = self.preferences.lock().await;
        Ok(prefs.clone())
    }

    /// Sends a session start notification
    pub async fn notify_session_start(&self, session_name: &str, duration_estimate: Option<Duration>) -> Result<(), NotificationError> {
        let body = if let Some(duration) = duration_estimate {
            format!("Started session '{}' (estimated duration: {})", session_name, format_duration(duration))
        } else {
            format!("Started session '{}'", session_name)
        };

        let notification = Notification {
            id: uuid::Uuid::new_v4().to_string(),
            notification_type: NotificationType::SessionStart,
            title: "Session Started".to_string(),
            body,
            priority: NotificationPriority::Normal,
            sound: Some("session_start.wav".to_string()),
            timestamp: chrono::Utc::now(),
            data: Some(serde_json::json!({
                "session_name": session_name,
                "duration_estimate": duration_estimate.map(|d| d.as_secs())
            })),
        };

        self.send_notification(notification).await
    }

    /// Sends a session stop notification
    pub async fn notify_session_stop(&self, session_name: &str, duration: Duration, activity_count: u32) -> Result<(), NotificationError> {
        let body = format!(
            "Completed session '{}' - Duration: {}, Activities: {}",
            session_name,
            format_duration(duration),
            activity_count
        );

        let notification = Notification {
            id: uuid::Uuid::new_v4().to_string(),
            notification_type: NotificationType::SessionStop,
            title: "Session Completed".to_string(),
            body,
            priority: NotificationPriority::Normal,
            sound: Some("session_stop.wav".to_string()),
            timestamp: chrono::Utc::now(),
            data: Some(serde_json::json!({
                "session_name": session_name,
                "duration_seconds": duration.as_secs(),
                "activity_count": activity_count
            })),
        };

        self.send_notification(notification).await
    }

    /// Sends a proof pack creation notification
    pub async fn notify_proof_pack_created(&self, proof_pack_name: &str, file_size: u64, export_path: &str) -> Result<(), NotificationError> {
        let body = format!(
            "Proof pack '{}' created successfully ({} MB)",
            proof_pack_name,
            file_size / 1024 / 1024
        );

        let notification = Notification {
            id: uuid::Uuid::new_v4().to_string(),
            notification_type: NotificationType::ProofPackCreated,
            title: "Proof Pack Ready".to_string(),
            body,
            priority: NotificationPriority::High,
            sound: Some("proof_pack_created.wav".to_string()),
            timestamp: chrono::Utc::now(),
            data: Some(serde_json::json!({
                "proof_pack_name": proof_pack_name,
                "file_size": file_size,
                "export_path": export_path
            })),
        };

        self.send_notification(notification).await
    }

    /// Sends a blockchain anchoring notification
    pub async fn notify_blockchain_anchor(&self, transaction_hash: &str, blockchain: &str, verification_url: &str) -> Result<(), NotificationError> {
        let body = format!(
            "Proof anchored to {} blockchain. Transaction: {}",
            blockchain,
            &transaction_hash[..8]
        );

        let notification = Notification {
            id: uuid::Uuid::new_v4().to_string(),
            notification_type: NotificationType::BlockchainAnchor,
            title: "Blockchain Verification Complete".to_string(),
            body,
            priority: NotificationPriority::High,
            sound: Some("blockchain_anchor.wav".to_string()),
            timestamp: chrono::Utc::now(),
            data: Some(serde_json::json!({
                "transaction_hash": transaction_hash,
                "blockchain": blockchain,
                "verification_url": verification_url
            })),
        };

        self.send_notification(notification).await
    }

    /// Sends an error notification
    pub async fn notify_error(&self, error_message: &str, error_code: Option<&str>, actionable_info: Option<&str>) -> Result<(), NotificationError> {
        let mut body = format!("Error: {}", error_message);
        if let Some(action) = actionable_info {
            body.push_str(&format!(" - {}", action));
        }

        let notification = Notification {
            id: uuid::Uuid::new_v4().to_string(),
            notification_type: NotificationType::Error,
            title: "Notari Error".to_string(),
            body,
            priority: NotificationPriority::Critical,
            sound: Some("error.wav".to_string()),
            timestamp: chrono::Utc::now(),
            data: Some(serde_json::json!({
                "error_message": error_message,
                "error_code": error_code,
                "actionable_info": actionable_info
            })),
        };

        self.send_notification(notification).await
    }

    /// Sends a warning notification
    pub async fn notify_warning(&self, warning_message: &str, suggestion: Option<&str>) -> Result<(), NotificationError> {
        let mut body = format!("Warning: {}", warning_message);
        if let Some(suggestion) = suggestion {
            body.push_str(&format!(" - {}", suggestion));
        }

        let notification = Notification {
            id: uuid::Uuid::new_v4().to_string(),
            notification_type: NotificationType::Warning,
            title: "Notari Warning".to_string(),
            body,
            priority: NotificationPriority::Normal,
            sound: Some("warning.wav".to_string()),
            timestamp: chrono::Utc::now(),
            data: Some(serde_json::json!({
                "warning_message": warning_message,
                "suggestion": suggestion
            })),
        };

        self.send_notification(notification).await
    }

    /// Sends a generic notification
    pub async fn send_notification(&self, notification: Notification) -> Result<(), NotificationError> {
        // Check if notification type is enabled
        let preferences = {
            let prefs = self.preferences.lock().await;
            prefs.clone()
        };

        if !preferences.enabled_types.get(&notification.notification_type).unwrap_or(&false) {
            return Err(NotificationError::TypeDisabled(notification.notification_type));
        }

        // Check throttling
        if self.should_throttle(&notification.notification_type, &preferences).await? {
            self.queue_notification(notification, &preferences).await?;
            return Ok(());
        }

        // Send the notification
        self.send_system_notification(&notification, &preferences).await?;

        // Update throttle map
        {
            let mut throttle_map = self.throttle_map.lock().await;
            throttle_map.insert(notification.notification_type.clone(), Instant::now());
        }

        // Add to history
        self.add_to_history(notification).await?;

        Ok(())
    }

    /// Checks if a notification type should be throttled
    async fn should_throttle(&self, notification_type: &NotificationType, preferences: &NotificationPreferences) -> Result<bool, NotificationError> {
        let throttle_map = self.throttle_map.lock().await;

        if let Some(last_sent) = throttle_map.get(notification_type) {
            let elapsed = last_sent.elapsed();
            let throttle_duration = Duration::from_millis(preferences.throttle_duration_ms);
            Ok(elapsed < throttle_duration)
        } else {
            Ok(false)
        }
    }

    /// Queues a notification for later sending
    async fn queue_notification(&self, notification: Notification, preferences: &NotificationPreferences) -> Result<(), NotificationError> {
        let mut queue = self.notification_queue.lock().await;

        // Check queue size limit
        if queue.len() >= preferences.max_queue_size {
            return Err(NotificationError::QueueFull);
        }

        // If batching is enabled, check for similar notifications
        if preferences.batch_similar {
            if let Some(existing) = queue.iter_mut().find(|q| q.notification.notification_type == notification.notification_type) {
                existing.count += 1;
                existing.notification.body = format!("{} (and {} more)", existing.notification.body, existing.count);
                return Ok(());
            }
        }

        queue.push_back(QueuedNotification {
            notification,
            last_sent: None,
            count: 1,
        });

        Ok(())
    }

    /// Sends the actual system notification
    async fn send_system_notification(&self, notification: &Notification, preferences: &NotificationPreferences) -> Result<(), NotificationError> {
        use tauri_plugin_notification::{NotificationExt, PermissionState};
        
        // Check notification permission
        let permission = self.app_handle.notification().permission_state().map_err(|e| {
            NotificationError::SystemError(format!("Failed to check notification permission: {}", e))
        })?;

        if permission != PermissionState::Granted {
            return Err(NotificationError::PermissionDenied);
        }

        // Create notification builder
        let mut builder = self.app_handle.notification()
            .builder()
            .title(&notification.title)
            .body(&notification.body);

        // Add sound if enabled and available
        if preferences.show_sounds {
            if let Some(sound) = &notification.sound {
                builder = builder.sound(sound);
            }
        }

        // Send the notification
        builder.show().map_err(|e| {
            NotificationError::SystemError(format!("Failed to send notification: {}", e))
        })?;

        // Emit event to frontend for tray updates
        self.app_handle.emit("notification-sent", &notification).map_err(|e| {
            NotificationError::SystemError(format!("Failed to emit notification event: {}", e))
        })?;

        Ok(())
    }

    /// Adds notification to history
    async fn add_to_history(&self, notification: Notification) -> Result<(), NotificationError> {
        let mut history = self.notification_history.lock().await;

        history.push_back(notification);

        // Keep only last 100 notifications
        while history.len() > 100 {
            history.pop_front();
        }

        Ok(())
    }

    /// Gets notification history
    pub async fn get_history(&self, limit: Option<usize>) -> Result<Vec<Notification>, NotificationError> {
        let history = self.notification_history.lock().await;

        let notifications: Vec<Notification> = history.iter().cloned().collect();
        
        if let Some(limit) = limit {
            Ok(notifications.into_iter().rev().take(limit).collect())
        } else {
            Ok(notifications.into_iter().rev().collect())
        }
    }

    /// Processes queued notifications (should be called periodically)
    pub async fn process_queue(&self) -> Result<(), NotificationError> {
        let preferences = self.get_preferences().await?;
        let mut processed_notifications = Vec::new();

        {
            let mut queue = self.notification_queue.lock().await;

            while let Some(queued) = queue.pop_front() {
                if !self.should_throttle(&queued.notification.notification_type, &preferences).await? {
                    processed_notifications.push(queued.notification.clone());
                    
                    // Update throttle map
                    {
                        let mut throttle_map = self.throttle_map.lock().await;
                        throttle_map.insert(queued.notification.notification_type.clone(), Instant::now());
                    }
                } else {
                    // Put it back in the queue
                    queue.push_front(queued);
                    break;
                }
            }
        }

        // Send processed notifications
        for notification in processed_notifications {
            self.send_system_notification(&notification, &preferences).await?;
            self.add_to_history(notification).await?;
        }

        Ok(())
    }

    /// Clears all queued notifications
    pub async fn clear_queue(&self) -> Result<(), NotificationError> {
        let mut queue = self.notification_queue.lock().await;
        queue.clear();
        Ok(())
    }

    /// Gets the current queue size
    pub async fn get_queue_size(&self) -> Result<usize, NotificationError> {
        let queue = self.notification_queue.lock().await;
        Ok(queue.len())
    }
}

/// Helper function to format duration in a human-readable way
pub fn format_duration(duration: Duration) -> String {
    let total_seconds = duration.as_secs();
    let hours = total_seconds / 3600;
    let minutes = (total_seconds % 3600) / 60;
    let seconds = total_seconds % 60;

    if hours > 0 {
        format!("{}h {}m {}s", hours, minutes, seconds)
    } else if minutes > 0 {
        format!("{}m {}s", minutes, seconds)
    } else {
        format!("{}s", seconds)
    }
}

#[cfg(test)]
mod tests;