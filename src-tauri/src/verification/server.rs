use crate::verification::{
    analytics::VerificationAnalyticsService,
    engine::VerificationEngine,
    types::*,
};
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::Json,
    routing::{get, post},
    Router,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::RwLock;
use tower::ServiceBuilder;
use tower_http::{
    cors::CorsLayer,
    limit::RequestBodyLimitLayer,
    trace::TraceLayer,
};
use tracing::{info, warn, error};
use uuid::Uuid;

/// Verification server state
#[derive(Clone)]
pub struct ServerState {
    pub engine: Arc<VerificationEngine>,
    pub analytics: Arc<VerificationAnalyticsService>,
    pub active_verifications: Arc<RwLock<HashMap<String, VerificationStatus>>>,
}

/// Verification server for handling REST API requests
pub struct VerificationServer {
    state: ServerState,
    port: u16,
}

impl VerificationServer {
    /// Create a new verification server
    pub async fn new(port: u16) -> crate::verification::types::VerificationApiResult<Self> {
        let engine = Arc::new(VerificationEngine::new().await?);
        let analytics = Arc::new(VerificationAnalyticsService::new());
        let active_verifications = Arc::new(RwLock::new(HashMap::new()));

        let state = ServerState {
            engine,
            analytics,
            active_verifications,
        };

        Ok(Self { state, port })
    }

    /// Start the verification server
    pub async fn start(&self) -> crate::verification::types::VerificationApiResult<()> {
        let app = self.create_router();
        let addr = SocketAddr::from(([127, 0, 0, 1], self.port));

        info!("Starting verification server on {}", addr);

        let listener = tokio::net::TcpListener::bind(&addr)
            .await
            .map_err(|e| VerificationError::NetworkError(e.to_string()))?;
            
        axum::serve(listener, app)
            .await
            .map_err(|e| VerificationError::NetworkError(e.to_string()))?;

        Ok(())
    }

    /// Create the router with all endpoints
    fn create_router(&self) -> Router {
        Router::new()
            .route("/api/v1/verify", post(verify_proof_pack))
            .route("/api/v1/verify/:verification_id", get(get_verification_status))
            .route("/api/v1/verify/batch", post(batch_verify))
            .route("/api/v1/proof-pack/:proof_pack_id/status", get(get_proof_pack_status))
            .route("/api/v1/proof-pack/:proof_pack_id/history", get(get_proof_pack_history))
            .route("/api/v1/analytics/stats", get(get_verification_stats))
            .route("/api/v1/analytics/audit", get(get_audit_trail))
            .route("/api/v1/health", get(health_check))
            .layer(TraceLayer::new_for_http())
            .layer(CorsLayer::permissive())
            .layer(RequestBodyLimitLayer::new(10 * 1024 * 1024)) // 10MB limit
            .with_state(self.state.clone())
    }
}

/// API request/response types
#[derive(Debug, Deserialize)]
struct VerifyRequest {
    proof_pack: ProofPackData,
    config: Option<VerificationConfig>,
}

#[derive(Debug, Serialize)]
struct VerifyResponse {
    verification_id: String,
    status: String,
    message: String,
}

#[derive(Debug, Deserialize)]
struct BatchVerifyRequest {
    proof_packs: Vec<ProofPackData>,
    config: Option<VerificationConfig>,
}

#[derive(Debug, Deserialize)]
struct StatsQuery {
    start_time: Option<i64>,
    end_time: Option<i64>,
}

#[derive(Debug, Deserialize)]
struct AuditQuery {
    start_time: Option<i64>,
    end_time: Option<i64>,
    event_type: Option<String>,
}

