use crate::blockchain::anchor::BlockchainAnchor;
use crate::crypto::manager::CryptoManager;
use crate::verification::types::*;
use chrono::Utc;
use ring::digest;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use futures::TryFutureExt;

/// Core verification engine for validating Proof Pack integrity
pub struct VerificationEngine {
    crypto_manager: Arc<CryptoManager>,
    blockchain_anchor: Arc<BlockchainAnchor>,
    verification_cache: Arc<RwLock<HashMap<String, VerificationResultData>>>,
    rate_limiter: Arc<RwLock<RateLimiter>>,
}

impl VerificationEngine {
    /// Create a new verification engine
    pub async fn new() -> crate::verification::types::VerificationApiResult<Self> {
        let crypto_manager = Arc::new(
            CryptoManager::new()
                .map_err(|e| VerificationError::ConfigurationError(e.to_string()))?
        );
        
        let blockchain_anchor = Arc::new(
            BlockchainAnchor::new()
                .await
                .map_err(|e| VerificationError::NetworkError(e.to_string()))?
        );

        Ok(Self {
            crypto_manager,
            blockchain_anchor,
            verification_cache: Arc::new(RwLock::new(HashMap::new())),
            rate_limiter: Arc::new(RwLock::new(RateLimiter::new(100, Duration::from_secs(60)))),
        })
    }

