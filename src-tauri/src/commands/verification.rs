use crate::verification::{
    engine::VerificationEngine,
    analytics::VerificationAnalyticsService,
    types::*,
};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::sync::RwLock;
use uuid::Uuid;

/// State for verification engine
pub struct VerificationState {
    pub engine: Arc<RwLock<Option<VerificationEngine>>>,
    pub analytics: Arc<VerificationAnalyticsService>,
    pub active_verifications: Arc<RwLock<HashMap<String, VerificationStatus>>>,
}

impl Default for VerificationState {
    fn default() -> Self {
        Self {
            engine: Arc::new(RwLock::new(None)),
            analytics: Arc::new(VerificationAnalyticsService::new()),
            active_verifications: Arc::new(RwLock::new(HashMap::new())),
        }
    }
}

/// Initialize the verification engine
#[tauri::command]
pub async fn initialize_verification_engine(
    state: State<'_, VerificationState>,
) -> Result<String, String> {
    let engine = VerificationEngine::new()
        .await
        .map_err(|e| format!("Failed to initialize verification engine: {}", e))?;

    let mut engine_lock = state.engine.write().await;
    *engine_lock = Some(engine);

    Ok("Verification engine initialized successfully".to_string())
}

/// Verify a proof pack
#[tauri::command]
pub async fn verify_proof_pack(
    proof_pack: ProofPackData,
    config: Option<VerificationConfig>,
    verifier_info: VerifierInfo,
    state: State<'_, VerificationState>,
) -> Result<VerificationResultData, String> {
    let engine_lock = state.engine.read().await;
    let engine = engine_lock
        .as_ref()
        .ok_or("Verification engine not initialized")?;

    let request = VerificationRequest {
        proof_pack: proof_pack.clone(),
        config: config.unwrap_or_default(),
        verifier_info: verifier_info.clone(),
    };

    let verification_id = Uuid::new_v4().to_string();

    // Record verification attempt
    if let Err(e) = state.analytics.record_verification_attempt(
        &proof_pack.id,
        &verifier_info,
        None,
    ).await {
        eprintln!("Failed to record verification attempt: {}", e);
    }

    match engine.verify_proof_pack(request).await {
        Ok(result) => {
            // Record successful verification
            if let Err(e) = state.analytics.record_verification(
                &verification_id,
                &proof_pack.id,
                &verifier_info,
                &result,
                result.verification_time,
            ).await {
                eprintln!("Failed to record verification analytics: {}", e);
            }

            Ok(result)
        }
        Err(e) => {
            // Record failed verification
            if let Err(analytics_err) = state.analytics.record_verification_attempt(
                &proof_pack.id,
                &verifier_info,
                Some(&e.to_string()),
            ).await {
                eprintln!("Failed to record failed verification: {}", analytics_err);
            }

            Err(format!("Verification failed: {}", e))
        }
    }
}

/// Batch verify multiple proof packs
#[tauri::command]
pub async fn batch_verify_proof_packs(
    proof_packs: Vec<ProofPackData>,
    config: Option<VerificationConfig>,
    verifier_info: VerifierInfo,
    state: State<'_, VerificationState>,
) -> Result<BatchVerificationResult, String> {
    let engine_lock = state.engine.read().await;
    let engine = engine_lock
        .as_ref()
        .ok_or("Verification engine not initialized")?;

    let request = BatchVerificationRequest {
        proof_packs,
        config: config.unwrap_or_default(),
        verifier_info,
    };

    engine
        .batch_verify(request)
        .await
        .map_err(|e| format!("Batch verification failed: {}", e))
}

/// Start async verification (returns verification ID immediately)
#[tauri::command]
pub async fn start_async_verification(
    proof_pack: ProofPackData,
    config: Option<VerificationConfig>,
    verifier_info: VerifierInfo,
    state: State<'_, VerificationState>,
) -> Result<String, String> {
    let verification_id = Uuid::new_v4().to_string();

    // Set initial status
    {
        let mut active = state.active_verifications.write().await;
        active.insert(verification_id.clone(), VerificationStatus {
            id: verification_id.clone(),
            status: ProcessingStatus::Pending,
            progress: 0.0,
            start_time: chrono::Utc::now().timestamp(),
            end_time: None,
            result: None,
        });
    }

    // Clone necessary data for the async task
    let engine_arc = state.engine.clone();
    let analytics_arc = state.analytics.clone();
    let active_verifications_arc = state.active_verifications.clone();
    let verification_id_clone = verification_id.clone();

    // Start verification in background
    tokio::spawn(async move {
        let engine_lock = engine_arc.read().await;
        if let Some(engine) = engine_lock.as_ref() {
            // Update status to in progress
            {
                let mut active = active_verifications_arc.write().await;
                if let Some(status) = active.get_mut(&verification_id_clone) {
                    status.status = ProcessingStatus::InProgress;
                    status.progress = 10.0;
                }
            }

            let request = VerificationRequest {
                proof_pack: proof_pack.clone(),
                config: config.unwrap_or_default(),
                verifier_info: verifier_info.clone(),
            };

            let start_time = std::time::Instant::now();

            match engine.verify_proof_pack(request).await {
                Ok(result) => {
                    let processing_time = start_time.elapsed().as_millis() as u64;

                    // Update status with result
                    {
                        let mut active = active_verifications_arc.write().await;
                        if let Some(status) = active.get_mut(&verification_id_clone) {
                            status.status = ProcessingStatus::Completed;
                            status.progress = 100.0;
                            status.end_time = Some(chrono::Utc::now().timestamp());
                            status.result = Some(result.clone());
                        }
                    }

                    // Record analytics
                    if let Err(e) = analytics_arc.record_verification(
                        &verification_id_clone,
                        &proof_pack.id,
                        &verifier_info,
                        &result,
                        processing_time,
                    ).await {
                        eprintln!("Failed to record verification analytics: {}", e);
                    }
                }
                Err(e) => {
                    // Update status with error
                    {
                        let mut active = active_verifications_arc.write().await;
                        if let Some(status) = active.get_mut(&verification_id_clone) {
                            status.status = ProcessingStatus::Failed;
                            status.end_time = Some(chrono::Utc::now().timestamp());
                        }
                    }

                    // Record failed attempt
                    if let Err(analytics_err) = analytics_arc.record_verification_attempt(
                        &proof_pack.id,
                        &verifier_info,
                        Some(&e.to_string()),
                    ).await {
                        eprintln!("Failed to record failed verification: {}", analytics_err);
                    }
                }
            }
        }
    });

    Ok(verification_id)
}

