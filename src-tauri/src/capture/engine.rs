use crate::capture::types::*;
use crate::capture::platform::{create_platform_capture, PlatformCapture};
use crate::capture::timestamp::{TimestampService, CryptographicTimestamp};
use crate::capture::encryption::{CaptureEncryption, StreamEncryptor, EncryptedEventBatch};
use crate::crypto::keys::KeyManager;
use crate::crypto::signatures::SignatureManager;
use crate::crypto::encryption::EncryptionManager;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::{mpsc, RwLock};
use uuid::Uuid;

pub struct CaptureEngine {
    platform_capture: Box<dyn PlatformCapture>,
    timestamp_service: Arc<TimestampService>,
    encryption_service: Arc<CaptureEncryption>,
    active_sessions: Arc<RwLock<HashMap<SessionId, ActiveSession>>>,
    event_processor: Option<tokio::task::JoinHandle<()>>,
    is_initialized: bool,
}

struct ActiveSession {
    id: SessionId,
    config: SessionConfig,
    status: SessionStatus,
    stream_encryptor: StreamEncryptor,
    encrypted_batches: Vec<EncryptedEventBatch>,
    timestamps: Vec<CryptographicTimestamp>,
    start_time: std::time::SystemTime,
    pause_time: Option<std::time::SystemTime>,
}

impl CaptureEngine {
    pub async fn new() -> CaptureResult<Self> {
        // Create platform-specific capture implementation
        let platform_capture = create_platform_capture()?;

        // Initialize cryptographic services
        let key_manager = KeyManager::new();
        let signature_manager = SignatureManager::new();
        let encryption_manager = EncryptionManager::new();
        
        // Create services
        let session_id = SessionId::new();
        let timestamp_service = Arc::new(TimestampService::new(signature_manager, session_id.0));
        let encryption_service = Arc::new(CaptureEncryption::new(encryption_manager, "default_key".to_string()));

        Ok(Self {
            platform_capture,
            timestamp_service,
            encryption_service,
            active_sessions: Arc::new(RwLock::new(HashMap::new())),
            event_processor: None,
            is_initialized: false,
        })
    }

    pub async fn initialize(&mut self) -> CaptureResult<()> {
        if self.is_initialized {
            return Ok(());
        }

        // Initialize platform capture
        self.platform_capture.initialize().await?;

        // Start event processing loop
        self.start_event_processor().await?;

        self.is_initialized = true;
        Ok(())
    }

    pub async fn start_session(&mut self, config: SessionConfig) -> CaptureResult<SessionId> {
        if !self.is_initialized {
            return Err(CaptureError::InvalidSessionState {
                expected: "initialized".to_string(),
                actual: "not initialized".to_string(),
            });
        }

        let session_id = SessionId::new();
        
        // Generate start timestamp
        let start_timestamp = self.timestamp_service.generate_timestamp()?;
        
        // Create stream encryptor for this session
        let stream_encryptor = self.encryption_service.create_stream_encryptor();

        // Create active session
        let active_session = ActiveSession {
            id: session_id.clone(),
            config: config.clone(),
            status: SessionStatus::Active,
            stream_encryptor,
            encrypted_batches: Vec::new(),
            timestamps: vec![start_timestamp],
            start_time: std::time::SystemTime::now(),
            pause_time: None,
        };

        // Add to active sessions
        {
            let mut sessions = self.active_sessions.write().await;
            sessions.insert(session_id.clone(), active_session);
        }

        // Start platform capture based on config
        if config.capture_screen {
            self.platform_capture.start_screen_capture(&config.quality_settings).await?;
        }

        if config.capture_keystrokes || config.capture_mouse {
            self.platform_capture.start_input_monitoring(&config.privacy_filters).await?;
        }

        // Generate session start marker
        let start_event = CaptureEvent {
            id: Uuid::new_v4(),
            session_id: session_id.clone(),
            timestamp: std::time::SystemTime::now(),
            event_type: CaptureEventType::SessionMarker {
                marker_type: SessionMarkerType::Start,
                metadata: Some(serde_json::to_string(&config).unwrap_or_default()),
            },
            signature: vec![], // Will be signed by event processor
        };

        self.process_capture_event(start_event).await?;

        Ok(session_id)
    }

