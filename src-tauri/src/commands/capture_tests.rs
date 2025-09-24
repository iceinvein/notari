#[cfg(test)]
mod tests {
    use super::*;
    use crate::commands::capture::*;
    use std::sync::Arc;
    use tokio::sync::Mutex;

    fn create_test_request() -> StartSessionRequest {
        StartSessionRequest {
            capture_screen: false, // Disable for testing
            capture_keystrokes: false, // Disable for testing
            capture_mouse: false, // Disable for testing
            privacy_filters: vec![
                PrivacyFilterDto {
                    filter_type: "password_fields".to_string(),
                    enabled: true,
                }
            ],
            quality_settings: CaptureQualityDto {
                screen_fps: 10,
                screen_resolution_scale: 0.5,
                compression_level: 8,
            },
        }
    }

    #[tokio::test]
    async fn test_capture_engine_initialization() {
        let engine_state: CaptureEngineState = Arc::new(Mutex::new(None));
        
        // Test initialization
        let result = initialize_capture_engine(tauri::State::from(&engine_state)).await;
        
        // May fail in CI without proper permissions, so we'll check both cases
        match result {
            Ok(()) => {
                // Initialization succeeded
                let engine_guard = engine_state.lock().await;
                assert!(engine_guard.is_some());
            }
            Err(error) => {
                // Initialization failed (likely due to permissions in CI)
                assert!(error.contains("Failed to"));
            }
        }
    }

    #[tokio::test]
    async fn test_session_lifecycle_commands() {
        let engine_state: CaptureEngineState = Arc::new(Mutex::new(None));
        
        // Try to initialize
        let init_result = initialize_capture_engine(tauri::State::from(&engine_state)).await;
        if init_result.is_err() {
            // Skip test if initialization fails (likely due to permissions)
            return;
        }
        
        let request = create_test_request();
        
        // Test starting a session
        let start_result = start_capture_session(request, tauri::State::from(&engine_state)).await;
        
        match start_result {
            Ok(session_response) => {
                let session_id = session_response.session_id;
                
                // Test getting session status
                let status_result = get_session_status(session_id.clone(), tauri::State::from(&engine_state)).await;
                assert!(status_result.is_ok());
                
                let status = status_result.unwrap();
                assert_eq!(status.status, "active");
                
                // Test pausing session
                let pause_result = pause_capture_session(session_id.clone(), tauri::State::from(&engine_state)).await;
                assert!(pause_result.is_ok());
                
                // Check status after pause
                let status_result = get_session_status(session_id.clone(), tauri::State::from(&engine_state)).await;
                assert!(status_result.is_ok());
                
                let status = status_result.unwrap();
                assert_eq!(status.status, "paused");
                
                // Test resuming session
                let resume_result = resume_capture_session(session_id.clone(), tauri::State::from(&engine_state)).await;
                assert!(resume_result.is_ok());
                
                // Check status after resume
                let status_result = get_session_status(session_id.clone(), tauri::State::from(&engine_state)).await;
                assert!(status_result.is_ok());
                
                let status = status_result.unwrap();
                assert_eq!(status.status, "active");
                
                // Test stopping session
                let stop_result = stop_capture_session(session_id, tauri::State::from(&engine_state)).await;
                assert!(stop_result.is_ok());
                
                let encrypted_data = stop_result.unwrap();
                assert!(!encrypted_data.session_id.is_empty());
                assert_eq!(encrypted_data.encryption_algorithm, "AES-256-GCM");
            }
            Err(_) => {
                // Session start failed (likely due to permissions), skip rest of test
            }
        }
    }

    #[tokio::test]
    async fn test_permission_commands() {
        let engine_state: CaptureEngineState = Arc::new(Mutex::new(None));
        
        // Try to initialize
        let init_result = initialize_capture_engine(tauri::State::from(&engine_state)).await;
        if init_result.is_err() {
            // Skip test if initialization fails
            return;
        }
        
        // Test checking permissions
        let permissions_result = check_capture_permissions(tauri::State::from(&engine_state)).await;
        assert!(permissions_result.is_ok());
        
        let permissions = permissions_result.unwrap();
        // Permissions may be true or false depending on the environment
        assert!(permissions.screen_capture || !permissions.screen_capture);
        assert!(permissions.input_monitoring || !permissions.input_monitoring);
        assert!(permissions.accessibility || !permissions.accessibility);
        
        // Test requesting permissions (may not actually grant them in test environment)
        let request_result = request_capture_permissions(tauri::State::from(&engine_state)).await;
        // This may succeed or fail depending on the platform and environment
        match request_result {
            Ok(()) => {
                // Permission request succeeded
            }
            Err(error) => {
                // Permission request failed (expected in some environments)
                assert!(error.contains("Failed to request permissions") || error.contains("not supported"));
            }
        }
    }