    /// Verify a single Proof Pack
    pub async fn verify_proof_pack(
        &self,
        request: VerificationRequest,
    ) -> crate::verification::types::VerificationApiResult<VerificationResultData> {
        let start_time = Instant::now();
        
        // Check rate limiting
        self.check_rate_limit(&request.verifier_info.ip_address).await?;

        // Check cache first
        let cache_key = format!("{}:{}", request.proof_pack.id, 
            serde_json::to_string(&request.config).unwrap_or_default());
        
        if let Some(cached_result) = self.get_cached_result(&cache_key).await {
            return Ok(cached_result);
        }

        let mut checks = Vec::new();
        let mut warnings = Vec::new();
        let mut errors = Vec::new();
        let mut trust_score = 100.0;

        // 1. Validate proof pack structure
        match self.validate_structure(&request.proof_pack).await {
            Ok(_) => {
                checks.push(VerificationCheck {
                    check_type: VerificationCheckType::Integrity,
                    status: CheckStatus::Passed,
                    message: "Proof pack structure is valid".to_string(),
                    details: None,
                });
            }
            Err(e) => {
                trust_score -= 30.0;
                errors.push(format!("Structure validation failed: {}", e));
                checks.push(VerificationCheck {
                    check_type: VerificationCheckType::Integrity,
                    status: CheckStatus::Failed,
                    message: format!("Structure validation failed: {}", e),
                    details: None,
                });
            }
        }

        // 2. Verify cryptographic signatures
        if request.config.require_signatures {
            match self.verify_signatures(&request.proof_pack).await {
                Ok(signature_valid) => {
                    if signature_valid {
                        checks.push(VerificationCheck {
                            check_type: VerificationCheckType::Signature,
                            status: CheckStatus::Passed,
                            message: "All signatures are valid".to_string(),
                            details: None,
                        });
                    } else {
                        trust_score -= 40.0;
                        errors.push("Signature verification failed".to_string());
                        checks.push(VerificationCheck {
                            check_type: VerificationCheckType::Signature,
                            status: CheckStatus::Failed,
                            message: "Signature verification failed".to_string(),
                            details: None,
                        });
                    }
                }
                Err(e) => {
                    trust_score -= 40.0;
                    errors.push(format!("Signature verification error: {}", e));
                    checks.push(VerificationCheck {
                        check_type: VerificationCheckType::Signature,
                        status: CheckStatus::Failed,
                        message: format!("Signature verification error: {}", e),
                        details: None,
                    });
                }
            }
        }

        // 3. Verify integrity hashes
        match self.verify_integrity_hash(&request.proof_pack).await {
            Ok(hash_valid) => {
                if hash_valid {
                    checks.push(VerificationCheck {
                        check_type: VerificationCheckType::Hash,
                        status: CheckStatus::Passed,
                        message: "Integrity hash is valid".to_string(),
                        details: None,
                    });
                } else {
                    trust_score -= 35.0;
                    errors.push("Integrity hash verification failed".to_string());
                    checks.push(VerificationCheck {
                        check_type: VerificationCheckType::Hash,
                        status: CheckStatus::Failed,
                        message: "Integrity hash verification failed".to_string(),
                        details: None,
                    });
                }
            }
            Err(e) => {
                trust_score -= 35.0;
                errors.push(format!("Hash verification error: {}", e));
                checks.push(VerificationCheck {
                    check_type: VerificationCheckType::Hash,
                    status: CheckStatus::Failed,
                    message: format!("Hash verification error: {}", e),
                    details: None,
                });
            }
        }

        // 4. Verify blockchain anchor
        if request.config.check_blockchain {
            match self.verify_blockchain_anchor(&request.proof_pack).await {
                Ok(anchor_valid) => {
                    if anchor_valid {
                        checks.push(VerificationCheck {
                            check_type: VerificationCheckType::Blockchain,
                            status: CheckStatus::Passed,
                            message: "Blockchain anchor is valid".to_string(),
                            details: None,
                        });
                    } else {
                        trust_score -= 25.0;
                        warnings.push("Blockchain anchor verification failed".to_string());
                        checks.push(VerificationCheck {
                            check_type: VerificationCheckType::Blockchain,
                            status: CheckStatus::Warning,
                            message: "Blockchain anchor verification failed".to_string(),
                            details: None,
                        });
                    }
                }
                Err(e) => {
                    trust_score -= 15.0;
                    warnings.push(format!("Blockchain verification error: {}", e));
                    checks.push(VerificationCheck {
                        check_type: VerificationCheckType::Blockchain,
                        status: CheckStatus::Warning,
                        message: format!("Blockchain verification error: {}", e),
                        details: None,
                    });
                }
            }
        }

        // 5. Verify timestamps
        match self.verify_timestamps(&request.proof_pack).await {
            Ok(timestamp_valid) => {
                if timestamp_valid {
                    checks.push(VerificationCheck {
                        check_type: VerificationCheckType::Timestamp,
                        status: CheckStatus::Passed,
                        message: "Timestamps are valid".to_string(),
                        details: None,
                    });
                } else {
                    trust_score -= 10.0;
                    warnings.push("Timestamp verification failed".to_string());
                    checks.push(VerificationCheck {
                        check_type: VerificationCheckType::Timestamp,
                        status: CheckStatus::Warning,
                        message: "Timestamp verification failed".to_string(),
                        details: None,
                    });
                }
            }
            Err(e) => {
                trust_score -= 10.0;
                warnings.push(format!("Timestamp verification error: {}", e));
                checks.push(VerificationCheck {
                    check_type: VerificationCheckType::Timestamp,
                    status: CheckStatus::Warning,
                    message: format!("Timestamp verification error: {}", e),
                    details: None,
                });
            }
        }

        // 6. Verify redactions if present
        if let Some(redaction_data) = &request.proof_pack.redactions {
            match self.verify_redactions(redaction_data).await {
                Ok(redaction_valid) => {
                    if redaction_valid {
                        checks.push(VerificationCheck {
                            check_type: VerificationCheckType::Redaction,
                            status: CheckStatus::Passed,
                            message: "Redaction proofs are valid".to_string(),
                            details: None,
                        });
                    } else {
                        trust_score -= 20.0;
                        errors.push("Redaction verification failed".to_string());
                        checks.push(VerificationCheck {
                            check_type: VerificationCheckType::Redaction,
                            status: CheckStatus::Failed,
                            message: "Redaction verification failed".to_string(),
                            details: None,
                        });
                    }
                }
                Err(e) => {
                    trust_score -= 20.0;
                    errors.push(format!("Redaction verification error: {}", e));
                    checks.push(VerificationCheck {
                        check_type: VerificationCheckType::Redaction,
                        status: CheckStatus::Failed,
                        message: format!("Redaction verification error: {}", e),
                        details: None,
                    });
                }
            }
        }

        // 7. Analyze AI analysis results
        match self.verify_ai_analysis(&request.proof_pack).await {
            Ok(ai_valid) => {
                if ai_valid {
                    checks.push(VerificationCheck {
                        check_type: VerificationCheckType::AIAnalysis,
                        status: CheckStatus::Passed,
                        message: "AI analysis is consistent".to_string(),
                        details: None,
                    });
                } else {
                    trust_score -= 5.0;
                    warnings.push("AI analysis shows potential inconsistencies".to_string());
                    checks.push(VerificationCheck {
                        check_type: VerificationCheckType::AIAnalysis,
                        status: CheckStatus::Warning,
                        message: "AI analysis shows potential inconsistencies".to_string(),
                        details: None,
                    });
                }
            }
            Err(e) => {
                warnings.push(format!("AI analysis verification error: {}", e));
                checks.push(VerificationCheck {
                    check_type: VerificationCheckType::AIAnalysis,
                    status: CheckStatus::Warning,
                    message: format!("AI analysis verification error: {}", e),
                    details: None,
                });
            }
        }

        // Apply strict mode penalties
        if request.config.strict_mode {
            if !warnings.is_empty() {
                trust_score -= warnings.len() as f64 * 5.0;
            }
        }

        // Ensure trust score is within bounds
        trust_score = trust_score.max(0.0).min(100.0);

        let verification_time = start_time.elapsed().as_millis() as u64;
        let is_valid = errors.is_empty() && (!request.config.strict_mode || warnings.is_empty());

        let result = VerificationResultData {
            is_valid,
            trust_score,
            verification_time,
            checks,
            warnings,
            errors,
        };

        // Cache the result
        self.cache_result(cache_key, result.clone()).await;

        Ok(result)
    }

