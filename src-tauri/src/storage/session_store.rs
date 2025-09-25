use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;
use crate::crypto::{CryptoManager, EncryptedData};
use crate::storage::Database;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum SessionError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("Crypto error: {0}")]
    Crypto(String),
    #[error("IO error: {0}")]
    Io(#[from] tokio::io::Error),
    #[error("Session not found: {0}")]
    NotFound(String),
    #[error("Invalid status: {0}")]
    InvalidStatus(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionConfig {
    pub capture_screen: bool,
    pub capture_keystrokes: bool,
    pub capture_mouse: bool,
    pub privacy_filters: Vec<String>,
    pub quality_settings: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SessionStatus {
    Active,
    Paused,
    Completed,
    Failed,
}

impl SessionStatus {
    pub fn as_str(&self) -> &'static str {
        match self {
            SessionStatus::Active => "active",
            SessionStatus::Paused => "paused",
            SessionStatus::Completed => "completed",
            SessionStatus::Failed => "failed",
        }
    }

    pub fn from_str(s: &str) -> Result<Self, String> {
        match s {
            "active" => Ok(SessionStatus::Active),
            "paused" => Ok(SessionStatus::Paused),
            "completed" => Ok(SessionStatus::Completed),
            "failed" => Ok(SessionStatus::Failed),
            _ => Err(format!("Invalid session status: {}", s)),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkSession {
    pub id: String,
    pub user_id: String,
    pub start_time: i64,
    pub end_time: Option<i64>,
    pub status: SessionStatus,
    pub capture_config: SessionConfig,
    pub encrypted_data_path: Option<String>,
    pub integrity_hash: Option<String>,
    pub tamper_evidence: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SessionIntegrityLog {
    pub id: Option<i64>,
    pub session_id: String,
    pub event_type: String,
    pub event_data: Option<String>,
    pub timestamp: i64,
    pub signature: Option<String>,
}

pub struct SessionStore {
    database: Database,
    crypto_manager: CryptoManager,
}

impl SessionStore {
    pub fn new(database: Database, crypto_manager: CryptoManager) -> Self {
        Self {
            database,
            crypto_manager,
        }
    }

    pub async fn create_session(
        &self,
        user_id: &str,
        config: SessionConfig,
    ) -> Result<WorkSession, SessionError> {
        let session_id = Uuid::new_v4().to_string();
        let now = Utc::now().timestamp_millis();

        let session = WorkSession {
            id: session_id.clone(),
            user_id: user_id.to_string(),
            start_time: now,
            end_time: None,
            status: SessionStatus::Active,
            capture_config: config.clone(),
            encrypted_data_path: None,
            integrity_hash: None,
            tamper_evidence: None,
            created_at: now,
            updated_at: now,
        };

        let config_json = serde_json::to_string(&config)?;

        sqlx::query(
            r#"
            INSERT INTO sessions (
                id, user_id, start_time, end_time, status, capture_config,
                encrypted_data_path, integrity_hash, tamper_evidence, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(&session.id)
        .bind(&session.user_id)
        .bind(session.start_time)
        .bind(session.end_time)
        .bind(session.status.as_str())
        .bind(config_json)
        .bind(&session.encrypted_data_path)
        .bind(&session.integrity_hash)
        .bind(&session.tamper_evidence)
        .bind(session.created_at)
        .bind(session.updated_at)
        .execute(self.database.get_pool())
        .await?;

        // Log session creation
        self.log_integrity_event(
            &session_id,
            "session_created",
            Some(&format!("Session created with config: {:?}", config)),
        ).await?;

        Ok(session)
    }

    pub async fn get_session(&self, session_id: &str) -> Result<Option<WorkSession>, SessionError> {
        let row = sqlx::query(
            r#"
            SELECT id, user_id, start_time, end_time, status, capture_config,
                   encrypted_data_path, integrity_hash, tamper_evidence, created_at, updated_at
            FROM sessions WHERE id = ?
            "#,
        )
        .bind(session_id)
        .fetch_optional(self.database.get_pool())
        .await?;

        if let Some(row) = row {
            let config_json: String = row.get("capture_config");
            let config: SessionConfig = serde_json::from_str(&config_json)?;
            let status = SessionStatus::from_str(row.get("status"))?;

            Ok(Some(WorkSession {
                id: row.get("id"),
                user_id: row.get("user_id"),
                start_time: row.get("start_time"),
                end_time: row.get("end_time"),
                status,
                capture_config: config,
                encrypted_data_path: row.get("encrypted_data_path"),
                integrity_hash: row.get("integrity_hash"),
                tamper_evidence: row.get("tamper_evidence"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            }))
        } else {
            Ok(None)
        }
    }

    pub async fn update_session_status(
        &self,
        session_id: &str,
        status: SessionStatus,
    ) -> Result<(), BoxError> {
        let now = Utc::now().timestamp_millis();
        let end_time = if matches!(status, SessionStatus::Completed | SessionStatus::Failed) {
            Some(now)
        } else {
            None
        };

        sqlx::query(
            "UPDATE sessions SET status = ?, end_time = ?, updated_at = ? WHERE id = ?",
        )
        .bind(status.as_str())
        .bind(end_time)
        .bind(now)
        .bind(session_id)
        .execute(self.database.get_pool())
        .await?;

        // Log status change
        self.log_integrity_event(
            session_id,
            "status_changed",
            Some(&format!("Status changed to: {}", status.as_str())),
        ).await?;

        Ok(())
    }

    pub async fn pause_session(&self, session_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.update_session_status(session_id, SessionStatus::Paused).await
    }

    pub async fn resume_session(&self, session_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.update_session_status(session_id, SessionStatus::Active).await
    }

    pub async fn stop_session(&self, session_id: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.update_session_status(session_id, SessionStatus::Completed).await
    }

    pub async fn fail_session(&self, session_id: &str, reason: &str) -> Result<(), Box<dyn std::error::Error>> {
        self.update_session_status(session_id, SessionStatus::Failed).await?;
        
        // Log failure reason
        self.log_integrity_event(
            session_id,
            "session_failed",
            Some(&format!("Session failed: {}", reason)),
        ).await?;

        Ok(())
    }

    pub async fn store_encrypted_session_data(
        &mut self,
        session_id: &str,
        data: &[u8],
        file_path: &str,
    ) -> Result<String, BoxError> {
        // Encrypt the session data
        let encrypted_data = self.crypto_manager.encrypt_data(data).await?;
        
        // Store encrypted data to file
        tokio::fs::write(file_path, &encrypted_data.data).await?;
        
        // Generate integrity hash
        let integrity_hash = self.crypto_manager.generate_hash(&encrypted_data.data).await?;
        
        // Update session record
        let now = Utc::now().timestamp_millis();
        sqlx::query(
            "UPDATE sessions SET encrypted_data_path = ?, integrity_hash = ?, updated_at = ? WHERE id = ?",
        )
        .bind(file_path)
        .bind(&integrity_hash)
        .bind(now)
        .bind(session_id)
        .execute(self.database.get_pool())
        .await?;

        // Log data storage
        self.log_integrity_event(
            session_id,
            "data_stored",
            Some(&format!("Encrypted data stored at: {}", file_path)),
        ).await?;

        Ok(integrity_hash)
    }

    pub async fn verify_session_integrity(
        &self,
        session_id: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let session = self.get_session(session_id).await?;
        
        if let Some(session) = session {
            if let (Some(data_path), Some(stored_hash)) = (&session.encrypted_data_path, &session.integrity_hash) {
                // Read encrypted data from file
                let encrypted_data = tokio::fs::read(data_path).await?;
                
                // Verify integrity hash
                let computed_hash = self.crypto_manager.generate_hash(&encrypted_data).await?;
                
                let is_valid = computed_hash == *stored_hash;
                
                // Log verification result
                self.log_integrity_event(
                    session_id,
                    "integrity_verified",
                    Some(&format!("Integrity check result: {}", is_valid)),
                ).await?;

                // If integrity check fails, mark as tampered
                if !is_valid {
                    self.mark_session_tampered(session_id, "Integrity hash mismatch").await?;
                }

                Ok(is_valid)
            } else {
                Ok(false) // No data to verify
            }
        } else {
            Err("Session not found".into())
        }
    }

    pub async fn mark_session_tampered(
        &self,
        session_id: &str,
        evidence: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let now = Utc::now().timestamp_millis();
        
        sqlx::query(
            "UPDATE sessions SET tamper_evidence = ?, updated_at = ? WHERE id = ?",
        )
        .bind(evidence)
        .bind(now)
        .bind(session_id)
        .execute(self.database.get_pool())
        .await?;

        // Log tamper detection
        self.log_integrity_event(
            session_id,
            "tamper_detected",
            Some(evidence),
        ).await?;

        Ok(())
    }

    pub async fn get_user_sessions(
        &self,
        user_id: &str,
        limit: Option<i64>,
    ) -> Result<Vec<WorkSession>, Box<dyn std::error::Error>> {
        let query = if let Some(limit) = limit {
            format!(
                r#"
                SELECT id, user_id, start_time, end_time, status, capture_config,
                       encrypted_data_path, integrity_hash, tamper_evidence, created_at, updated_at
                FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT {}
                "#,
                limit
            )
        } else {
            r#"
            SELECT id, user_id, start_time, end_time, status, capture_config,
                   encrypted_data_path, integrity_hash, tamper_evidence, created_at, updated_at
            FROM sessions WHERE user_id = ? ORDER BY created_at DESC
            "#.to_string()
        };

        let rows = sqlx::query(&query)
            .bind(user_id)
            .fetch_all(self.database.get_pool())
            .await?;

        let mut sessions = Vec::new();
        for row in rows {
            let config_json: String = row.get("capture_config");
            let config: SessionConfig = serde_json::from_str(&config_json)?;
            let status = SessionStatus::from_str(row.get("status"))?;

            sessions.push(WorkSession {
                id: row.get("id"),
                user_id: row.get("user_id"),
                start_time: row.get("start_time"),
                end_time: row.get("end_time"),
                status,
                capture_config: config,
                encrypted_data_path: row.get("encrypted_data_path"),
                integrity_hash: row.get("integrity_hash"),
                tamper_evidence: row.get("tamper_evidence"),
                created_at: row.get("created_at"),
                updated_at: row.get("updated_at"),
            });
        }

        Ok(sessions)
    }

    async fn log_integrity_event(
        &self,
        session_id: &str,
        event_type: &str,
        event_data: Option<&str>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let now = Utc::now().timestamp_millis();
        
        // Generate signature for the event
        let event_content = format!("{}:{}:{}", session_id, event_type, event_data.unwrap_or(""));
        let signature = self.crypto_manager.sign_data(event_content.as_bytes()).await?;

        sqlx::query(
            r#"
            INSERT INTO session_integrity_logs (session_id, event_type, event_data, timestamp, signature)
            VALUES (?, ?, ?, ?, ?)
            "#,
        )
        .bind(session_id)
        .bind(event_type)
        .bind(event_data)
        .bind(now)
        .bind(signature)
        .execute(self.database.get_pool())
        .await?;

        Ok(())
    }

    pub async fn get_session_integrity_logs(
        &self,
        session_id: &str,
    ) -> Result<Vec<SessionIntegrityLog>, Box<dyn std::error::Error>> {
        let rows = sqlx::query(
            r#"
            SELECT id, session_id, event_type, event_data, timestamp, signature
            FROM session_integrity_logs WHERE session_id = ? ORDER BY timestamp ASC
            "#,
        )
        .bind(session_id)
        .fetch_all(self.database.get_pool())
        .await?;

        let mut logs = Vec::new();
        for row in rows {
            logs.push(SessionIntegrityLog {
                id: Some(row.get("id")),
                session_id: row.get("session_id"),
                event_type: row.get("event_type"),
                event_data: row.get("event_data"),
                timestamp: row.get("timestamp"),
                signature: row.get("signature"),
            });
        }

        Ok(logs)
    }
}   
 /// Flushes any pending session data to ensure consistency
    pub async fn flush_pending_data(&self) -> Result<(), SessionError> {
        // This is a placeholder implementation
        // In a real implementation, this would:
        // 1. Flush any buffered session data to disk
        // 2. Ensure all pending database transactions are committed
        // 3. Sync any cached data with the database
        
        // For now, we'll just ensure the database connection is healthy
        let _conn = self.database.get_connection();
        
        Ok(())
    }