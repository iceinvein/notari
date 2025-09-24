use crate::verification::types::*;
use chrono::Utc;
use serde_json;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

/// Analytics service for tracking verification activities and generating reports
pub struct VerificationAnalyticsService {
    analytics_store: Arc<RwLock<HashMap<String, VerificationAnalyticsData>>>,
    audit_trail: Arc<RwLock<Vec<AuditEntry>>>,
}

impl VerificationAnalyticsService {
    /// Create a new analytics service
    pub fn new() -> Self {
        Self {
            analytics_store: Arc::new(RwLock::new(HashMap::new())),
            audit_trail: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Record a verification event
    pub async fn record_verification(
        &self,
        verification_id: &str,
        proof_pack_id: &str,
        verifier_info: &VerifierInfo,
        result: &VerificationResultData,
        processing_time: u64,
    ) -> crate::verification::types::VerificationApiResult<()> {
        let analytics = VerificationAnalyticsData {
            verification_id: verification_id.to_string(),
            proof_pack_id: proof_pack_id.to_string(),
            verifier_info: verifier_info.clone(),
            timestamp: Utc::now().timestamp(),
            processing_time,
            result_summary: ResultSummary {
                is_valid: result.is_valid,
                trust_score: result.trust_score,
                total_checks: result.checks.len() as u32,
                passed_checks: result.checks.iter()
                    .filter(|c| matches!(c.status, CheckStatus::Passed))
                    .count() as u32,
                failed_checks: result.checks.iter()
                    .filter(|c| matches!(c.status, CheckStatus::Failed))
                    .count() as u32,
                warning_checks: result.checks.iter()
                    .filter(|c| matches!(c.status, CheckStatus::Warning))
                    .count() as u32,
            },
            checks_performed: result.checks.iter()
                .map(|c| format!("{:?}", c.check_type))
                .collect(),
        };

        // Store analytics
        let mut store = self.analytics_store.write().await;
        store.insert(verification_id.to_string(), analytics);

        // Add to audit trail
        let audit_entry = AuditEntry {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now().timestamp(),
            event_type: AuditEventType::VerificationCompleted,
            verification_id: verification_id.to_string(),
            proof_pack_id: proof_pack_id.to_string(),
            verifier_info: verifier_info.clone(),
            result_summary: Some(ResultSummary {
                is_valid: result.is_valid,
                trust_score: result.trust_score,
                total_checks: result.checks.len() as u32,
                passed_checks: result.checks.iter()
                    .filter(|c| matches!(c.status, CheckStatus::Passed))
                    .count() as u32,
                failed_checks: result.checks.iter()
                    .filter(|c| matches!(c.status, CheckStatus::Failed))
                    .count() as u32,
                warning_checks: result.checks.iter()
                    .filter(|c| matches!(c.status, CheckStatus::Warning))
                    .count() as u32,
            }),
            metadata: HashMap::new(),
        };

        let mut trail = self.audit_trail.write().await;
        trail.push(audit_entry);

        Ok(())
    }

    /// Record a verification attempt (even if it fails)
    pub async fn record_verification_attempt(
        &self,
        proof_pack_id: &str,
        verifier_info: &VerifierInfo,
        error: Option<&str>,
    ) -> crate::verification::types::VerificationApiResult<String> {
        let verification_id = Uuid::new_v4().to_string();
        
        let event_type = if error.is_some() {
            AuditEventType::VerificationFailed
        } else {
            AuditEventType::VerificationStarted
        };

        let mut metadata = HashMap::new();
        if let Some(err) = error {
            metadata.insert("error".to_string(), serde_json::Value::String(err.to_string()));
        }

        let audit_entry = AuditEntry {
            id: Uuid::new_v4().to_string(),
            timestamp: Utc::now().timestamp(),
            event_type,
            verification_id: verification_id.clone(),
            proof_pack_id: proof_pack_id.to_string(),
            verifier_info: verifier_info.clone(),
            result_summary: None,
            metadata,
        };

        let mut trail = self.audit_trail.write().await;
        trail.push(audit_entry);

        Ok(verification_id)
    }

    /// Get analytics for a specific verification
    pub async fn get_verification_analytics(
        &self,
        verification_id: &str,
    ) -> Option<VerificationAnalyticsData> {
        let store = self.analytics_store.read().await;
        store.get(verification_id).cloned()
    }

    /// Get verification history for a proof pack
    pub async fn get_proof_pack_history(
        &self,
        proof_pack_id: &str,
    ) -> Vec<VerificationAnalyticsData> {
        let store = self.analytics_store.read().await;
        store.values()
            .filter(|analytics| analytics.proof_pack_id == proof_pack_id)
            .cloned()
            .collect()
    }

    /// Get verification statistics for a time period
    pub async fn get_verification_stats(
        &self,
        start_time: i64,
        end_time: i64,
    ) -> VerificationStats {
        let store = self.analytics_store.read().await;
        let relevant_verifications: Vec<_> = store.values()
            .filter(|analytics| {
                analytics.timestamp >= start_time && analytics.timestamp <= end_time
            })
            .collect();

        let total_verifications = relevant_verifications.len() as u32;
        let successful_verifications = relevant_verifications.iter()
            .filter(|v| v.result_summary.is_valid)
            .count() as u32;
        let failed_verifications = total_verifications - successful_verifications;

        let avg_processing_time = if total_verifications > 0 {
            relevant_verifications.iter()
                .map(|v| v.processing_time)
                .sum::<u64>() / total_verifications as u64
        } else {
            0
        };

        let avg_trust_score = if total_verifications > 0 {
            relevant_verifications.iter()
                .map(|v| v.result_summary.trust_score)
                .sum::<f64>() / total_verifications as f64
        } else {
            0.0
        };

        // Count unique verifiers
        let mut unique_verifiers = std::collections::HashSet::new();
        for verification in &relevant_verifications {
            unique_verifiers.insert(&verification.verifier_info.id);
        }

        // Count unique proof packs
        let mut unique_proof_packs = std::collections::HashSet::new();
        for verification in &relevant_verifications {
            unique_proof_packs.insert(&verification.proof_pack_id);
        }

        VerificationStats {
            period_start: start_time,
            period_end: end_time,
            total_verifications,
            successful_verifications,
            failed_verifications,
            unique_verifiers: unique_verifiers.len() as u32,
            unique_proof_packs: unique_proof_packs.len() as u32,
            avg_processing_time,
            avg_trust_score,
        }
    }

    /// Get audit trail entries
    pub async fn get_audit_trail(
        &self,
        start_time: Option<i64>,
        end_time: Option<i64>,
        event_type: Option<AuditEventType>,
    ) -> Vec<AuditEntry> {
        let trail = self.audit_trail.read().await;
        trail.iter()
            .filter(|entry| {
                if let Some(start) = start_time {
                    if entry.timestamp < start {
                        return false;
                    }
                }
                if let Some(end) = end_time {
                    if entry.timestamp > end {
                        return false;
                    }
                }
                if let Some(ref event_filter) = event_type {
                    if &entry.event_type != event_filter {
                        return false;
                    }
                }
                true
            })
            .cloned()
            .collect()
    }

    /// Generate a comprehensive verification report
    pub async fn generate_verification_report(
        &self,
        verification_id: &str,
    ) -> crate::verification::types::VerificationApiResult<VerificationReport> {
        let analytics = self.get_verification_analytics(verification_id).await
            .ok_or_else(|| VerificationError::InvalidProofPack(
                format!("Verification {} not found", verification_id)
            ))?;

        // Get the actual verification result from the audit trail
        let trail = self.audit_trail.read().await;
        let verification_entry = trail.iter()
            .find(|entry| entry.verification_id == verification_id 
                && matches!(entry.event_type, AuditEventType::VerificationCompleted))
            .ok_or_else(|| VerificationError::InvalidProofPack(
                format!("Verification result not found for {}", verification_id)
            ))?;

        // Reconstruct the verification result from analytics
        let result = VerificationResultData {
            is_valid: analytics.result_summary.is_valid,
            trust_score: analytics.result_summary.trust_score,
            verification_time: analytics.processing_time,
            checks: vec![], // Would need to store detailed checks in analytics
            warnings: vec![],
            errors: vec![],
        };

        Ok(VerificationReport {
            proof_pack_id: analytics.proof_pack_id,
            verification_id: verification_id.to_string(),
            result,
            timestamp: analytics.timestamp,
            verifier_info: analytics.verifier_info,
            merkle_proof: None, // Would be populated if available
        })
    }

    /// Clean up old analytics data
    pub async fn cleanup_old_data(&self, retention_days: u32) -> crate::verification::types::VerificationApiResult<u32> {
        let cutoff_time = Utc::now().timestamp() - (retention_days as i64 * 24 * 60 * 60);
        let mut removed_count = 0;

        // Clean analytics store
        let mut store = self.analytics_store.write().await;
        store.retain(|_, analytics| {
            if analytics.timestamp < cutoff_time {
                removed_count += 1;
                false
            } else {
                true
            }
        });

        // Clean audit trail
        let mut trail = self.audit_trail.write().await;
        trail.retain(|entry| entry.timestamp >= cutoff_time);

        Ok(removed_count)
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VerificationAnalyticsData {
    pub verification_id: String,
    pub proof_pack_id: String,
    pub verifier_info: VerifierInfo,
    pub timestamp: i64,
    pub processing_time: u64,
    pub result_summary: ResultSummary,
    pub checks_performed: Vec<String>,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AuditEntry {
    pub id: String,
    pub timestamp: i64,
    pub event_type: AuditEventType,
    pub verification_id: String,
    pub proof_pack_id: String,
    pub verifier_info: VerifierInfo,
    pub result_summary: Option<ResultSummary>,
    pub metadata: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, PartialEq, serde::Serialize, serde::Deserialize)]
pub enum AuditEventType {
    VerificationStarted,
    VerificationCompleted,
    VerificationFailed,
    RateLimitExceeded,
    InvalidRequest,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct VerificationStats {
    pub period_start: i64,
    pub period_end: i64,
    pub total_verifications: u32,
    pub successful_verifications: u32,
    pub failed_verifications: u32,
    pub unique_verifiers: u32,
    pub unique_proof_packs: u32,
    pub avg_processing_time: u64,
    pub avg_trust_score: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn create_test_verifier_info() -> VerifierInfo {
        VerifierInfo {
            id: "test_verifier".to_string(),
            name: Some("Test Verifier".to_string()),
            organization: Some("Test Org".to_string()),
            ip_address: "127.0.0.1".to_string(),
            user_agent: "test-agent".to_string(),
        }
    }

    fn create_test_verification_result() -> VerificationResultData {
        VerificationResultData {
            is_valid: true,
            trust_score: 95.0,
            verification_time: 1500,
            checks: vec![
                VerificationCheck {
                    check_type: VerificationCheckType::Signature,
                    status: CheckStatus::Passed,
                    message: "Signature valid".to_string(),
                    details: None,
                }
            ],
            warnings: vec![],
            errors: vec![],
        }
    }

    #[tokio::test]
    async fn test_record_verification() {
        let analytics = VerificationAnalyticsService::new();
        let verifier_info = create_test_verifier_info();
        let result = create_test_verification_result();

        let record_result = analytics.record_verification(
            "test_verification_id",
            "test_proof_pack_id",
            &verifier_info,
            &result,
            1500,
        ).await;

        assert!(record_result.is_ok());

        let stored_analytics = analytics.get_verification_analytics("test_verification_id").await;
        assert!(stored_analytics.is_some());
        
        let stored = stored_analytics.unwrap();
        assert_eq!(stored.verification_id, "test_verification_id");
        assert_eq!(stored.proof_pack_id, "test_proof_pack_id");
        assert_eq!(stored.processing_time, 1500);
        assert!(stored.result_summary.is_valid);
    }

    #[tokio::test]
    async fn test_verification_stats() {
        let analytics = VerificationAnalyticsService::new();
        let verifier_info = create_test_verifier_info();
        let result = create_test_verification_result();

        // Record multiple verifications
        for i in 0..5 {
            analytics.record_verification(
                &format!("verification_{}", i),
                &format!("proof_pack_{}", i),
                &verifier_info,
                &result,
                1000 + i * 100,
            ).await.unwrap();
        }

        let start_time = Utc::now().timestamp() - 3600;
        let end_time = Utc::now().timestamp() + 3600;
        
        let stats = analytics.get_verification_stats(start_time, end_time).await;
        
        assert_eq!(stats.total_verifications, 5);
        assert_eq!(stats.successful_verifications, 5);
        assert_eq!(stats.failed_verifications, 0);
        assert_eq!(stats.unique_proof_packs, 5);
        assert_eq!(stats.unique_verifiers, 1);
    }

    #[tokio::test]
    async fn test_audit_trail() {
        let analytics = VerificationAnalyticsService::new();
        let verifier_info = create_test_verifier_info();

        // Record verification attempt
        let verification_id = analytics.record_verification_attempt(
            "test_proof_pack",
            &verifier_info,
            None,
        ).await.unwrap();

        let trail = analytics.get_audit_trail(None, None, None).await;
        assert_eq!(trail.len(), 1);
        assert_eq!(trail[0].verification_id, verification_id);
        assert_eq!(trail[0].event_type, AuditEventType::VerificationStarted);
    }
}