/// Verify a single proof pack
async fn verify_proof_pack(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(request): Json<VerifyRequest>,
) -> Result<Json<VerifyResponse>, (StatusCode, Json<ErrorResponse>)> {
    let verification_id = Uuid::new_v4().to_string();
    
    // Extract verifier info from headers
    let verifier_info = extract_verifier_info(&headers, &verification_id);
    
    // Record verification attempt
    if let Err(e) = state.analytics.record_verification_attempt(
        &request.proof_pack.id,
        &verifier_info,
        None,
    ).await {
        warn!("Failed to record verification attempt: {}", e);
    }

    // Set initial status
    {
        let mut active = state.active_verifications.write().await;
        active.insert(verification_id.clone(), VerificationStatus {
            id: verification_id.clone(),
            status: ProcessingStatus::InProgress,
            progress: 0.0,
            start_time: Utc::now().timestamp(),
            end_time: None,
            result: None,
        });
    }

    // Create verification request
    let verification_request = VerificationRequest {
        proof_pack: request.proof_pack.clone(),
        config: request.config.unwrap_or_default(),
        verifier_info: verifier_info.clone(),
    };

    // Perform verification asynchronously
    let state_clone = state.clone();
    let verification_id_clone = verification_id.clone();
    tokio::spawn(async move {
        let start_time = std::time::Instant::now();
        
        match state_clone.engine.verify_proof_pack(verification_request).await {
            Ok(result) => {
                let processing_time = start_time.elapsed().as_millis() as u64;
                
                // Update status
                {
                    let mut active = state_clone.active_verifications.write().await;
                    if let Some(status) = active.get_mut(&verification_id_clone) {
                        status.status = ProcessingStatus::Completed;
                        status.progress = 100.0;
                        status.end_time = Some(Utc::now().timestamp());
                        status.result = Some(result.clone());
                    }
                }

                // Record analytics
                if let Err(e) = state_clone.analytics.record_verification(
                    &verification_id_clone,
                    &request.proof_pack.id,
                    &verifier_info,
                    &result,
                    processing_time,
                ).await {
                    error!("Failed to record verification analytics: {}", e);
                }
            }
            Err(e) => {
                error!("Verification failed: {}", e);
                
                // Update status with error
                {
                    let mut active = state_clone.active_verifications.write().await;
                    if let Some(status) = active.get_mut(&verification_id_clone) {
                        status.status = ProcessingStatus::Failed;
                        status.end_time = Some(Utc::now().timestamp());
                    }
                }

                // Record failed attempt
                if let Err(analytics_err) = state_clone.analytics.record_verification_attempt(
                    &request.proof_pack.id,
                    &verifier_info,
                    Some(&e.to_string()),
                ).await {
                    error!("Failed to record failed verification: {}", analytics_err);
                }
            }
        }
    });

    Ok(Json(VerifyResponse {
        verification_id,
        status: "accepted".to_string(),
        message: "Verification started".to_string(),
    }))
}

/// Get verification status
async fn get_verification_status(
    State(state): State<ServerState>,
    Path(verification_id): Path<String>,
) -> Result<Json<VerificationStatus>, (StatusCode, Json<ErrorResponse>)> {
    let active = state.active_verifications.read().await;
    
    if let Some(status) = active.get(&verification_id) {
        Ok(Json(status.clone()))
    } else {
        Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Verification not found".to_string(),
                message: format!("Verification {} not found", verification_id),
            }),
        ))
    }
}

/// Batch verify multiple proof packs
async fn batch_verify(
    State(state): State<ServerState>,
    headers: HeaderMap,
    Json(request): Json<BatchVerifyRequest>,
) -> Result<Json<BatchVerificationResult>, (StatusCode, Json<ErrorResponse>)> {
    let verifier_info = extract_verifier_info(&headers, "batch");
    
    let batch_request = BatchVerificationRequest {
        proof_packs: request.proof_packs,
        config: request.config.unwrap_or_default(),
        verifier_info,
    };

    match state.engine.batch_verify(batch_request).await {
        Ok(result) => Ok(Json(result)),
        Err(e) => {
            error!("Batch verification failed: {}", e);
            Err((
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ErrorResponse {
                    error: "Batch verification failed".to_string(),
                    message: e.to_string(),
                }),
            ))
        }
    }
}

