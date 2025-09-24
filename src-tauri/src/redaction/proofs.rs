use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use blake3;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactionProofData {
    pub area_id: String,
    pub commitment_hash: String,
    pub proof: String,
    pub algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactionArea {
    pub id: String,
    pub area_type: String,
    pub coordinates: Option<Rectangle>,
    pub pattern: Option<String>,
    pub session_id: String,
    pub timestamp: i64,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Rectangle {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RedactionData {
    pub areas: Vec<RedactionArea>,
    pub proofs: Vec<RedactionProofData>,
    pub redacted_hash: String,
    pub original_hash: String,
    pub redaction_time: i64,
}

pub struct ProofGenerator;

impl ProofGenerator {
    /// Generate separate hashes for redacted and non-redacted portions
    pub fn generate_separate_hashes(
        original_data: &[u8],
        redacted_areas: &[RedactionArea],
    ) -> Result<(String, String), String> {
        // Generate original hash
        let mut original_hasher = Sha256::new();
        original_hasher.update(original_data);
        let original_hash = hex::encode(original_hasher.finalize());
        
        // Create redacted version by replacing sensitive areas with placeholders
        let redacted_data = Self::apply_redaction_placeholders(original_data, redacted_areas)?;
        
        // Generate redacted hash
        let mut redacted_hasher = Sha256::new();
        redacted_hasher.update(&redacted_data);
        let redacted_hash = hex::encode(redacted_hasher.finalize());
        
        Ok((original_hash, redacted_hash))
    }
    
    /// Apply redaction placeholders to data
    fn apply_redaction_placeholders(
        data: &[u8],
        areas: &[RedactionArea],
    ) -> Result<Vec<u8>, String> {
        let mut redacted_data = data.to_vec();
        
        // For each redaction area, replace with a deterministic placeholder
        for area in areas {
            let placeholder = Self::generate_redaction_placeholder(area)?;
            
            // In a real implementation, this would apply spatial redactions
            // For now, we'll create a deterministic transformation
            let area_hash = Self::hash_redaction_area(area)?;
            let area_bytes = area_hash.as_bytes();
            
            // Replace a portion of the data with the placeholder
            let start_pos = (area.timestamp as usize) % redacted_data.len().max(1);
            let end_pos = (start_pos + area_bytes.len()).min(redacted_data.len());
            
            for (i, &byte) in area_bytes.iter().enumerate() {
                if start_pos + i < end_pos {
                    redacted_data[start_pos + i] = byte ^ 0xFF; // XOR with 0xFF as redaction
                }
            }
        }
        
        Ok(redacted_data)
    }
    
    /// Generate a deterministic placeholder for a redaction area
    fn generate_redaction_placeholder(area: &RedactionArea) -> Result<Vec<u8>, String> {
        let placeholder_data = serde_json::json!({
            "type": "redacted",
            "area_id": area.id,
            "timestamp": area.timestamp,
            "reason": area.reason,
        });
        
        let mut hasher = blake3::Hasher::new();
        hasher.update(placeholder_data.to_string().as_bytes());
        Ok(hasher.finalize().as_bytes().to_vec())
    }
    
    /// Generate a hash for a redaction area
    fn hash_redaction_area(area: &RedactionArea) -> Result<String, String> {
        let area_data = serde_json::to_string(area)
            .map_err(|e| format!("Failed to serialize area: {}", e))?;
        
        let mut hasher = Sha256::new();
        hasher.update(area_data.as_bytes());
        Ok(hex::encode(hasher.finalize()))
    }
    
    /// Verify the integrity of redaction proofs
    pub fn verify_redaction_integrity(redaction_data: &RedactionData) -> Result<bool, String> {
        // Verify that we have proofs for all areas
        if redaction_data.areas.len() != redaction_data.proofs.len() {
            return Ok(false);
        }
        
        // Verify each proof corresponds to an area
        for proof in &redaction_data.proofs {
            let area_exists = redaction_data.areas.iter()
                .any(|area| area.id == proof.area_id);
            
            if !area_exists {
                return Ok(false);
            }
        }
        
        // Verify hash formats
        if !Self::is_valid_hash(&redaction_data.original_hash) ||
           !Self::is_valid_hash(&redaction_data.redacted_hash) {
            return Ok(false);
        }
        
        // Verify timestamp is reasonable (within last 24 hours)
        let current_time = chrono::Utc::now().timestamp();
        let time_diff = current_time - redaction_data.redaction_time;
        
        if time_diff < 0 || time_diff > 24 * 60 * 60 {
            return Ok(false);
        }
        
        Ok(true)
    }
    
    /// Check if a string is a valid hash
    fn is_valid_hash(hash: &str) -> bool {
        hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit())
    }
    
    /// Generate a partial verification result
    pub fn generate_partial_verification(
        redaction_data: &RedactionData,
        verified_proofs: usize,
    ) -> Result<PartialVerificationResult, String> {
        let total_areas = redaction_data.areas.len();
        let redacted_portions = total_areas;
        let verifiable_portions = verified_proofs;
        
        // Calculate trust score based on verification ratio
        let verification_ratio = if total_areas > 0 {
            verifiable_portions as f64 / total_areas as f64
        } else {
            1.0
        };
        
        let overall_trust_score = match verification_ratio {
            r if r >= 0.9 => 0.95,
            r if r >= 0.7 => 0.8,
            r if r >= 0.5 => 0.6,
            r if r >= 0.3 => 0.4,
            _ => 0.2,
        };
        
        let redaction_integrity = Self::verify_redaction_integrity(redaction_data)?;
        
        Ok(PartialVerificationResult {
            verifiable_portions,
            redacted_portions,
            overall_trust_score,
            redaction_integrity,
        })
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartialVerificationResult {
    pub verifiable_portions: usize,
    pub redacted_portions: usize,
    pub overall_trust_score: f64,
    pub redaction_integrity: bool,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_separate_hash_generation() {
        let original_data = b"This is sensitive data that needs redaction";
        let areas = vec![
            RedactionArea {
                id: "area1".to_string(),
                area_type: "rectangle".to_string(),
                coordinates: Some(Rectangle { x: 10.0, y: 10.0, width: 100.0, height: 50.0 }),
                pattern: None,
                session_id: "session1".to_string(),
                timestamp: 1234567890,
                reason: "Personal information".to_string(),
            }
        ];
        
        let result = ProofGenerator::generate_separate_hashes(original_data, &areas);
        assert!(result.is_ok());
        
        let (original_hash, redacted_hash) = result.unwrap();
        assert_ne!(original_hash, redacted_hash);
        assert_eq!(original_hash.len(), 64);
        assert_eq!(redacted_hash.len(), 64);
    }
    
    #[test]
    fn test_redaction_integrity_verification() {
        let redaction_data = RedactionData {
            areas: vec![
                RedactionArea {
                    id: "area1".to_string(),
                    area_type: "rectangle".to_string(),
                    coordinates: None,
                    pattern: None,
                    session_id: "session1".to_string(),
                    timestamp: chrono::Utc::now().timestamp(),
                    reason: "Test".to_string(),
                }
            ],
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
        
        let result = ProofGenerator::verify_redaction_integrity(&redaction_data);
        assert!(result.is_ok());
        assert!(result.unwrap());
    }
    
    #[test]
    fn test_partial_verification_generation() {
        let redaction_data = RedactionData {
            areas: vec![
                RedactionArea {
                    id: "area1".to_string(),
                    area_type: "rectangle".to_string(),
                    coordinates: None,
                    pattern: None,
                    session_id: "session1".to_string(),
                    timestamp: chrono::Utc::now().timestamp(),
                    reason: "Test".to_string(),
                }
            ],
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
        
        let result = ProofGenerator::generate_partial_verification(&redaction_data, 1);
        assert!(result.is_ok());
        
        let verification = result.unwrap();
        assert_eq!(verification.verifiable_portions, 1);
        assert_eq!(verification.redacted_portions, 1);
        assert!(verification.overall_trust_score > 0.9);
        assert!(verification.redaction_integrity);
    }
}