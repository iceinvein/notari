use crate::capture::types::SessionStatus;
use crate::tray::{TrayManager, TrayState};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager, State};

pub type TrayManagerState = Arc<Mutex<TrayManager>>;

#[derive(Debug, Serialize, Deserialize)]
pub struct TrayStateResponse {
    pub state: TrayState,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrayUpdateRequest {
    pub state: TrayState,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionStatusUpdateRequest {
    pub session_status: SessionStatus,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrayTooltipRequest {
    pub tooltip: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrayNotificationRequest {
    pub title: String,
    pub message: String,
    pub notification_type: NotificationType,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum NotificationType {
    Info,
    Success,
    Warning,
    Error,
}

pub fn init_tray_state(app_handle: AppHandle) -> TrayManagerState {
    let tray_manager = TrayManager::new(app_handle);
    Arc::new(Mutex::new(tray_manager))
}

#[tauri::command]
pub async fn initialize_tray(
    tray_state: State<'_, TrayManagerState>,
    app_handle: tauri::AppHandle,
) -> Result<(), String> {
    let mut tray_manager = tray_state
        .lock()
        .map_err(|e| format!("Failed to acquire tray manager lock: {}", e))?;

    match tray_manager.setup_tray() {
        Ok(()) => {
            // Emit success event
            let _ = app_handle.emit("tray-initialized", ());
            Ok(())
        }
        Err(e) => {
            let error_msg = format!("Failed to setup tray: {}", e);

            // Determine if this error is retryable
            let can_retry = match &e {
                crate::tray::TrayError::CreationFailed(msg) => {
                    !msg.contains("permission") && !msg.contains("not supported")
                }
                crate::tray::TrayError::IconNotFound(_) => true,
                crate::tray::TrayError::NotInitialized => true,
                _ => false,
            };

            // Emit failure event with details
            let _ = app_handle.emit(
                "tray-init-failed",
                serde_json::json!({
                    "error": error_msg,
                    "reason": determine_failure_reason(&e),
                    "canRetry": can_retry,
                    "timestamp": chrono::Utc::now().to_rfc3339(),
                }),
            );

            Err(error_msg)
        }
    }
}

fn determine_failure_reason(error: &crate::tray::TrayError) -> &'static str {
    match error {
        crate::tray::TrayError::CreationFailed(msg) => {
            if msg.contains("permission") {
                "insufficient_permissions"
            } else if msg.contains("not supported") {
                "platform_not_supported"
            } else if msg.contains("already exists") || msg.contains("in use") {
                "tray_already_in_use"
            } else {
                "creation_failed"
            }
        }
        crate::tray::TrayError::IconNotFound(_) => "icon_resource_missing",
        crate::tray::TrayError::NotInitialized => "not_initialized",
        _ => "unknown_error",
    }
}

#[tauri::command]
pub async fn update_tray_icon(
    state: TrayState,
    tray_state: State<'_, TrayManagerState>,
) -> Result<(), String> {
    let tray_manager = tray_state
        .lock()
        .map_err(|e| format!("Failed to acquire tray manager lock: {}", e))?;

    tray_manager
        .update_icon(state)
        .map_err(|e| format!("Failed to update tray icon: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn update_tray_from_session_status(
    session_status: SessionStatus,
    tray_state: State<'_, TrayManagerState>,
) -> Result<(), String> {
    let tray_manager = tray_state
        .lock()
        .map_err(|e| format!("Failed to acquire tray manager lock: {}", e))?;

    tray_manager
        .update_from_session_status(session_status)
        .map_err(|e| format!("Failed to update tray from session status: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn get_tray_state(
    tray_state: State<'_, TrayManagerState>,
) -> Result<TrayStateResponse, String> {
    let tray_manager = tray_state
        .lock()
        .map_err(|e| format!("Failed to acquire tray manager lock: {}", e))?;

    let state = tray_manager.get_current_state();

    Ok(TrayStateResponse { state })
}

#[tauri::command]
pub async fn update_tray_menu_for_session(
    has_active_session: bool,
    tray_state: State<'_, TrayManagerState>,
) -> Result<(), String> {
    let tray_manager = tray_state
        .lock()
        .map_err(|e| format!("Failed to acquire tray manager lock: {}", e))?;

    tray_manager
        .update_menu_for_session_state(has_active_session)
        .map_err(|e| format!("Failed to update tray menu: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn update_tray_tooltip(
    tooltip: String,
    tray_state: State<'_, TrayManagerState>,
) -> Result<(), String> {
    let tray_manager = tray_state
        .lock()
        .map_err(|e| format!("Failed to acquire tray manager lock: {}", e))?;

    tray_manager
        .update_tooltip(&tooltip)
        .map_err(|e| format!("Failed to update tray tooltip: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn show_tray_notification(
    title: String,
    message: String,
    notification_type: NotificationType,
    tray_state: State<'_, TrayManagerState>,
) -> Result<(), String> {
    let tray_manager = tray_state
        .lock()
        .map_err(|e| format!("Failed to acquire tray manager lock: {}", e))?;

    tray_manager
        .show_notification(&title, &message, notification_type)
        .map_err(|e| format!("Failed to show tray notification: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn handle_tray_click(
    _tray_state: State<'_, TrayManagerState>,
    popover_state: State<'_, crate::commands::popover::PopoverManagerState>,
) -> Result<(), String> {
    // Toggle popover when tray is clicked
    let popover_manager = popover_state
        .lock()
        .map_err(|e| format!("Failed to acquire popover manager lock: {}", e))?;

    popover_manager
        .toggle_popover()
        .map_err(|e| format!("Failed to toggle popover from tray click: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn destroy_tray(tray_state: State<'_, TrayManagerState>) -> Result<(), String> {
    let mut tray_manager = tray_state
        .lock()
        .map_err(|e| format!("Failed to acquire tray manager lock: {}", e))?;

    tray_manager
        .destroy_tray()
        .map_err(|e| format!("Failed to destroy tray: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn show_main_window(app_handle: AppHandle) -> Result<(), String> {
    // Try to get existing main window
    if let Some(window) = app_handle.get_webview_window("main") {
        window
            .show()
            .map_err(|e| format!("Failed to show existing main window: {}", e))?;
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus main window: {}", e))?;
        return Ok(());
    }

    // If no main window exists, create one
    create_fallback_window(app_handle).await
}

#[tauri::command]
pub async fn create_fallback_window(app_handle: AppHandle) -> Result<(), String> {
    use tauri::WebviewWindowBuilder;

    let window = WebviewWindowBuilder::new(
        &app_handle,
        "fallback",
        tauri::WebviewUrl::App("index.html".into()),
    )
    .title("Notari - Main Window")
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .center()
    .resizable(true)
    .visible(true)
    .build()
    .map_err(|e| format!("Failed to create fallback window: {}", e))?;

    // Emit event to notify that fallback window was created
    let _ = app_handle.emit(
        "fallback-window-created",
        serde_json::json!({
            "windowLabel": "fallback",
            "timestamp": chrono::Utc::now().to_rfc3339(),
        }),
    );

    Ok(())
}

#[tauri::command]
pub async fn request_tray_permissions(app_handle: AppHandle) -> Result<(), String> {
    // On some platforms, we might need to request specific permissions
    // For now, this is a placeholder that could be extended per platform

    #[cfg(target_os = "macos")]
    {
        // On macOS, we might need to request accessibility permissions
        // This would typically involve showing a dialog or opening System Preferences
        let _ = app_handle.emit("permission-request", serde_json::json!({
            "type": "accessibility",
            "platform": "macos",
            "message": "Notari needs accessibility permissions to create a system tray icon. Please grant permissions in System Preferences > Security & Privacy > Privacy > Accessibility."
        }));
    }

    #[cfg(target_os = "windows")]
    {
        // On Windows, tray permissions are usually automatic
        let _ = app_handle.emit(
            "permission-request",
            serde_json::json!({
                "type": "tray",
                "platform": "windows",
                "message": "System tray functionality should be available automatically on Windows."
            }),
        );
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, it depends on the desktop environment
        let _ = app_handle.emit("permission-request", serde_json::json!({
            "type": "tray",
            "platform": "linux",
            "message": "System tray support depends on your desktop environment. Please ensure your system supports system tray applications."
        }));
    }

    Ok(())
}

#[tauri::command]
pub async fn show_system_notification(
    title: String,
    message: String,
    notification_type: String,
    app_handle: AppHandle,
) -> Result<(), String> {
    // Try to show system notification through the OS
    #[cfg(feature = "notification")]
    {
        use tauri_plugin_notification::NotificationExt;

        let notification = app_handle
            .notification()
            .builder()
            .title(&title)
            .body(&message);

        let notification = match notification_type.as_str() {
            "error" => notification.icon("error"),
            "warning" => notification.icon("warning"),
            "success" => notification.icon("success"),
            _ => notification.icon("info"),
        };

        notification
            .show()
            .map_err(|e| format!("Failed to show system notification: {}", e))?;
    }

    #[cfg(not(feature = "notification"))]
    {
        // Fallback: emit event to frontend to handle notification
        let _ = app_handle.emit(
            "system-notification-fallback",
            serde_json::json!({
                "title": title,
                "message": message,
                "type": notification_type,
                "timestamp": chrono::Utc::now().to_rfc3339(),
            }),
        );
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_tray_state_response_serialization() {
        let response = TrayStateResponse {
            state: TrayState::Recording,
        };

        let json = serde_json::to_string(&response).expect("Failed to serialize TrayStateResponse");
        let deserialized: TrayStateResponse =
            serde_json::from_str(&json).expect("Failed to deserialize TrayStateResponse");

        assert!(matches!(deserialized.state, TrayState::Recording));
    }

    #[tokio::test]
    async fn test_tray_update_request_serialization() {
        let request = TrayUpdateRequest {
            state: TrayState::Processing,
        };

        let json = serde_json::to_string(&request).expect("Failed to serialize TrayUpdateRequest");
        let deserialized: TrayUpdateRequest =
            serde_json::from_str(&json).expect("Failed to deserialize TrayUpdateRequest");

        assert!(matches!(deserialized.state, TrayState::Processing));
    }

    #[tokio::test]
    async fn test_session_status_update_request_serialization() {
        let request = SessionStatusUpdateRequest {
            session_status: SessionStatus::Active,
        };

        let json = serde_json::to_string(&request)
            .expect("Failed to serialize SessionStatusUpdateRequest");
        let deserialized: SessionStatusUpdateRequest =
            serde_json::from_str(&json).expect("Failed to deserialize SessionStatusUpdateRequest");

        assert!(matches!(deserialized.session_status, SessionStatus::Active));
    }

    #[tokio::test]
    async fn test_tray_tooltip_request_serialization() {
        let request = TrayTooltipRequest {
            tooltip: "Test tooltip".to_string(),
        };

        let json = serde_json::to_string(&request).expect("Failed to serialize TrayTooltipRequest");
        let deserialized: TrayTooltipRequest =
            serde_json::from_str(&json).expect("Failed to deserialize TrayTooltipRequest");

        assert_eq!(deserialized.tooltip, "Test tooltip");
    }

    #[tokio::test]
    async fn test_tray_notification_request_serialization() {
        let request = TrayNotificationRequest {
            title: "Test Title".to_string(),
            message: "Test Message".to_string(),
            notification_type: NotificationType::Success,
        };

        let json =
            serde_json::to_string(&request).expect("Failed to serialize TrayNotificationRequest");
        let deserialized: TrayNotificationRequest =
            serde_json::from_str(&json).expect("Failed to deserialize TrayNotificationRequest");

        assert_eq!(deserialized.title, "Test Title");
        assert_eq!(deserialized.message, "Test Message");
        assert!(matches!(
            deserialized.notification_type,
            NotificationType::Success
        ));
    }

    #[tokio::test]
    async fn test_notification_type_serialization() {
        let types = vec![
            NotificationType::Info,
            NotificationType::Success,
            NotificationType::Warning,
            NotificationType::Error,
        ];

        for notification_type in types {
            let json = serde_json::to_string(&notification_type)
                .expect("Failed to serialize NotificationType");
            let _: NotificationType =
                serde_json::from_str(&json).expect("Failed to deserialize NotificationType");
        }
    }
}