    pub async fn stop_session(&mut self, session_id: SessionId) -> CaptureResult<EncryptedSessionData> {
        // Generate stop timestamp
        let stop_timestamp = self.timestamp_service.generate_timestamp()?;

        // Generate session stop marker
        let stop_event = CaptureEvent {
            id: Uuid::new_v4(),
            session_id: session_id.clone(),
            timestamp: std::time::SystemTime::now(),
            event_type: CaptureEventType::SessionMarker {
                marker_type: SessionMarkerType::Stop,
                metadata: None,
            },
            signature: vec![],
        };

        self.process_capture_event(stop_event).await?;

        // Remove session and get final data
        let mut session = {
            let mut sessions = self.active_sessions.write().await;
            sessions.remove(&session_id)
                .ok_or_else(|| CaptureError::SessionNotFound(session_id.clone()))?
        };

        // Add stop timestamp
        session.timestamps.push(stop_timestamp);

        // Flush any remaining events in the stream encryptor
        if let Some(final_batch) = session.stream_encryptor.flush_batch()? {
            session.encrypted_batches.push(final_batch);
        }

        // Update session status
        session.status = SessionStatus::Completed;

        // Stop platform capture if no other active sessions
        {
            let sessions = self.active_sessions.read().await;
            if sessions.is_empty() {
                self.platform_capture.stop_screen_capture().await?;
                self.platform_capture.stop_input_monitoring().await?;
            }
        }

        // Create final encrypted session data
        let encrypted_session = self.encryption_service
            .create_encrypted_session(session.encrypted_batches, session_id)?;

        Ok(encrypted_session)
    }

    pub async fn pause_session(&mut self, session_id: SessionId) -> CaptureResult<()> {
        let mut sessions = self.active_sessions.write().await;
        let session = sessions.get_mut(&session_id)
            .ok_or_else(|| CaptureError::SessionNotFound(session_id.clone()))?;

        if !matches!(session.status, SessionStatus::Active) {
            return Err(CaptureError::InvalidSessionState {
                expected: "active".to_string(),
                actual: format!("{:?}", session.status),
            });
        }

        session.status = SessionStatus::Paused;
        session.pause_time = Some(std::time::SystemTime::now());

        // Generate pause timestamp and event
        let pause_timestamp = self.timestamp_service.generate_timestamp()?;
        session.timestamps.push(pause_timestamp);

        let pause_event = CaptureEvent {
            id: Uuid::new_v4(),
            session_id: session_id.clone(),
            timestamp: std::time::SystemTime::now(),
            event_type: CaptureEventType::SessionMarker {
                marker_type: SessionMarkerType::Pause,
                metadata: None,
            },
            signature: vec![],
        };

        drop(sessions); // Release lock before processing event
        self.process_capture_event(pause_event).await?;

        Ok(())
    }

    pub async fn resume_session(&mut self, session_id: SessionId) -> CaptureResult<()> {
        let mut sessions = self.active_sessions.write().await;
        let session = sessions.get_mut(&session_id)
            .ok_or_else(|| CaptureError::SessionNotFound(session_id.clone()))?;

        if !matches!(session.status, SessionStatus::Paused) {
            return Err(CaptureError::InvalidSessionState {
                expected: "paused".to_string(),
                actual: format!("{:?}", session.status),
            });
        }

        session.status = SessionStatus::Active;
        session.pause_time = None;

        // Generate resume timestamp and event
        let resume_timestamp = self.timestamp_service.generate_timestamp()?;
        session.timestamps.push(resume_timestamp);

        let resume_event = CaptureEvent {
            id: Uuid::new_v4(),
            session_id: session_id.clone(),
            timestamp: std::time::SystemTime::now(),
            event_type: CaptureEventType::SessionMarker {
                marker_type: SessionMarkerType::Resume,
                metadata: None,
            },
            signature: vec![],
        };

        drop(sessions); // Release lock before processing event
        self.process_capture_event(resume_event).await?;

        Ok(())
    }