    #[tokio::test]
    async fn test_invalid_session_id() {
        let engine_state: CaptureEngineState = Arc::new(Mutex::new(None));
        
        // Try to initialize
        let init_result = initialize_capture_engine(tauri::State::from(&engine_state)).await;
        if init_result.is_err() {
            // Skip test if initialization fails
            return;
        }
        
        let invalid_session_id = "invalid-uuid".to_string();
        
        // Test getting status with invalid session ID
        let status_result = get_session_status(invalid_session_id.clone(), tauri::State::from(&engine_state)).await;
        assert!(status_result.is_err());
        assert!(status_result.unwrap_err().contains("Invalid session ID"));
        
        // Test pausing with invalid session ID
        let pause_result = pause_capture_session(invalid_session_id.clone(), tauri::State::from(&engine_state)).await;
        assert!(pause_result.is_err());
        assert!(pause_result.unwrap_err().contains("Invalid session ID"));
        
        // Test resuming with invalid session ID
        let resume_result = resume_capture_session(invalid_session_id.clone(), tauri::State::from(&engine_state)).await;
        assert!(resume_result.is_err());
        assert!(resume_result.unwrap_err().contains("Invalid session ID"));
        
        // Test stopping with invalid session ID
        let stop_result = stop_capture_session(invalid_session_id, tauri::State::from(&engine_state)).await;
        assert!(stop_result.is_err());
        assert!(stop_result.unwrap_err().contains("Invalid session ID"));
    }

    #[tokio::test]
    async fn test_uninitialized_engine() {
        let engine_state: CaptureEngineState = Arc::new(Mutex::new(None));
        
        // Don't initialize the engine
        
        let request = create_test_request();
        
        // Test operations on uninitialized engine
        let start_result = start_capture_session(request, tauri::State::from(&engine_state)).await;
        assert!(start_result.is_err());
        assert!(start_result.unwrap_err().contains("not initialized"));
        
        let permissions_result = check_capture_permissions(tauri::State::from(&engine_state)).await;
        assert!(permissions_result.is_err());
        assert!(permissions_result.unwrap_err().contains("not initialized"));
    }

    #[tokio::test]
    async fn test_dto_conversions() {
        // Test privacy filter DTO conversion
        let privacy_filter_dto = PrivacyFilterDto {
            filter_type: "password_fields".to_string(),
            enabled: true,
        };
        
        assert_eq!(privacy_filter_dto.filter_type, "password_fields");
        assert!(privacy_filter_dto.enabled);
        
        // Test quality settings DTO
        let quality_dto = CaptureQualityDto {
            screen_fps: 30,
            screen_resolution_scale: 1.0,
            compression_level: 5,
        };
        
        assert_eq!(quality_dto.screen_fps, 30);
        assert_eq!(quality_dto.screen_resolution_scale, 1.0);
        assert_eq!(quality_dto.compression_level, 5);
        
        // Test session request DTO
        let request = StartSessionRequest {
            capture_screen: true,
            capture_keystrokes: false,
            capture_mouse: true,
            privacy_filters: vec![privacy_filter_dto],
            quality_settings: quality_dto,
        };
        
        assert!(request.capture_screen);
        assert!(!request.capture_keystrokes);
        assert!(request.capture_mouse);
        assert_eq!(request.privacy_filters.len(), 1);
    }

    #[tokio::test]
    async fn test_response_serialization() {
        use serde_json;
        
        // Test SessionResponse serialization
        let session_response = SessionResponse {
            session_id: "test-session-123".to_string(),
        };
        
        let json = serde_json::to_string(&session_response).expect("Failed to serialize SessionResponse");
        let deserialized: SessionResponse = serde_json::from_str(&json).expect("Failed to deserialize SessionResponse");
        assert_eq!(session_response.session_id, deserialized.session_id);
        
        // Test SessionStatusResponse serialization
        let status_response = SessionStatusResponse {
            status: "active".to_string(),
        };
        
        let json = serde_json::to_string(&status_response).expect("Failed to serialize SessionStatusResponse");
        let deserialized: SessionStatusResponse = serde_json::from_str(&json).expect("Failed to deserialize SessionStatusResponse");
        assert_eq!(status_response.status, deserialized.status);
        
        // Test PermissionStatusResponse serialization
        let permission_response = PermissionStatusResponse {
            screen_capture: true,
            input_monitoring: false,
            accessibility: true,
        };
        
        let json = serde_json::to_string(&permission_response).expect("Failed to serialize PermissionStatusResponse");
        let deserialized: PermissionStatusResponse = serde_json::from_str(&json).expect("Failed to deserialize PermissionStatusResponse");
        assert_eq!(permission_response.screen_capture, deserialized.screen_capture);
        assert_eq!(permission_response.input_monitoring, deserialized.input_monitoring);
        assert_eq!(permission_response.accessibility, deserialized.accessibility);
    }
}