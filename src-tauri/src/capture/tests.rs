#[cfg(test)]
mod tests {
    use super::*;
    use crate::capture::types::*;
    use crate::capture::engine::CaptureEngine;
    use crate::capture::timestamp::TimestampService;
    use crate::capture::encryption::CaptureEncryption;
    use crate::crypto::keys::KeyManager;
    use crate::crypto::signatures::SignatureManager;
    use crate::crypto::encryption::EncryptionManager;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_session_id_generation() {
        let id1 = SessionId::new();
        let id2 = SessionId::new();
        
        assert_ne!(id1.0, id2.0);
    }

    #[tokio::test]
    async fn test_capture_quality_defaults() {
        let quality = CaptureQuality::default();
        
        assert_eq!(quality.screen_fps, 30);
        assert_eq!(quality.screen_resolution_scale, 1.0);
        assert_eq!(quality.compression_level, 5);
    }

    #[tokio::test]
    async fn test_privacy_filter_creation() {
        let filter = PrivacyFilter {
            filter_type: PrivacyFilterType::PasswordFields,
            enabled: true,
        };
        
        assert!(filter.enabled);
        assert!(matches!(filter.filter_type, PrivacyFilterType::PasswordFields));
    }

    #[tokio::test]
    async fn test_capture_event_creation() {
        let session_id = SessionId::new();
        let event = CaptureEvent {
            id: Uuid::new_v4(),
            session_id: session_id.clone(),
            timestamp: std::time::SystemTime::now(),
            event_type: CaptureEventType::SessionMarker {
                marker_type: SessionMarkerType::Start,
                metadata: Some("test".to_string()),
            },
            signature: vec![1, 2, 3, 4],
        };
        
        assert_eq!(event.session_id.0, session_id.0);
        assert!(!event.signature.is_empty());
    }

    #[tokio::test]
    async fn test_mouse_event_types() {
        let move_event = CaptureEventType::MouseEvent {
            x: 100,
            y: 200,
            button: None,
            event_type: MouseEventType::Move,
        };
        
        let click_event = CaptureEventType::MouseEvent {
            x: 100,
            y: 200,
            button: Some(MouseButton::Left),
            event_type: MouseEventType::Press,
        };
        
        let scroll_event = CaptureEventType::MouseEvent {
            x: 0,
            y: 0,
            button: None,
            event_type: MouseEventType::Scroll { delta_x: 0, delta_y: -3 },
        };
        
        match move_event {
            CaptureEventType::MouseEvent { x, y, button, event_type } => {
                assert_eq!(x, 100);
                assert_eq!(y, 200);
                assert!(button.is_none());
                assert!(matches!(event_type, MouseEventType::Move));
            }
            _ => panic!("Expected MouseEvent"),
        }
        
        match click_event {
            CaptureEventType::MouseEvent { button, event_type, .. } => {
                assert!(matches!(button, Some(MouseButton::Left)));
                assert!(matches!(event_type, MouseEventType::Press));
            }
            _ => panic!("Expected MouseEvent"),
        }
        
        match scroll_event {
            CaptureEventType::MouseEvent { event_type, .. } => {
                if let MouseEventType::Scroll { delta_x, delta_y } = event_type {
                    assert_eq!(delta_x, 0);
                    assert_eq!(delta_y, -3);
                } else {
                    panic!("Expected scroll event");
                }
            }
            _ => panic!("Expected MouseEvent"),
        }
    }

    #[tokio::test]
    async fn test_keyboard_event_creation() {
        let event = CaptureEventType::KeyboardEvent {
            key_code: 65, // 'A' key
            key_name: "A".to_string(),
            is_pressed: true,
            modifiers: vec!["Ctrl".to_string(), "Shift".to_string()],
        };
        
        match event {
            CaptureEventType::KeyboardEvent { key_code, key_name, is_pressed, modifiers } => {
                assert_eq!(key_code, 65);
                assert_eq!(key_name, "A");
                assert!(is_pressed);
                assert_eq!(modifiers.len(), 2);
                assert!(modifiers.contains(&"Ctrl".to_string()));
                assert!(modifiers.contains(&"Shift".to_string()));
            }
            _ => panic!("Expected KeyboardEvent"),
        }
    }

    #[tokio::test]
    async fn test_screen_capture_event() {
        let image_data = vec![255, 0, 0, 255]; // Red pixel in RGBA
        let event = CaptureEventType::ScreenCapture {
            image_data: image_data.clone(),
            width: 1,
            height: 1,
        };
        
        match event {
            CaptureEventType::ScreenCapture { image_data: data, width, height } => {
                assert_eq!(data, image_data);
                assert_eq!(width, 1);
                assert_eq!(height, 1);
            }
            _ => panic!("Expected ScreenCapture"),
        }
    }