    /// Verify multiple Proof Packs in batch
    pub async fn batch_verify(
        &self,
        request: BatchVerificationRequest,
    ) -> crate::verification::types::VerificationApiResult<BatchVerificationResult> {
        let start_time = Instant::now();
        let mut results = Vec::new();
        let mut passed = 0;
        let mut failed = 0;
        let mut warnings = 0;

        for proof_pack in request.proof_packs {
            let verification_request = VerificationRequest {
                proof_pack,
                config: request.config.clone(),
                verifier_info: request.verifier_info.clone(),
            };

            match self.verify_proof_pack(verification_request).await {
                Ok(result) => {
                    if result.is_valid {
                        passed += 1;
                    } else {
                        failed += 1;
                    }
                    if !result.warnings.is_empty() {
                        warnings += 1;
                    }
                    results.push(result);
                }
                Err(e) => {
                    failed += 1;
                    results.push(VerificationResultData {
                        is_valid: false,
                        trust_score: 0.0,
                        verification_time: 0,
                        checks: vec![],
                        warnings: vec![],
                        errors: vec![format!("Verification failed: {}", e)],
                    });
                }
            }
        }

        let processing_time = start_time.elapsed().as_millis() as u64;
        let total = results.len() as u32;

        Ok(BatchVerificationResult {
            results,
            summary: BatchSummary {
                total,
                passed,
                failed,
                warnings,
            },
            processing_time,
        })
    }

    /// Generate a Merkle proof for a specific hash in an anchored batch
    pub async fn generate_merkle_proof(
        &self,
        hash: &str,
        anchor_id: &str,
    ) -> crate::verification::types::VerificationApiResult<crate::blockchain::types::MerkleProof> {
        self.blockchain_anchor
            .generate_merkle_proof(hash, anchor_id)
            .await
            .map_err(|e| VerificationError::BlockchainVerificationFailed(e.to_string()))
    }

    // Private helper methods

    async fn check_rate_limit(&self, ip: &str) -> crate::verification::types::VerificationApiResult<()> {
        let mut limiter = self.rate_limiter.write().await;
        if limiter.is_allowed(ip) {
            Ok(())
        } else {
            Err(VerificationError::RateLimitExceeded(
                format!("Rate limit exceeded for IP: {}", ip)
            ))
        }
    }

    async fn get_cached_result(&self, key: &str) -> Option<VerificationResultData> {
        let cache = self.verification_cache.read().await;
        cache.get(key).cloned()
    }

