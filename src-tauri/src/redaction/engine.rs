use serde::{Deserialize, Serialize};
use crate::redaction::{
    commitment::{CommitmentGenerator, RedactionCommitment},
    proofs::{ProofGenerator, RedactionData, RedactionArea, PartialVerificationResult},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactionPlan {
    pub proof_pack_id: String,
    pub areas: Vec<RedactionArea>,
    pub estimated_impact: RedactionImpact,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactionImpact {
    pub verification_capability: String, // "full", "partial", "limited"
    pub affected_sessions: Vec<String>,
    pub critical_data_removed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactedProofPack {
    pub original_id: String,
    pub redacted_id: String,
    pub redaction_data: RedactionData,
    pub partial_verification_capable: bool,
}

pub struct RedactionEngine;

impl RedactionEngine {
    /// Apply redactions to a proof pack based on the redaction plan
    pub fn apply_redactions(
        plan: &RedactionPlan,
        redaction_data: &RedactionData,
    ) -> Result<RedactedProofPack, String> {
        // Validate the redaction plan
        Self::validate_redaction_plan(plan)?;
        
        // Verify redaction data integrity
        let integrity_valid = ProofGenerator::verify_redaction_integrity(redaction_data)?;
        if !integrity_valid {
            return Err("Redaction data integrity check failed".to_string());
        }
        
        // Generate redacted proof pack ID
        let redacted_id = format!("redacted-{}-{}", plan.proof_pack_id, chrono::Utc::now().timestamp());
        
        // Determine if partial verification is possible
        let partial_verification_capable = match plan.estimated_impact.verification_capability.as_str() {
            "limited" => false,
            _ => true,
        };
        
        Ok(RedactedProofPack {
            original_id: plan.proof_pack_id.clone(),
            redacted_id,
            redaction_data: redaction_data.clone(),
            partial_verification_capable,
        })
    }
    
    /// Validate redaction integrity for a redacted proof pack
    pub fn validate_redaction_integrity(redacted_pack: &RedactedProofPack) -> Result<bool, String> {
        // Verify basic structure
        if redacted_pack.original_id.is_empty() || redacted_pack.redacted_id.is_empty() {
            return Ok(false);
        }
        
        // Verify redaction data integrity
        let data_integrity = ProofGenerator::verify_redaction_integrity(&redacted_pack.redaction_data)?;
        if !data_integrity {
            return Ok(false);
        }
        
        // Verify all commitment proofs
        for proof_data in &redacted_pack.redaction_data.proofs {
            let commitment = RedactionCommitment {
                area_id: proof_data.area_id.clone(),
                commitment_hash: proof_data.commitment_hash.clone(),
                proof: proof_data.proof.clone(),
                algorithm: proof_data.algorithm.clone(),
            };
            
            let proof_valid = CommitmentGenerator::verify_commitment_proof(&commitment)?;
            if !proof_valid {
                return Ok(false);
            }
        }
        
        // Verify hash consistency
        Self::verify_hash_consistency(&redacted_pack.redaction_data)?;
        
        Ok(true)
    }
    
    /// Generate a commitment proof for a redaction area
    pub fn generate_commitment_proof(
        area_id: &str,
        area_data: &[u8],
        algorithm: &str,
    ) -> Result<String, String> {
        CommitmentGenerator::generate_commitment_proof(area_id, area_data, algorithm)
    }
    
    /// Verify a commitment proof
    pub fn verify_commitment_proof(proof: &RedactionCommitment) -> Result<bool, String> {
        CommitmentGenerator::verify_commitment_proof(proof)
    }
    
    /// Verify a redacted proof pack and generate partial verification result
    pub fn verify_redacted_pack(pack: &RedactedProofPack) -> Result<PartialVerificationResult, String> {
        // First validate integrity
        let integrity_valid = Self::validate_redaction_integrity(pack)?;
        if !integrity_valid {
            return Ok(PartialVerificationResult {
                verifiable_portions: 0,
                redacted_portions: pack.redaction_data.areas.len(),
                overall_trust_score: 0.0,
                redaction_integrity: false,
            });
        }
        
        // Count verified proofs
        let mut verified_proofs = 0;
        for proof_data in &pack.redaction_data.proofs {
            let commitment = RedactionCommitment {
                area_id: proof_data.area_id.clone(),
                commitment_hash: proof_data.commitment_hash.clone(),
                proof: proof_data.proof.clone(),
                algorithm: proof_data.algorithm.clone(),
            };
            
            match CommitmentGenerator::verify_commitment_proof(&commitment) {
                Ok(true) => verified_proofs += 1,
                _ => continue,
            }
        }
        
        // Generate partial verification result
        ProofGenerator::generate_partial_verification(&pack.redaction_data, verified_proofs)
    }
    
    /// Validate a redaction plan before applying it
    fn validate_redaction_plan(plan: &RedactionPlan) -> Result<(), String> {
        if plan.proof_pack_id.is_empty() {
            return Err("Proof pack ID cannot be empty".to_string());
        }
        
        if plan.areas.is_empty() {
            return Err("No redaction areas specified".to_string());
        }
        
        // Validate each redaction area
        for area in &plan.areas {
            if area.id.is_empty() {
                return Err("Redaction area ID cannot be empty".to_string());
            }
            
            if area.session_id.is_empty() {
                return Err("Session ID cannot be empty".to_string());
            }
            
            // Validate coordinates if present
            if let Some(coords) = &area.coordinates {
                if coords.width <= 0.0 || coords.height <= 0.0 {
                    return Err("Redaction area dimensions must be positive".to_string());
                }
            }
        }
        
        Ok(())
    }
    
    /// Verify hash consistency in redaction data
    fn verify_hash_consistency(redaction_data: &RedactionData) -> Result<bool, String> {
        // Verify hash formats
        if !Self::is_valid_hash(&redaction_data.original_hash) {
            return Ok(false);
        }
        
        if !Self::is_valid_hash(&redaction_data.redacted_hash) {
            return Ok(false);
        }
        
        // Verify hashes are different (redaction should change the hash)
        if redaction_data.original_hash == redaction_data.redacted_hash {
            return Ok(false);
        }
        
        Ok(true)
    }
    
    /// Check if a string is a valid SHA-256 hash
    fn is_valid_hash(hash: &str) -> bool {
        hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit())
    }
    
    /// Get redaction engine capabilities
    pub fn get_capabilities() -> RedactionCapabilities {
        RedactionCapabilities {
            supported_types: vec![
                "rectangle".to_string(),
                "freeform".to_string(),
                "text_pattern".to_string(),
            ],
            zero_knowledge_proofs: true,
            partial_verification: true,
            commitment_schemes: vec![
                "Pedersen".to_string(),
                "KZG".to_string(),
            ],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactionCapabilities {
    pub supported_types: Vec<String>,
    pub zero_knowledge_proofs: bool,
    pub partial_verification: bool,
    pub commitment_schemes: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::redaction::proofs::{RedactionProofData, Rectangle};
    
    #[test]
    fn test_redaction_plan_validation() {
        let valid_plan = RedactionPlan {
            proof_pack_id: "test-pack-123".to_string(),
            areas: vec![
                RedactionArea {
                    id: "area1".to_string(),
                    area_type: "rectangle".to_string(),
                    coordinates: Some(Rectangle {
                        x: 10.0,
                        y: 10.0,
                        width: 100.0,
                        height: 50.0,
                    }),
                    pattern: None,
                    session_id: "session1".to_string(),
                    timestamp: chrono::Utc::now().timestamp(),
                    reason: "Personal information".to_string(),
                }
            ],
            estimated_impact: RedactionImpact {
                verification_capability: "partial".to_string(),
                affected_sessions: vec!["session1".to_string()],
                critical_data_removed: false,
            },
            warnings: vec![],
        };
        
        assert!(RedactionEngine::validate_redaction_plan(&valid_plan).is_ok());
        
        // Test invalid plan
        let invalid_plan = RedactionPlan {
            proof_pack_id: "".to_string(),
            areas: vec![],
            estimated_impact: RedactionImpact {
                verification_capability: "full".to_string(),
                affected_sessions: vec![],
                critical_data_removed: false,
            },
            warnings: vec![],
        };
        
        assert!(RedactionEngine::validate_redaction_plan(&invalid_plan).is_err());
    }
    
    #[test]
    fn test_apply_redactions() {
        let plan = RedactionPlan {
            proof_pack_id: "test-pack-123".to_string(),
            areas: vec![
                RedactionArea {
                    id: "area1".to_string(),
                    area_type: "rectangle".to_string(),
                    coordinates: Some(Rectangle {
                        x: 10.0,
                        y: 10.0,
                        width: 100.0,
                        height: 50.0,
                    }),
                    pattern: None,
                    session_id: "session1".to_string(),
                    timestamp: chrono::Utc::now().timestamp(),
                    reason: "Personal information".to_string(),
                }
            ],
            estimated_impact: RedactionImpact {
                verification_capability: "partial".to_string(),
                affected_sessions: vec!["session1".to_string()],
                critical_data_removed: false,
            },
            warnings: vec![],
        };
        
        let redaction_data = RedactionData {
            areas: plan.areas.clone(),
            proofs: vec![
                RedactionProofData {
                    area_id: "area1".to_string(),
                    commitment_hash: "a".repeat(64),
                    proof: "test_proof".to_string(),
                    algorithm: "Pedersen".to_string(),
                }
            ],
            redacted_hash: "a".repeat(64),
            original_hash: "b".repeat(64),
            redaction_time: chrono::Utc::now().timestamp(),
        };
        
        let result = RedactionEngine::apply_redactions(&plan, &redaction_data);
        assert!(result.is_ok());
        
        let redacted_pack = result.unwrap();
        assert_eq!(redacted_pack.original_id, "test-pack-123");
        assert!(redacted_pack.redacted_id.starts_with("redacted-test-pack-123"));
        assert!(redacted_pack.partial_verification_capable);
    }
}