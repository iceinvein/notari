use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;
use crate::blockchain::types::{BlockchainNetwork, MerkleProof};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofPackData {
    pub id: String,
    pub version: String,
    pub metadata: ProofPackMetadata,
    pub evidence: Evidence,
    pub verification: VerificationData,
    pub redactions: Option<RedactionData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofPackMetadata {
    pub creator: String,
    pub created: i64,
    pub sessions: Vec<String>,
    pub total_duration: u64,
    pub content_type: String,
    pub tags: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Evidence {
    pub sessions: Vec<SessionEvidence>,
    pub ai_analysis: Vec<AIAnalysisResult>,
    pub timeline: Vec<TimelineEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionEvidence {
    pub session_id: String,
    pub encrypted_data: String,
    pub checksum: String,
    pub duration: u64,
    pub start_time: i64,
    pub end_time: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AIAnalysisResult {
    pub session_id: String,
    pub content_type: String,
    pub confidence_score: f64,
    pub work_patterns: Vec<WorkPattern>,
    pub anomaly_flags: Vec<AnomalyFlag>,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkPattern {
    pub pattern_type: String,
    pub confidence: f64,
    pub time_range: (i64, i64),
    pub characteristics: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnomalyFlag {
    pub flag_type: String,
    pub severity: String,
    pub evidence: Vec<String>,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineEvent {
    pub timestamp: i64,
    pub event_type: String,
    pub description: String,
    pub session_id: Option<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationData {
    pub integrity_hash: String,
    pub signatures: Vec<CryptoSignature>,
    pub merkle_root: Option<String>,
    pub blockchain_anchor: Option<BlockchainAnchorData>,
    pub timestamp: i64,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CryptoSignature {
    pub algorithm: String,
    pub signature: String,
    pub public_key: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockchainAnchorData {
    pub network: BlockchainNetwork,
    pub transaction_id: String,
    pub block_number: Option<u64>,
    pub timestamp: i64,
    pub confirmation_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactionData {
    pub redacted_areas: Vec<RedactionArea>,
    pub commitment_proofs: Vec<CommitmentProof>,
    pub partial_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactionArea {
    pub area_id: String,
    pub session_id: String,
    pub coordinates: RedactionCoordinates,
    pub redaction_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactionCoordinates {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitmentProof {
    pub area_id: String,
    pub commitment: String,
    pub proof: String,
    pub algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationRequest {
    pub proof_pack: ProofPackData,
    pub config: VerificationConfig,
    pub verifier_info: VerifierInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationConfig {
    pub strict_mode: bool,
    pub check_blockchain: bool,
    pub require_signatures: bool,
    pub timeout_ms: u64,
    pub max_retries: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerifierInfo {
    pub id: String,
    pub name: Option<String>,
    pub organization: Option<String>,
    pub ip_address: String,
    pub user_agent: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResultData {
    pub is_valid: bool,
    pub trust_score: f64,
    pub verification_time: u64,
    pub checks: Vec<VerificationCheck>,
    pub warnings: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationCheck {
    pub check_type: VerificationCheckType,
    pub status: CheckStatus,
    pub message: String,
    pub details: Option<HashMap<String, serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum VerificationCheckType {
    Signature,
    Hash,
    Blockchain,
    Timestamp,
    Integrity,
    Redaction,
    AIAnalysis,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CheckStatus {
    Passed,
    Failed,
    Warning,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationStatus {
    pub id: String,
    pub status: ProcessingStatus,
    pub progress: f64,
    pub start_time: i64,
    pub end_time: Option<i64>,
    pub result: Option<VerificationResultData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProcessingStatus {
    Pending,
    InProgress,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationReport {
    pub proof_pack_id: String,
    pub verification_id: String,
    pub result: VerificationResultData,
    pub timestamp: i64,
    pub verifier_info: VerifierInfo,
    pub merkle_proof: Option<MerkleProof>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchVerificationRequest {
    pub proof_packs: Vec<ProofPackData>,
    pub config: VerificationConfig,
    pub verifier_info: VerifierInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchVerificationResult {
    pub results: Vec<VerificationResultData>,
    pub summary: BatchSummary,
    pub processing_time: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchSummary {
    pub total: u32,
    pub passed: u32,
    pub failed: u32,
    pub warnings: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationAnalytics {
    pub verification_id: String,
    pub proof_pack_id: String,
    pub verifier_info: VerifierInfo,
    pub timestamp: i64,
    pub processing_time: u64,
    pub result_summary: ResultSummary,
    pub checks_performed: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultSummary {
    pub is_valid: bool,
    pub trust_score: f64,
    pub total_checks: u32,
    pub passed_checks: u32,
    pub failed_checks: u32,
    pub warning_checks: u32,
}

#[derive(Error, Debug)]
pub enum VerificationError {
    #[error("Invalid proof pack: {0}")]
    InvalidProofPack(String),
    
    #[error("Signature verification failed: {0}")]
    SignatureVerificationFailed(String),
    
    #[error("Hash verification failed: {0}")]
    HashVerificationFailed(String),
    
    #[error("Blockchain verification failed: {0}")]
    BlockchainVerificationFailed(String),
    
    #[error("Timestamp verification failed: {0}")]
    TimestampVerificationFailed(String),
    
    #[error("Integrity check failed: {0}")]
    IntegrityCheckFailed(String),
    
    #[error("Redaction verification failed: {0}")]
    RedactionVerificationFailed(String),
    
    #[error("Configuration error: {0}")]
    ConfigurationError(String),
    
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Timeout: verification took longer than {timeout_ms}ms")]
    Timeout { timeout_ms: u64 },
    
    #[error("Rate limit exceeded: {0}")]
    RateLimitExceeded(String),
    
    #[error("Serialization error: {0}")]
    SerializationError(String),
    
    #[error("Database error: {0}")]
    DatabaseError(String),
}

pub type VerificationApiResult<T> = Result<T, VerificationError>;

impl Default for VerificationConfig {
    fn default() -> Self {
        Self {
            strict_mode: false,
            check_blockchain: true,
            require_signatures: true,
            timeout_ms: 30000, // 30 seconds
            max_retries: 3,
        }
    }
}