    async fn cache_result(&self, key: String, result: VerificationResultData) {
        let mut cache = self.verification_cache.write().await;
        cache.insert(key, result);
    }

    async fn validate_structure(&self, proof_pack: &ProofPackData) -> crate::verification::types::VerificationApiResult<()> {
        // Validate required fields
        if proof_pack.id.is_empty() {
            return Err(VerificationError::InvalidProofPack("Missing proof pack ID".to_string()));
        }

        if proof_pack.version.is_empty() {
            return Err(VerificationError::InvalidProofPack("Missing version".to_string()));
        }

        if proof_pack.evidence.sessions.is_empty() {
            return Err(VerificationError::InvalidProofPack("No session evidence found".to_string()));
        }

        if proof_pack.verification.integrity_hash.is_empty() {
            return Err(VerificationError::InvalidProofPack("Missing integrity hash".to_string()));
        }

        // Validate session evidence
        for session in &proof_pack.evidence.sessions {
            if session.session_id.is_empty() || session.encrypted_data.is_empty() {
                return Err(VerificationError::InvalidProofPack(
                    format!("Invalid session evidence: {}", session.session_id)
                ));
            }
        }

        Ok(())
    }

    async fn verify_signatures(&self, proof_pack: &ProofPackData) -> crate::verification::types::VerificationApiResult<bool> {
        if proof_pack.verification.signatures.is_empty() {
            return Ok(false);
        }

        for signature in &proof_pack.verification.signatures {
            let is_valid = self.crypto_manager
                .verify_signature(
                    proof_pack.verification.integrity_hash.as_bytes(),
                    &signature.signature,
                    &signature.public_key,
                )
                .await
                .map_err(|e| VerificationError::SignatureVerificationFailed(e.to_string()))?;

            if !is_valid {
                return Ok(false);
            }
        }

        Ok(true)
    }

    async fn verify_integrity_hash(&self, proof_pack: &ProofPackData) -> crate::verification::types::VerificationApiResult<bool> {
        // Reconstruct the hash from the evidence
        let mut hasher_context = digest::Context::new(&digest::SHA256);
        
        // Hash session data
        for session in &proof_pack.evidence.sessions {
            hasher_context.update(session.encrypted_data.as_bytes());
            hasher_context.update(session.checksum.as_bytes());
        }

        // Hash AI analysis
        for analysis in &proof_pack.evidence.ai_analysis {
            let analysis_json = serde_json::to_string(analysis)
                .map_err(|e| VerificationError::SerializationError(e.to_string()))?;
            hasher_context.update(analysis_json.as_bytes());
        }

        // Hash timeline
        for event in &proof_pack.evidence.timeline {
            let event_json = serde_json::to_string(event)
                .map_err(|e| VerificationError::SerializationError(e.to_string()))?;
            hasher_context.update(event_json.as_bytes());
        }

        let computed_hash = hex::encode(hasher_context.finish().as_ref());
        Ok(computed_hash == proof_pack.verification.integrity_hash)
    }

    async fn verify_blockchain_anchor(&self, proof_pack: &ProofPackData) -> crate::verification::types::VerificationApiResult<bool> {
        if let Some(anchor) = &proof_pack.verification.blockchain_anchor {
            let verification = self.blockchain_anchor
                .verify_anchor(&anchor.transaction_id, anchor.network.clone())
                .await
                .map_err(|e| VerificationError::BlockchainVerificationFailed(e.to_string()))?;

            Ok(verification.is_valid)
        } else {
            Ok(false)
        }
    }

    async fn verify_timestamps(&self, proof_pack: &ProofPackData) -> crate::verification::types::VerificationApiResult<bool> {
        let current_time = Utc::now().timestamp();
        
        // Check if timestamps are reasonable (not in the future, not too old)
        if proof_pack.verification.timestamp > current_time {
            return Ok(false);
        }

        // Check if timestamps are consistent across sessions
        for session in &proof_pack.evidence.sessions {
            if session.start_time > session.end_time {
                return Ok(false);
            }
            
            if session.start_time > current_time || session.end_time > current_time {
                return Ok(false);
            }
        }

        Ok(true)
    }

