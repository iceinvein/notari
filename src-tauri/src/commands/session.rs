use crate::storage::{SessionStore, SessionConfig, WorkSession, SessionStatus, SessionIntegrityLog};
use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateSessionRequest {
    pub user_id: String,
    pub config: SessionConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionResponse {
    pub success: bool,
    pub session: Option<WorkSession>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionListResponse {
    pub success: bool,
    pub sessions: Vec<WorkSession>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IntegrityResponse {
    pub success: bool,
    pub is_valid: bool,
    pub logs: Vec<SessionIntegrityLog>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatusResponse {
    pub success: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn create_session(
    request: CreateSessionRequest,
    session_store: State<'_, Arc<Mutex<SessionStore>>>,
) -> Result<SessionResponse, String> {
    let store = session_store.lock().await;
    
    match store.create_session(&request.user_id, request.config).await {
        Ok(session) => Ok(SessionResponse {
            success: true,
            session: Some(session),
            error: None,
        }),
        Err(e) => Ok(SessionResponse {
            success: false,
            session: None,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn get_session(
    session_id: String,
    session_store: State<'_, Arc<Mutex<SessionStore>>>,
) -> Result<SessionResponse, String> {
    let store = session_store.lock().await;
    
    match store.get_session(&session_id).await {
        Ok(session) => Ok(SessionResponse {
            success: true,
            session,
            error: None,
        }),
        Err(e) => Ok(SessionResponse {
            success: false,
            session: None,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn pause_session(
    session_id: String,
    session_store: State<'_, Arc<Mutex<SessionStore>>>,
) -> Result<StatusResponse, String> {
    let store = session_store.lock().await;
    
    match store.pause_session(&session_id).await {
        Ok(_) => Ok(StatusResponse {
            success: true,
            error: None,
        }),
        Err(e) => Ok(StatusResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn resume_session(
    session_id: String,
    session_store: State<'_, Arc<Mutex<SessionStore>>>,
) -> Result<StatusResponse, String> {
    let store = session_store.lock().await;
    
    match store.resume_session(&session_id).await {
        Ok(_) => Ok(StatusResponse {
            success: true,
            error: None,
        }),
        Err(e) => Ok(StatusResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn stop_session(
    session_id: String,
    session_store: State<'_, Arc<Mutex<SessionStore>>>,
) -> Result<StatusResponse, String> {
    let store = session_store.lock().await;
    
    match store.stop_session(&session_id).await {
        Ok(_) => Ok(StatusResponse {
            success: true,
            error: None,
        }),
        Err(e) => Ok(StatusResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn fail_session(
    session_id: String,
    reason: String,
    session_store: State<'_, Arc<Mutex<SessionStore>>>,
) -> Result<StatusResponse, String> {
    let store = session_store.lock().await;
    
    match store.fail_session(&session_id, &reason).await {
        Ok(_) => Ok(StatusResponse {
            success: true,
            error: None,
        }),
        Err(e) => Ok(StatusResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn store_session_data(
    session_id: String,
    data: Vec<u8>,
    file_path: String,
    session_store: State<'_, Arc<Mutex<SessionStore>>>,
) -> Result<StatusResponse, String> {
    let mut store = session_store.lock().await;
    
    match store.store_encrypted_session_data(&session_id, &data, &file_path).await {
        Ok(_) => Ok(StatusResponse {
            success: true,
            error: None,
        }),
        Err(e) => Ok(StatusResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn verify_session_integrity(
    session_id: String,
    session_store: State<'_, Arc<Mutex<SessionStore>>>,
) -> Result<IntegrityResponse, String> {
    let store = session_store.lock().await;
    
    match store.verify_session_integrity(&session_id).await {
        Ok(is_valid) => {
            match store.get_session_integrity_logs(&session_id).await {
                Ok(logs) => Ok(IntegrityResponse {
                    success: true,
                    is_valid,
                    logs,
                    error: None,
                }),
                Err(e) => Ok(IntegrityResponse {
                    success: false,
                    is_valid: false,
                    logs: vec![],
                    error: Some(format!("Failed to get logs: {}", e)),
                }),
            }
        },
        Err(e) => Ok(IntegrityResponse {
            success: false,
            is_valid: false,
            logs: vec![],
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn get_user_sessions(
    user_id: String,
    limit: Option<i64>,
    session_store: State<'_, Arc<Mutex<SessionStore>>>,
) -> Result<SessionListResponse, String> {
    let store = session_store.lock().await;
    
    match store.get_user_sessions(&user_id, limit).await {
        Ok(sessions) => Ok(SessionListResponse {
            success: true,
            sessions,
            error: None,
        }),
        Err(e) => Ok(SessionListResponse {
            success: false,
            sessions: vec![],
            error: Some(e.to_string()),
        }),
    }
}

#[tauri::command]
pub async fn mark_session_tampered(
    session_id: String,
    evidence: String,
    session_store: State<'_, Arc<Mutex<SessionStore>>>,
) -> Result<StatusResponse, String> {
    let store = session_store.lock().await;
    
    match store.mark_session_tampered(&session_id, &evidence).await {
        Ok(_) => Ok(StatusResponse {
            success: true,
            error: None,
        }),
        Err(e) => Ok(StatusResponse {
            success: false,
            error: Some(e.to_string()),
        }),
    }
}

// Additional commands for tray integration and compatibility

#[tauri::command]
pub async fn flush_pending_session_data(
    session_store: State<'_, Arc<Mutex<SessionStore>>>,
) -> Result<(), String> {
    let store = session_store
        .lock()
        .await;
    
    // For now, just return success - the actual implementation would flush pending data
    Ok(())
}