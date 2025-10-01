use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Blockchain anchor information stored in manifest
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockchainAnchor {
    /// When the anchor was created
    pub anchored_at: DateTime<Utc>,
    
    /// The hash that was anchored (may be hash-of-hash for privacy)
    pub anchored_hash: String,
    
    /// The original manifest hash (for verification)
    pub manifest_hash: String,
    
    /// The blockchain proof
    pub proof: AnchorProof,
}

/// Proof of blockchain anchoring
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AnchorProof {
    /// Mock proof for testing
    Mock {
        hash: String,
        timestamp: DateTime<Utc>,
    },
    
    /// Ethereum-compatible blockchain proof
    Ethereum {
        chain_id: u64,
        chain_name: String,
        tx_hash: String,
        contract_address: String,
        block_number: u64,
        explorer_url: String,
    },
    
    /// OpenTimestamps proof (future)
    #[allow(dead_code)]
    OpenTimestamps {
        ots_proof: String,
        bitcoin_block: u64,
    },
}

impl AnchorProof {
    /// Get a human-readable description of the proof
    pub fn description(&self) -> String {
        match self {
            AnchorProof::Mock { .. } => "Mock (Development)".to_string(),
            AnchorProof::Ethereum { chain_name, .. } => format!("Ethereum ({})", chain_name),
            AnchorProof::OpenTimestamps { .. } => "OpenTimestamps (Bitcoin)".to_string(),
        }
    }
    
    /// Get the blockchain explorer URL if available
    pub fn explorer_url(&self) -> Option<String> {
        match self {
            AnchorProof::Ethereum { explorer_url, .. } => Some(explorer_url.clone()),
            _ => None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_anchor_proof_serialization() {
        let proof = AnchorProof::Mock {
            hash: "abc123".to_string(),
            timestamp: Utc::now(),
        };
        
        let json = serde_json::to_string(&proof).unwrap();
        let deserialized: AnchorProof = serde_json::from_str(&json).unwrap();
        
        match deserialized {
            AnchorProof::Mock { hash, .. } => assert_eq!(hash, "abc123"),
            _ => panic!("Wrong proof type"),
        }
    }
    
    #[test]
    fn test_blockchain_anchor_serialization() {
        let anchor = BlockchainAnchor {
            anchored_at: Utc::now(),
            anchored_hash: "hash123".to_string(),
            manifest_hash: "manifest456".to_string(),
            proof: AnchorProof::Mock {
                hash: "hash123".to_string(),
                timestamp: Utc::now(),
            },
        };
        
        let json = serde_json::to_string(&anchor).unwrap();
        let deserialized: BlockchainAnchor = serde_json::from_str(&json).unwrap();
        
        assert_eq!(deserialized.anchored_hash, "hash123");
        assert_eq!(deserialized.manifest_hash, "manifest456");
    }
}

