use super::*;
use crate::verification::{
    engine::VerificationEngine,
    analytics::VerificationAnalyticsService,
    types::*,
};
use chrono::Utc;
use std::collections::HashMap;
use tokio;

/// Create a test proof pack for testing
fn create_test_proof_pack() -> ProofPackData {
    ProofPackData {
        id: "test_proof_pack_id".to_string(),
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
            ai_analysis: vec![AIAnalysisResult {
                session_id: "session1".to_string(),
                content_type: "text".to_string(),
                confidence_score: 0.95,
                work_patterns: vec![WorkPattern {
                    pattern_type: "typing".to_string(),
                    confidence: 0.9,
                    time_range: (Utc::now().timestamp() - 3600, Utc::now().timestamp()),
                    characteristics: HashMap::new(),
                }],
                anomaly_flags: vec![],
                summary: "User worked on document for 1 hour".to_string(),
            }],
            timeline: vec![TimelineEvent {
                timestamp: Utc::now().timestamp(),
                event_type: "session_start".to_string(),
                description: "Session started".to_string(),
                session_id: Some("session1".to_string()),
                metadata: HashMap::new(),
            }],
        },
        verification: VerificationData {
            integrity_hash: "test_integrity_hash".to_string(),
            signatures: vec![CryptoSignature {
                algorithm: "Ed25519".to_string(),
                signature: "test_signature".to_string(),
                public_key: "test_public_key".to_string(),
                timestamp: Utc::now().timestamp(),
            }],
            merkle_root: Some("test_merkle_root".to_string()),
            blockchain_anchor: Some(BlockchainAnchorData {
                network: crate::blockchain::types::BlockchainNetwork::ArweaveTestnet,
                transaction_id: "test_tx_id".to_string(),
                block_number: Some(12345),
                timestamp: Utc::now().timestamp(),
                confirmation_url: "https://test.arweave.net/tx/test_tx_id".to_string(),
            }),
            timestamp: Utc::now().timestamp(),
            version: "1.0".to_string(),
        },
        redactions: None,
    }
}

fn create_test_verifier_info() -> VerifierInfo {
    VerifierInfo {
        id: "test_verifier".to_string(),
        name: Some("Test Verifier".to_string()),
        organization: Some("Test Organization".to_string()),
        ip_address: "127.0.0.1".to_string(),
        user_agent: "test-agent/1.0".to_string(),
    }
}

fn create_test_verification_config() -> VerificationConfig {
    VerificationConfig {
        strict_mode: false,
        check_blockchain: false, // Disable blockchain checks for tests
        require_signatures: false, // Disable signature checks for tests
        timeout_ms: 30000,
        max_retries: 3,
    }
}

#[tokio::test]
async fn test_verification_engine_creation() {
    let result = VerificationEngine::new().await;
    assert!(result.is_ok(), "Failed to create verification engine: {:?}", result.err());
}

#[tokio::test]
async fn test_proof_pack_structure_validation() {
    let engine = VerificationEngine::new().await.unwrap();
    let proof_pack = create_test_proof_pack();
    
    // Test through the public verify_proof_pack method instead
    let verifier_info = create_test_verifier_info();
    let config = create_test_verification_config();

    let request = VerificationRequest {
        proof_pack,
        config,
        verifier_info,
    };

    let result = engine.verify_proof_pack(request).await;
    assert!(result.is_ok(), "Valid proof pack should pass verification");

    // Test with invalid proof pack (empty ID)
    let mut invalid_pack = create_test_proof_pack();
    invalid_pack.id = "".to_string();
    
    let invalid_request = VerificationRequest {
        proof_pack: invalid_pack,
        config: create_test_verification_config(),
        verifier_info: create_test_verifier_info(),
    };
    
    let result = engine.verify_proof_pack(invalid_request).await;
    assert!(result.is_ok(), "Should return result even for invalid proof pack");
    let verification_result = result.unwrap();
    assert!(!verification_result.is_valid, "Invalid proof pack should fail verification");
}

