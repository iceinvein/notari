use crate::capture::{CaptureEngine, SessionConfig, SessionId, SessionStatus, EncryptedSessionData};
use crate::capture::platform::PermissionStatus;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{State, Manager};
use tokio::sync::Mutex;



// Tauri state for the capture engine
pub type CaptureEngineState = Arc<Mutex<Option<CaptureEngine>>>;

#[derive(Debug, Serialize, Deserialize)]
pub struct StartSessionRequest {
    pub capture_screen: bool,
    pub capture_keystrokes: bool,
    pub capture_mouse: bool,
    pub privacy_filters: Vec<PrivacyFilterDto>,
    pub quality_settings: CaptureQualityDto,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PrivacyFilterDto {
    pub filter_type: String,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CaptureQualityDto {
    pub screen_fps: u32,
    pub screen_resolution_scale: f32,
    pub compression_level: u8,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionResponse {
    pub session_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionStatusResponse {
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PermissionStatusResponse {
    pub screen_capture: bool,
    pub input_monitoring: bool,
    pub accessibility: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EncryptedSessionResponse {
    pub session_id: String,
    pub encrypted_data_size: usize,
    pub encryption_algorithm: String,
    pub created_at: String,
}

// Initialize the capture engine
#[tauri::command]
pub async fn initialize_capture_engine(
    engine_state: State<'_, CaptureEngineState>,
) -> Result<(), String> {
    let mut engine_guard = engine_state.lock().await;
    
    if engine_guard.is_none() {
        let mut engine = CaptureEngine::new().await
            .map_err(|e| format!("Failed to create capture engine: {}", e))?;
        
        engine.initialize().await
            .map_err(|e| format!("Failed to initialize capture engine: {}", e))?;
        
        *engine_guard = Some(engine);
    }
    
    Ok(())
}

// Start a new capture session
#[tauri::command]
pub async fn start_capture_session(
    request: StartSessionRequest,
    engine_state: State<'_, CaptureEngineState>,
) -> Result<SessionResponse, String> {
    let mut engine_guard = engine_state.lock().await;
    let engine = engine_guard.as_mut()
        .ok_or("Capture engine not initialized")?;

    // Convert DTO to internal types
    let privacy_filters = request.privacy_filters.into_iter()
        .map(|f| crate::capture::types::PrivacyFilter {
            filter_type: match f.filter_type.as_str() {
                "password_fields" => crate::capture::types::PrivacyFilterType::PasswordFields,
                "credit_card_numbers" => crate::capture::types::PrivacyFilterType::CreditCardNumbers,
                "social_security_numbers" => crate::capture::types::PrivacyFilterType::SocialSecurityNumbers,
                "personal_emails" => crate::capture::types::PrivacyFilterType::PersonalEmails,
                _ => crate::capture::types::PrivacyFilterType::PasswordFields,
            },
            enabled: f.enabled,
        })
        .collect();

    let quality_settings = crate::capture::types::CaptureQuality {
        screen_fps: request.quality_settings.screen_fps,
        screen_resolution_scale: request.quality_settings.screen_resolution_scale,
        compression_level: request.quality_settings.compression_level,
    };

    let config = SessionConfig {
        capture_screen: request.capture_screen,
        capture_keystrokes: request.capture_keystrokes,
        capture_mouse: request.capture_mouse,
        privacy_filters,
        quality_settings,
    };

    let session_id = engine.start_session(config).await
        .map_err(|e| format!("Failed to start session: {}", e))?;

    Ok(SessionResponse {
        session_id: session_id.0.to_string(),
    })
}

// Stop a capture session
#[tauri::command]
pub async fn stop_capture_session(
    session_id: String,
    engine_state: State<'_, CaptureEngineState>,
) -> Result<EncryptedSessionResponse, String> {
    let mut engine_guard = engine_state.lock().await;
    let engine = engine_guard.as_mut()
        .ok_or("Capture engine not initialized")?;

    let session_uuid = uuid::Uuid::parse_str(&session_id)
        .map_err(|e| format!("Invalid session ID: {}", e))?;
    let session_id = SessionId(session_uuid);

    let encrypted_data = engine.stop_session(session_id.clone()).await
        .map_err(|e| format!("Failed to stop session: {}", e))?;

    Ok(EncryptedSessionResponse {
        session_id: session_id.0.to_string(),
        encrypted_data_size: encrypted_data.encrypted_events.len(),
        encryption_algorithm: encrypted_data.encryption_metadata.algorithm,
        created_at: format!("{:?}", encrypted_data.encryption_metadata.created_at),
    })
}

// Pause a capture session
#[tauri::command]
pub async fn pause_capture_session(
    session_id: String,
    engine_state: State<'_, CaptureEngineState>,
) -> Result<(), String> {
    let mut engine_guard = engine_state.lock().await;
    let engine = engine_guard.as_mut()
        .ok_or("Capture engine not initialized")?;

    let session_uuid = uuid::Uuid::parse_str(&session_id)
        .map_err(|e| format!("Invalid session ID: {}", e))?;
    let session_id = SessionId(session_uuid);

    engine.pause_session(session_id).await
        .map_err(|e| format!("Failed to pause session: {}", e))?;

    Ok(())
}

// Resume a capture session
#[tauri::command]
pub async fn resume_capture_session(
    session_id: String,
    engine_state: State<'_, CaptureEngineState>,
) -> Result<(), String> {
    let mut engine_guard = engine_state.lock().await;
    let engine = engine_guard.as_mut()
        .ok_or("Capture engine not initialized")?;

    let session_uuid = uuid::Uuid::parse_str(&session_id)
        .map_err(|e| format!("Invalid session ID: {}", e))?;
    let session_id = SessionId(session_uuid);

    engine.resume_session(session_id).await
        .map_err(|e| format!("Failed to resume session: {}", e))?;

    Ok(())
}

// Get session status
#[tauri::command]
pub async fn get_session_status(
    session_id: String,
    engine_state: State<'_, CaptureEngineState>,
) -> Result<SessionStatusResponse, String> {
    let engine_guard = engine_state.lock().await;
    let engine = engine_guard.as_ref()
        .ok_or("Capture engine not initialized")?;

    let session_uuid = uuid::Uuid::parse_str(&session_id)
        .map_err(|e| format!("Invalid session ID: {}", e))?;
    let session_id = SessionId(session_uuid);

    let status = engine.get_session_status(session_id).await
        .map_err(|e| format!("Failed to get session status: {}", e))?;

    let status_string = match status {
        SessionStatus::Active => "active".to_string(),
        SessionStatus::Paused => "paused".to_string(),
        SessionStatus::Completed => "completed".to_string(),
        SessionStatus::Failed(error) => format!("failed: {}", error),
    };

    Ok(SessionStatusResponse {
        status: status_string,
    })
}

// Check permissions
#[tauri::command]
pub async fn check_capture_permissions(
    engine_state: State<'_, CaptureEngineState>,
) -> Result<PermissionStatusResponse, String> {
    let engine_guard = engine_state.lock().await;
    let engine = engine_guard.as_ref()
        .ok_or("Capture engine not initialized")?;

    let permissions = engine.check_permissions().await
        .map_err(|e| format!("Failed to check permissions: {}", e))?;

    Ok(PermissionStatusResponse {
        screen_capture: permissions.screen_capture,
        input_monitoring: permissions.input_monitoring,
        accessibility: permissions.accessibility,
    })
}

// Request permissions
#[tauri::command]
pub async fn request_capture_permissions(
    engine_state: State<'_, CaptureEngineState>,
) -> Result<(), String> {
    let engine_guard = engine_state.lock().await;
    let engine = engine_guard.as_ref()
        .ok_or("Capture engine not initialized")?;

    engine.request_permissions().await
        .map_err(|e| format!("Failed to request permissions: {}", e))?;

    Ok(())
}

// Initialize the capture engine state for Tauri
pub fn init_capture_state() -> CaptureEngineState {
    Arc::new(Mutex::new(None))
}