/// Get proof pack verification status
async fn get_proof_pack_status(
    State(state): State<ServerState>,
    Path(proof_pack_id): Path<String>,
) -> Result<Json<ProofPackStatusResponse>, (StatusCode, Json<ErrorResponse>)> {
    let history = state.analytics.get_proof_pack_history(&proof_pack_id).await;
    
    let latest_verification = history.iter()
        .max_by_key(|v| v.timestamp);

    let status = if let Some(verification) = latest_verification {
        if verification.result_summary.is_valid {
            "verified".to_string()
        } else {
            "failed".to_string()
        }
    } else {
        "unverified".to_string()
    };

    Ok(Json(ProofPackStatusResponse {
        proof_pack_id,
        status,
        verification_count: history.len() as u32,
        latest_verification: latest_verification.map(|v| v.verification_id.clone()),
        latest_timestamp: latest_verification.map(|v| v.timestamp),
    }))
}

/// Get proof pack verification history
async fn get_proof_pack_history(
    State(state): State<ServerState>,
    Path(proof_pack_id): Path<String>,
) -> Result<Json<Vec<crate::verification::analytics::VerificationAnalyticsData>>, (StatusCode, Json<ErrorResponse>)> {
    let history = state.analytics.get_proof_pack_history(&proof_pack_id).await;
    Ok(Json(history))
}

/// Get verification statistics
async fn get_verification_stats(
    State(state): State<ServerState>,
    Query(params): Query<StatsQuery>,
) -> Result<Json<crate::verification::analytics::VerificationStats>, (StatusCode, Json<ErrorResponse>)> {
    let end_time = params.end_time.unwrap_or_else(|| Utc::now().timestamp());
    let start_time = params.start_time.unwrap_or(end_time - 24 * 60 * 60); // Default to last 24 hours

    let stats = state.analytics.get_verification_stats(start_time, end_time).await;
    Ok(Json(stats))
}

/// Get audit trail
async fn get_audit_trail(
    State(state): State<ServerState>,
    Query(params): Query<AuditQuery>,
) -> Result<Json<Vec<crate::verification::analytics::AuditEntry>>, (StatusCode, Json<ErrorResponse>)> {
    let event_type = params.event_type.as_ref().and_then(|s| {
        match s.as_str() {
            "started" => Some(crate::verification::analytics::AuditEventType::VerificationStarted),
            "completed" => Some(crate::verification::analytics::AuditEventType::VerificationCompleted),
            "failed" => Some(crate::verification::analytics::AuditEventType::VerificationFailed),
            "rate_limited" => Some(crate::verification::analytics::AuditEventType::RateLimitExceeded),
            "invalid" => Some(crate::verification::analytics::AuditEventType::InvalidRequest),
            _ => None,
        }
    });

    let trail = state.analytics.get_audit_trail(
        params.start_time,
        params.end_time,
        event_type,
    ).await;

    Ok(Json(trail))
}

/// Health check endpoint
async fn health_check() -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "healthy".to_string(),
        timestamp: Utc::now().timestamp(),
        version: "1.0.0".to_string(),
    })
}

/// Extract verifier information from request headers
fn extract_verifier_info(headers: &HeaderMap, verification_id: &str) -> VerifierInfo {
    let ip_address = headers
        .get("x-forwarded-for")
        .or_else(|| headers.get("x-real-ip"))
        .and_then(|h| h.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    let user_agent = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    VerifierInfo {
        id: format!("verifier_{}", verification_id),
        name: None,
        organization: None,
        ip_address,
        user_agent,
    }
}

/// API response types
#[derive(Debug, Serialize)]
struct ErrorResponse {
    error: String,
    message: String,
}

#[derive(Debug, Serialize)]
struct ProofPackStatusResponse {
    proof_pack_id: String,
    status: String,
    verification_count: u32,
    latest_verification: Option<String>,
    latest_timestamp: Option<i64>,
}

#[derive(Debug, Serialize)]
struct HealthResponse {
    status: String,
    timestamp: i64,
    version: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_health_check() {
        let server = VerificationServer::new(0).await.unwrap();
        let app = server.create_router();

        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .uri("/api/v1/health")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_verification_status_not_found() {
        let server = VerificationServer::new(0).await.unwrap();
        let app = server.create_router();

        let response = app
            .oneshot(
                axum::http::Request::builder()
                    .uri("/api/v1/verify/nonexistent")
                    .body(axum::body::Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }
}