    pub async fn get_session_status(&self, session_id: SessionId) -> CaptureResult<SessionStatus> {
        let sessions = self.active_sessions.read().await;
        let session = sessions.get(&session_id)
            .ok_or_else(|| CaptureError::SessionNotFound(session_id))?;
        
        Ok(session.status.clone())
    }

    async fn start_event_processor(&mut self) -> CaptureResult<()> {
        let (tx, mut rx) = mpsc::unbounded_channel::<CaptureEvent>();
        let active_sessions = Arc::clone(&self.active_sessions);
        let timestamp_service = Arc::clone(&self.timestamp_service);

        let handle = tokio::spawn(async move {
            while let Some(mut event) = rx.recv().await {
                // Generate timestamp for the event
                if let Ok(timestamp) = timestamp_service.generate_timestamp() {
                    event.timestamp = timestamp.system_time;
                    
                    // Sign the event (simplified - would use proper signing)
                    event.signature = vec![1, 2, 3, 4]; // Placeholder signature
                }

                // Process the event for the appropriate session
                let mut sessions = active_sessions.write().await;
                if let Some(session) = sessions.get_mut(&event.session_id) {
                    // Add event to stream encryptor
                    if let Ok(Some(batch)) = session.stream_encryptor.add_event(event) {
                        session.encrypted_batches.push(batch);
                    }
                }
            }
        });

        self.event_processor = Some(handle);
        Ok(())
    }

    async fn process_capture_event(&self, event: CaptureEvent) -> CaptureResult<()> {
        // This would send the event to the event processor
        // For now, we'll process it directly
        let mut sessions = self.active_sessions.write().await;
        if let Some(session) = sessions.get_mut(&event.session_id) {
            if let Some(batch) = session.stream_encryptor.add_event(event)? {
                session.encrypted_batches.push(batch);
            }
        }
        Ok(())
    }

    pub async fn check_permissions(&self) -> CaptureResult<crate::capture::platform::PermissionStatus> {
        self.platform_capture.check_permissions().await
    }

    pub async fn request_permissions(&self) -> CaptureResult<()> {
        self.platform_capture.request_permissions().await
    }
}

impl Drop for CaptureEngine {
    fn drop(&mut self) {
        if let Some(handle) = self.event_processor.take() {
            handle.abort();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_capture_engine_creation() {
        let engine = CaptureEngine::new().await;
        assert!(engine.is_ok());
    }

    #[tokio::test]
    async fn test_session_lifecycle() {
        let mut engine = CaptureEngine::new().await.expect("Failed to create engine");
        
        // Note: This test may fail on CI without proper permissions
        if engine.initialize().await.is_err() {
            return; // Skip test if initialization fails (likely due to permissions)
        }

        let config = SessionConfig {
            capture_screen: false, // Disable screen capture for testing
            capture_keystrokes: false, // Disable input capture for testing
            capture_mouse: false,
            privacy_filters: vec![],
            quality_settings: CaptureQuality::default(),
        };

        let session_id = engine.start_session(config).await.expect("Failed to start session");
        
        let status = engine.get_session_status(session_id.clone()).await.expect("Failed to get status");
        assert!(matches!(status, SessionStatus::Active));

        engine.pause_session(session_id.clone()).await.expect("Failed to pause session");
        
        let status = engine.get_session_status(session_id.clone()).await.expect("Failed to get status");
        assert!(matches!(status, SessionStatus::Paused));

        engine.resume_session(session_id.clone()).await.expect("Failed to resume session");
        
        let status = engine.get_session_status(session_id.clone()).await.expect("Failed to get status");
        assert!(matches!(status, SessionStatus::Active));

        let _encrypted_data = engine.stop_session(session_id).await.expect("Failed to stop session");
    }
}