#[tokio::test]
async fn test_verification_request_processing() {
    let engine = VerificationEngine::new().await.unwrap();
    let proof_pack = create_test_proof_pack();
    let verifier_info = create_test_verifier_info();
    let config = create_test_verification_config();

    let request = VerificationRequest {
        proof_pack,
        config,
        verifier_info,
    };

    let result = engine.verify_proof_pack(request).await;
    assert!(result.is_ok(), "Verification should succeed: {:?}", result.err());

    let verification_result = result.unwrap();
    assert!(!verification_result.checks.is_empty(), "Should have performed some checks");
    assert!(verification_result.verification_time > 0, "Should have recorded processing time");
}

#[tokio::test]
async fn test_batch_verification() {
    let engine = VerificationEngine::new().await.unwrap();
    let proof_pack1 = create_test_proof_pack();
    let mut proof_pack2 = create_test_proof_pack();
    proof_pack2.id = "test_proof_pack_id_2".to_string();
    
    let verifier_info = create_test_verifier_info();
    let config = create_test_verification_config();

    let request = BatchVerificationRequest {
        proof_packs: vec![proof_pack1, proof_pack2],
        config,
        verifier_info,
    };

    let result = engine.batch_verify(request).await;
    assert!(result.is_ok(), "Batch verification should succeed: {:?}", result.err());

    let batch_result = result.unwrap();
    assert_eq!(batch_result.results.len(), 2, "Should have results for both proof packs");
    assert_eq!(batch_result.summary.total, 2, "Summary should show 2 total verifications");
    assert!(batch_result.processing_time > 0, "Should have recorded processing time");
}

#[tokio::test]
async fn test_verification_with_redactions() {
    let engine = VerificationEngine::new().await.unwrap();
    let mut proof_pack = create_test_proof_pack();
    
    // Add redaction data
    proof_pack.redactions = Some(RedactionData {
        redacted_areas: vec![RedactionArea {
            area_id: "area1".to_string(),
            session_id: "session1".to_string(),
            coordinates: RedactionCoordinates {
                x: 100,
                y: 200,
                width: 300,
                height: 150,
            },
            redaction_type: "sensitive_text".to_string(),
        }],
        commitment_proofs: vec![CommitmentProof {
            area_id: "area1".to_string(),
            commitment: "test_commitment".to_string(),
            proof: "test_proof".to_string(),
            algorithm: "SHA256".to_string(),
        }],
        partial_hash: "test_partial_hash".to_string(),
    });

    let verifier_info = create_test_verifier_info();
    let config = create_test_verification_config();

    let request = VerificationRequest {
        proof_pack,
        config,
        verifier_info,
    };

    let result = engine.verify_proof_pack(request).await;
    assert!(result.is_ok(), "Verification with redactions should succeed: {:?}", result.err());

    let verification_result = result.unwrap();
    
    // Should have redaction check
    let has_redaction_check = verification_result.checks.iter()
        .any(|check| matches!(check.check_type, VerificationCheckType::Redaction));
    assert!(has_redaction_check, "Should have performed redaction verification");
}

#[tokio::test]
async fn test_verification_analytics() {
    let analytics = VerificationAnalyticsService::new();
    let verifier_info = create_test_verifier_info();
    
    let verification_result = VerificationResultData {
        is_valid: true,
        trust_score: 95.0,
        verification_time: 1500,
        checks: vec![VerificationCheck {
            check_type: VerificationCheckType::Signature,
            status: CheckStatus::Passed,
            message: "Signature valid".to_string(),
            details: None,
        }],
        warnings: vec![],
        errors: vec![],
    };

    // Record verification
    let result = analytics.record_verification(
        "test_verification_id",
        "test_proof_pack_id",
        &verifier_info,
        &verification_result,
        1500,
    ).await;
    assert!(result.is_ok(), "Should record verification successfully");

    // Get analytics
    let stored_analytics = analytics.get_verification_analytics("test_verification_id").await;
    assert!(stored_analytics.is_some(), "Should retrieve stored analytics");

    let analytics_data = stored_analytics.unwrap();
    assert_eq!(analytics_data.verification_id, "test_verification_id");
    assert_eq!(analytics_data.proof_pack_id, "test_proof_pack_id");
    assert_eq!(analytics_data.processing_time, 1500);
    assert!(analytics_data.result_summary.is_valid);
    assert_eq!(analytics_data.result_summary.trust_score, 95.0);
}

