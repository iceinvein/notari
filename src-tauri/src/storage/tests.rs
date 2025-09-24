#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::CryptoManager;
    use crate::storage::{Database, SessionStore, SessionConfig, SessionStatus};
    use tempfile::tempdir;
    use tokio;

    async fn setup_test_store() -> (SessionStore, String) {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db").to_string_lossy().to_string();
        
        let database = Database::new(&db_path).await.unwrap();
        let crypto_manager = CryptoManager::new().unwrap();
        let store = SessionStore::new(database, crypto_manager);
        
        (store, db_path)
    }

    #[tokio::test]
    async fn test_create_session() {
        let (store, _) = setup_test_store().await;
        
        let config = SessionConfig {
            capture_screen: true,
            capture_keystrokes: true,
            capture_mouse: false,
            privacy_filters: vec!["password".to_string()],
            quality_settings: "high".to_string(),
        };

        let session = store.create_session("test_user", config.clone()).await.unwrap();
        
        assert_eq!(session.user_id, "test_user");
        assert_eq!(session.status, SessionStatus::Active);
        assert_eq!(session.capture_config.capture_screen, true);
        assert_eq!(session.capture_config.capture_keystrokes, true);
        assert_eq!(session.capture_config.capture_mouse, false);
    }

    #[tokio::test]
    async fn test_get_session() {
        let (store, _) = setup_test_store().await;
        
        let config = SessionConfig {
            capture_screen: true,
            capture_keystrokes: false,
            capture_mouse: true,
            privacy_filters: vec![],
            quality_settings: "medium".to_string(),
        };

        let created_session = store.create_session("test_user", config).await.unwrap();
        let retrieved_session = store.get_session(&created_session.id).await.unwrap();
        
        assert!(retrieved_session.is_some());
        let session = retrieved_session.unwrap();
        assert_eq!(session.id, created_session.id);
        assert_eq!(session.user_id, "test_user");
    }

    #[tokio::test]
    async fn test_session_lifecycle() {
        let (store, _) = setup_test_store().await;
        
        let config = SessionConfig {
            capture_screen: true,
            capture_keystrokes: true,
            capture_mouse: true,
            privacy_filters: vec![],
            quality_settings: "high".to_string(),
        };

        // Create session
        let session = store.create_session("test_user", config).await.unwrap();
        assert_eq!(session.status, SessionStatus::Active);

        // Pause session
        store.pause_session(&session.id).await.unwrap();
        let paused_session = store.get_session(&session.id).await.unwrap().unwrap();
        assert_eq!(paused_session.status, SessionStatus::Paused);

        // Resume session
        store.resume_session(&session.id).await.unwrap();
        let resumed_session = store.get_session(&session.id).await.unwrap().unwrap();
        assert_eq!(resumed_session.status, SessionStatus::Active);

        // Stop session
        store.stop_session(&session.id).await.unwrap();
        let stopped_session = store.get_session(&session.id).await.unwrap().unwrap();
        assert_eq!(stopped_session.status, SessionStatus::Completed);
        assert!(stopped_session.end_time.is_some());
    }

    #[tokio::test]
    async fn test_fail_session() {
        let (store, _) = setup_test_store().await;
        
        let config = SessionConfig {
            capture_screen: true,
            capture_keystrokes: true,
            capture_mouse: true,
            privacy_filters: vec![],
            quality_settings: "high".to_string(),
        };

        let session = store.create_session("test_user", config).await.unwrap();
        
        store.fail_session(&session.id, "Test failure reason").await.unwrap();
        let failed_session = store.get_session(&session.id).await.unwrap().unwrap();
        
        assert_eq!(failed_session.status, SessionStatus::Failed);
        assert!(failed_session.end_time.is_some());
    }

    #[tokio::test]
    async fn test_store_and_verify_session_data() {
        let (store, _) = setup_test_store().await;
        
        let config = SessionConfig {
            capture_screen: true,
            capture_keystrokes: true,
            capture_mouse: true,
            privacy_filters: vec![],
            quality_settings: "high".to_string(),
        };

        let session = store.create_session("test_user", config).await.unwrap();
        let test_data = b"test session data";
        
        let temp_dir = tempdir().unwrap();
        let file_path = temp_dir.path().join("session_data.enc").to_string_lossy().to_string();
        
        // Store encrypted data
        let hash = store.store_encrypted_session_data(&session.id, test_data, &file_path).await.unwrap();
        assert!(!hash.is_empty());

        // Verify integrity
        let is_valid = store.verify_session_integrity(&session.id).await.unwrap();
        assert!(is_valid);
    }

    #[tokio::test]
    async fn test_mark_session_tampered() {
        let (store, _) = setup_test_store().await;
        
        let config = SessionConfig {
            capture_screen: true,
            capture_keystrokes: true,
            capture_mouse: true,
            privacy_filters: vec![],
            quality_settings: "high".to_string(),
        };

        let session = store.create_session("test_user", config).await.unwrap();
        
        store.mark_session_tampered(&session.id, "File modified externally").await.unwrap();
        let tampered_session = store.get_session(&session.id).await.unwrap().unwrap();
        
        assert!(tampered_session.tamper_evidence.is_some());
        assert_eq!(tampered_session.tamper_evidence.unwrap(), "File modified externally");
    }

    #[tokio::test]
    async fn test_get_user_sessions() {
        let (store, _) = setup_test_store().await;
        
        let config = SessionConfig {
            capture_screen: true,
            capture_keystrokes: true,
            capture_mouse: true,
            privacy_filters: vec![],
            quality_settings: "high".to_string(),
        };

        // Create multiple sessions
        let _session1 = store.create_session("test_user", config.clone()).await.unwrap();
        let _session2 = store.create_session("test_user", config.clone()).await.unwrap();
        let _session3 = store.create_session("other_user", config.clone()).await.unwrap();

        let user_sessions = store.get_user_sessions("test_user", None).await.unwrap();
        assert_eq!(user_sessions.len(), 2);

        let limited_sessions = store.get_user_sessions("test_user", Some(1)).await.unwrap();
        assert_eq!(limited_sessions.len(), 1);
    }

    #[tokio::test]
    async fn test_session_integrity_logs() {
        let (store, _) = setup_test_store().await;
        
        let config = SessionConfig {
            capture_screen: true,
            capture_keystrokes: true,
            capture_mouse: true,
            privacy_filters: vec![],
            quality_settings: "high".to_string(),
        };

        let session = store.create_session("test_user", config).await.unwrap();
        
        // Perform some operations that generate logs
        store.pause_session(&session.id).await.unwrap();
        store.resume_session(&session.id).await.unwrap();
        store.stop_session(&session.id).await.unwrap();

        let logs = store.get_session_integrity_logs(&session.id).await.unwrap();
        
        // Should have logs for: creation, pause, resume, stop
        assert!(logs.len() >= 4);
        
        // Check that logs are in chronological order
        for i in 1..logs.len() {
            assert!(logs[i].timestamp >= logs[i-1].timestamp);
        }
    }
}