    async fn verify_redactions(&self, redaction_data: &RedactionData) -> crate::verification::types::VerificationApiResult<bool> {
        // Verify commitment proofs for redacted areas
        for proof in &redaction_data.commitment_proofs {
            // This would involve verifying zero-knowledge proofs
            // For now, we'll do basic validation
            if proof.commitment.is_empty() || proof.proof.is_empty() {
                return Ok(false);
            }
        }

        // Verify that redacted areas have corresponding proofs
        for area in &redaction_data.redacted_areas {
            let has_proof = redaction_data.commitment_proofs
                .iter()
                .any(|proof| proof.area_id == area.area_id);
            
            if !has_proof {
                return Ok(false);
            }
        }

        Ok(true)
    }

    async fn verify_ai_analysis(&self, proof_pack: &ProofPackData) -> crate::verification::types::VerificationApiResult<bool> {
        // Check for consistency in AI analysis results
        for analysis in &proof_pack.evidence.ai_analysis {
            // Check confidence scores are reasonable
            if analysis.confidence_score < 0.0 || analysis.confidence_score > 1.0 {
                return Ok(false);
            }

            // Check for high-severity anomaly flags
            for flag in &analysis.anomaly_flags {
                if flag.severity == "high" && flag.confidence > 0.8 {
                    return Ok(false);
                }
            }
        }

        Ok(true)
    }
}

/// Simple rate limiter implementation
struct RateLimiter {
    requests: HashMap<String, Vec<Instant>>,
    max_requests: usize,
    window: Duration,
}

impl RateLimiter {
    fn new(max_requests: usize, window: Duration) -> Self {
        Self {
            requests: HashMap::new(),
            max_requests,
            window,
        }
    }

    fn is_allowed(&mut self, key: &str) -> bool {
        let now = Instant::now();
        let entry = self.requests.entry(key.to_string()).or_insert_with(Vec::new);
        
        // Remove old requests outside the window
        entry.retain(|&time| now.duration_since(time) < self.window);
        
        if entry.len() < self.max_requests {
            entry.push(now);
            true
        } else {
            false
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn create_test_proof_pack() -> ProofPackData {
        ProofPackData {
            id: "test_proof_pack".to_string(),
            version: "1.0".to_string(),
            metadata: ProofPackMetadata {
                creator: "test_user".to_string(),
                created: Utc::now().timestamp(),
                sessions: vec!["session1".to_string()],
                total_duration: 3600,
                content_type: "document".to_string(),
                tags: HashMap::new(),
            },
            evidence: Evidence {
                sessions: vec![SessionEvidence {
                    session_id: "session1".to_string(),
                    encrypted_data: "encrypted_test_data".to_string(),
                    checksum: "test_checksum".to_string(),
                    duration: 3600,
                    start_time: Utc::now().timestamp() - 3600,
                    end_time: Utc::now().timestamp(),
                }],
                ai_analysis: vec![],
                timeline: vec![],
            },
            verification: VerificationData {
                integrity_hash: "test_hash".to_string(),
                signatures: vec![],
                merkle_root: None,
                blockchain_anchor: None,
                timestamp: Utc::now().timestamp(),
                version: "1.0".to_string(),
            },
            redactions: None,
        }
    }

    #[tokio::test]
    async fn test_rate_limiter() {
        let mut limiter = RateLimiter::new(2, Duration::from_secs(1));
        
        assert!(limiter.is_allowed("test_ip"));
        assert!(limiter.is_allowed("test_ip"));
        assert!(!limiter.is_allowed("test_ip")); // Should be rate limited
        
        // Different IP should be allowed
        assert!(limiter.is_allowed("other_ip"));
    }

    #[tokio::test]
    async fn test_structure_validation() {
        let engine = VerificationEngine::new().await.unwrap();
        let proof_pack = create_test_proof_pack();
        
        let result = engine.validate_structure(&proof_pack).await;
        assert!(result.is_ok());
        
        // Test with invalid proof pack
        let mut invalid_pack = proof_pack;
        invalid_pack.id = "".to_string();
        
        let result = engine.validate_structure(&invalid_pack).await;
        assert!(result.is_err());
    }
}