#[tokio::test]
async fn test_verification_stats() {
    let analytics = VerificationAnalyticsService::new();
    let verifier_info = create_test_verifier_info();
    
    let verification_result = VerificationResultData {
        is_valid: true,
        trust_score: 90.0,
        verification_time: 1000,
        checks: vec![],
        warnings: vec![],
        errors: vec![],
    };

    // Record multiple verifications
    for i in 0..5 {
        let result = analytics.record_verification(
            &format!("verification_{}", i),
            &format!("proof_pack_{}", i),
            &verifier_info,
            &verification_result,
            1000 + i * 100,
        ).await;
        assert!(result.is_ok(), "Should record verification {}", i);
    }

    let start_time = Utc::now().timestamp() - 3600;
    let end_time = Utc::now().timestamp() + 3600;
    
    let stats = analytics.get_verification_stats(start_time, end_time).await;
    
    assert_eq!(stats.total_verifications, 5);
    assert_eq!(stats.successful_verifications, 5);
    assert_eq!(stats.failed_verifications, 0);
    assert_eq!(stats.unique_proof_packs, 5);
    assert_eq!(stats.unique_verifiers, 1);
    assert!(stats.avg_processing_time > 0);
    assert_eq!(stats.avg_trust_score, 90.0);
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
    ).await;
    assert!(verification_id.is_ok(), "Should record verification attempt");

    let verification_id = verification_id.unwrap();

    // Record failed attempt
    let failed_result = analytics.record_verification_attempt(
        "test_proof_pack_2",
        &verifier_info,
        Some("Test error"),
    ).await;
    assert!(failed_result.is_ok(), "Should record failed verification attempt");

    // Get audit trail
    let trail = analytics.get_audit_trail(None, None, None).await;
    assert_eq!(trail.len(), 2, "Should have 2 audit entries");

    // Check first entry
    assert_eq!(trail[0].verification_id, verification_id);
    assert_eq!(trail[0].event_type, crate::verification::analytics::AuditEventType::VerificationStarted);
    assert_eq!(trail[0].proof_pack_id, "test_proof_pack");

    // Check second entry
    assert_eq!(trail[1].event_type, crate::verification::analytics::AuditEventType::VerificationFailed);
    assert_eq!(trail[1].proof_pack_id, "test_proof_pack_2");
    assert!(trail[1].metadata.contains_key("error"));
}

#[tokio::test]
async fn test_verification_report_generation() {
    let analytics = VerificationAnalyticsService::new();
    let verifier_info = create_test_verifier_info();
    
    let verification_result = VerificationResultData {
        is_valid: true,
        trust_score: 88.5,
        verification_time: 2000,
        checks: vec![],
        warnings: vec![],
        errors: vec![],
    };

    // Record verification
    let verification_id = "test_verification_report";
    let proof_pack_id = "test_proof_pack_report";
    
    analytics.record_verification(
        verification_id,
        proof_pack_id,
        &verifier_info,
        &verification_result,
        2000,
    ).await.unwrap();

    // Generate report
    let report = analytics.generate_verification_report(verification_id).await;
    assert!(report.is_ok(), "Should generate verification report successfully");

    let report = report.unwrap();
    assert_eq!(report.verification_id, verification_id);
    assert_eq!(report.proof_pack_id, proof_pack_id);
    assert_eq!(report.result.trust_score, 88.5);
    assert_eq!(report.verifier_info.id, verifier_info.id);
}