    #[tokio::test]
    async fn test_session_config_validation() {
        let valid_config = SessionConfig {
            capture_screen: true,
            capture_keystrokes: true,
            capture_mouse: false,
            privacy_filters: vec![
                PrivacyFilter {
                    filter_type: PrivacyFilterType::PasswordFields,
                    enabled: true,
                }
            ],
            quality_settings: CaptureQuality::default(),
        };
        
        // Test that config can be serialized/deserialized
        let serialized = serde_json::to_string(&valid_config).expect("Failed to serialize config");
        let deserialized: SessionConfig = serde_json::from_str(&serialized).expect("Failed to deserialize config");
        
        assert_eq!(valid_config.capture_screen, deserialized.capture_screen);
        assert_eq!(valid_config.capture_keystrokes, deserialized.capture_keystrokes);
        assert_eq!(valid_config.capture_mouse, deserialized.capture_mouse);
        assert_eq!(valid_config.privacy_filters.len(), deserialized.privacy_filters.len());
    }

    #[tokio::test]
    async fn test_error_types() {
        let permission_error = CaptureError::PermissionDenied("Test permission error".to_string());
        let hardware_error = CaptureError::HardwareError("Test hardware error".to_string());
        let encryption_error = CaptureError::EncryptionError("Test encryption error".to_string());
        
        assert!(matches!(permission_error, CaptureError::PermissionDenied(_)));
        assert!(matches!(hardware_error, CaptureError::HardwareError(_)));
        assert!(matches!(encryption_error, CaptureError::EncryptionError(_)));
        
        // Test error display
        assert!(permission_error.to_string().contains("Permission denied"));
        assert!(hardware_error.to_string().contains("Hardware error"));
        assert!(encryption_error.to_string().contains("Encryption error"));
    }

    #[tokio::test]
    async fn test_session_status_transitions() {
        let active_status = SessionStatus::Active;
        let paused_status = SessionStatus::Paused;
        let completed_status = SessionStatus::Completed;
        let failed_status = SessionStatus::Failed("Test error".to_string());
        
        // Test serialization
        let active_json = serde_json::to_string(&active_status).expect("Failed to serialize active status");
        let paused_json = serde_json::to_string(&paused_status).expect("Failed to serialize paused status");
        let completed_json = serde_json::to_string(&completed_status).expect("Failed to serialize completed status");
        let failed_json = serde_json::to_string(&failed_status).expect("Failed to serialize failed status");
        
        // Test deserialization
        let _: SessionStatus = serde_json::from_str(&active_json).expect("Failed to deserialize active status");
        let _: SessionStatus = serde_json::from_str(&paused_json).expect("Failed to deserialize paused status");
        let _: SessionStatus = serde_json::from_str(&completed_json).expect("Failed to deserialize completed status");
        let _: SessionStatus = serde_json::from_str(&failed_json).expect("Failed to deserialize failed status");
    }

    #[tokio::test]
    async fn test_encryption_metadata() {
        let metadata = EncryptionMetadata {
            algorithm: "AES-256-GCM".to_string(),
            key_id: "test_key_123".to_string(),
            nonce: vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
            created_at: std::time::SystemTime::now(),
        };
        
        assert_eq!(metadata.algorithm, "AES-256-GCM");
        assert_eq!(metadata.key_id, "test_key_123");
        assert_eq!(metadata.nonce.len(), 12);
        
        // Test serialization
        let serialized = serde_json::to_string(&metadata).expect("Failed to serialize metadata");
        let deserialized: EncryptionMetadata = serde_json::from_str(&serialized).expect("Failed to deserialize metadata");
        
        assert_eq!(metadata.algorithm, deserialized.algorithm);
        assert_eq!(metadata.key_id, deserialized.key_id);
        assert_eq!(metadata.nonce, deserialized.nonce);
    }

    // Integration test for the full capture engine (may fail without proper permissions)
    #[tokio::test]
    async fn test_capture_engine_integration() {
        // This test may fail in CI environments without proper permissions
        // We'll make it conditional on successful initialization
        
        let engine_result = CaptureEngine::new().await;
        if engine_result.is_err() {
            // Skip test if engine creation fails (likely due to missing dependencies or permissions)
            return;
        }
        
        let mut engine = engine_result.unwrap();
        
        // Try to initialize - may fail without permissions
        if engine.initialize().await.is_err() {
            // Skip test if initialization fails
            return;
        }
        
        // Test permission checking
        let permissions = engine.check_permissions().await;
        assert!(permissions.is_ok());
        
        // Create a minimal test config that doesn't require actual capture
        let config = SessionConfig {
            capture_screen: false,
            capture_keystrokes: false,
            capture_mouse: false,
            privacy_filters: vec![],
            quality_settings: CaptureQuality {
                screen_fps: 1,
                screen_resolution_scale: 0.1,
                compression_level: 9,
            },
        };
        
        // Test session lifecycle
        let session_id = engine.start_session(config).await;
        if session_id.is_ok() {
            let session_id = session_id.unwrap();
            
            // Check status
            let status = engine.get_session_status(session_id.clone()).await;
            assert!(status.is_ok());
            
            // Stop session
            let encrypted_data = engine.stop_session(session_id).await;
            assert!(encrypted_data.is_ok());
        }
    }
}