/// Get verification status
#[tauri::command]
pub async fn get_verification_status(
    verification_id: String,
    state: State<'_, VerificationState>,
) -> Result<VerificationStatus, String> {
    let active = state.active_verifications.read().await;
    
    active
        .get(&verification_id)
        .cloned()
        .ok_or_else(|| format!("Verification {} not found", verification_id))
}

/// Generate Merkle proof for verification
#[tauri::command]
pub async fn generate_verification_merkle_proof(
    hash: String,
    anchor_id: String,
    state: State<'_, VerificationState>,
) -> Result<crate::blockchain::types::MerkleProof, String> {
    let engine_lock = state.engine.read().await;
    let engine = engine_lock
        .as_ref()
        .ok_or("Verification engine not initialized")?;

    engine
        .generate_merkle_proof(&hash, &anchor_id)
        .await
        .map_err(|e| format!("Failed to generate Merkle proof: {}", e))
}

/// Get verification analytics for a specific verification
#[tauri::command]
pub async fn get_verification_analytics(
    verification_id: String,
    state: State<'_, VerificationState>,
) -> Result<Option<crate::verification::analytics::VerificationAnalyticsData>, String> {
    Ok(state.analytics.get_verification_analytics(&verification_id).await)
}

/// Get verification history for a proof pack
#[tauri::command]
pub async fn get_proof_pack_verification_history(
    proof_pack_id: String,
    state: State<'_, VerificationState>,
) -> Result<Vec<crate::verification::analytics::VerificationAnalyticsData>, String> {
    Ok(state.analytics.get_proof_pack_history(&proof_pack_id).await)
}

/// Get verification statistics
#[tauri::command]
pub async fn get_verification_stats(
    start_time: Option<i64>,
    end_time: Option<i64>,
    state: State<'_, VerificationState>,
) -> Result<crate::verification::analytics::VerificationStats, String> {
    let end_time = end_time.unwrap_or_else(|| chrono::Utc::now().timestamp());
    let start_time = start_time.unwrap_or(end_time - 24 * 60 * 60); // Default to last 24 hours

    Ok(state.analytics.get_verification_stats(start_time, end_time).await)
}

/// Get audit trail
#[tauri::command]
pub async fn get_verification_audit_trail(
    start_time: Option<i64>,
    end_time: Option<i64>,
    event_type: Option<String>,
    state: State<'_, VerificationState>,
) -> Result<Vec<crate::verification::analytics::AuditEntry>, String> {
    let audit_event_type = event_type.as_ref().and_then(|s| {
        match s.as_str() {
            "started" => Some(crate::verification::analytics::AuditEventType::VerificationStarted),
            "completed" => Some(crate::verification::analytics::AuditEventType::VerificationCompleted),
            "failed" => Some(crate::verification::analytics::AuditEventType::VerificationFailed),
            "rate_limited" => Some(crate::verification::analytics::AuditEventType::RateLimitExceeded),
            "invalid" => Some(crate::verification::analytics::AuditEventType::InvalidRequest),
            _ => None,
        }
    });

    Ok(state.analytics.get_audit_trail(start_time, end_time, audit_event_type).await)
}

/// Generate verification report
#[tauri::command]
pub async fn generate_verification_report(
    verification_id: String,
    state: State<'_, VerificationState>,
) -> Result<VerificationReport, String> {
    state
        .analytics
        .generate_verification_report(&verification_id)
        .await
        .map_err(|e| format!("Failed to generate verification report: {}", e))
}

/// Clean up old verification data
#[tauri::command]
pub async fn cleanup_verification_data(
    retention_days: u32,
    state: State<'_, VerificationState>,
) -> Result<u32, String> {
    state
        .analytics
        .cleanup_old_data(retention_days)
        .await
        .map_err(|e| format!("Failed to cleanup verification data: {}", e))
}

/// Get verification engine status
#[tauri::command]
pub async fn get_verification_engine_status(
    state: State<'_, VerificationState>,
) -> Result<VerificationEngineStatus, String> {
    let engine_lock = state.engine.read().await;
    let is_initialized = engine_lock.is_some();
    
    let active = state.active_verifications.read().await;
    let active_count = active.len() as u32;

    Ok(VerificationEngineStatus {
        is_initialized,
        active_verifications: active_count,
        version: "1.0.0".to_string(),
    })
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct VerificationEngineStatus {
    pub is_initialized: bool,
    pub active_verifications: u32,
    pub version: String,
}

/// Initialize verification state
pub fn init_verification_state() -> VerificationState {
    VerificationState::default()
}