#[tokio::test]
async fn test_data_cleanup() {
    let analytics = VerificationAnalyticsService::new();
    let verifier_info = create_test_verifier_info();
    
    let verification_result = VerificationResultData {
        is_valid: true,
        trust_score: 95.0,
        verification_time: 1500,
        checks: vec![],
        warnings: vec![],
        errors: vec![],
    };

    // Record some verifications
    for i in 0..3 {
        analytics.record_verification(
            &format!("verification_{}", i),
            &format!("proof_pack_{}", i),
            &verifier_info,
            &verification_result,
            1500,
        ).await.unwrap();
    }

    // Cleanup with 0 retention days (should remove all)
    let removed_count = analytics.cleanup_old_data(0).await;
    assert!(removed_count.is_ok(), "Should cleanup data successfully");
    
    let removed = removed_count.unwrap();
    assert_eq!(removed, 3, "Should have removed 3 verification records");

    // Verify data is cleaned up
    let stats = analytics.get_verification_stats(0, Utc::now().timestamp()).await;
    assert_eq!(stats.total_verifications, 0, "Should have no verifications after cleanup");
}

#[tokio::test]
async fn test_strict_mode_verification() {
    let engine = VerificationEngine::new().await.unwrap();
    let proof_pack = create_test_proof_pack();
    let verifier_info = create_test_verifier_info();
    
    let mut config = create_test_verification_config();
    config.strict_mode = true;

    let request = VerificationRequest {
        proof_pack,
        config,
        verifier_info,
    };

    let result = engine.verify_proof_pack(request).await;
    assert!(result.is_ok(), "Strict mode verification should succeed: {:?}", result.err());

    let verification_result = result.unwrap();
    
    // In strict mode, warnings should affect the trust score more significantly
    // and may cause the verification to be marked as invalid
    if !verification_result.warnings.is_empty() {
        assert!(verification_result.trust_score < 100.0, "Trust score should be reduced for warnings in strict mode");
    }
}

#[tokio::test]
async fn test_invalid_proof_pack_verification() {
    let engine = VerificationEngine::new().await.unwrap();
    let mut proof_pack = create_test_proof_pack();
    
    // Make the proof pack invalid
    proof_pack.id = "".to_string(); // Empty ID should cause validation failure
    
    let verifier_info = create_test_verifier_info();
    let config = create_test_verification_config();

    let request = VerificationRequest {
        proof_pack,
        config,
        verifier_info,
    };

    let result = engine.verify_proof_pack(request).await;
    assert!(result.is_ok(), "Should return a result even for invalid proof pack");

    let verification_result = result.unwrap();
    assert!(!verification_result.is_valid, "Invalid proof pack should fail verification");
    assert!(!verification_result.errors.is_empty(), "Should have error messages");
    assert!(verification_result.trust_score < 100.0, "Trust score should be reduced");
}

#[tokio::test]
async fn test_concurrent_verifications() {
    let engine = std::sync::Arc::new(VerificationEngine::new().await.unwrap());
    let mut handles = vec![];

    // Start multiple concurrent verifications
    for i in 0..5 {
        let engine_clone = engine.clone();
        let handle = tokio::spawn(async move {
            let mut proof_pack = create_test_proof_pack();
            proof_pack.id = format!("concurrent_proof_pack_{}", i);
            
            let verifier_info = create_test_verifier_info();
            let config = create_test_verification_config();

            let request = VerificationRequest {
                proof_pack,
                config,
                verifier_info,
            };

            engine_clone.verify_proof_pack(request).await
        });
        handles.push(handle);
    }

    // Wait for all verifications to complete
    let results = futures::future::join_all(handles).await;
    
    for (i, result) in results.into_iter().enumerate() {
        assert!(result.is_ok(), "Task {} should complete successfully", i);
        let verification_result = result.unwrap();
        assert!(verification_result.is_ok(), "Verification {} should succeed", i);
    }
}