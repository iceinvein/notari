use super::types::AnchorProof;
use super::BlockchainAnchorer;
use async_trait::async_trait;
use chrono::Utc;
use std::error::Error;
use tokio::time::{sleep, Duration};

/// Mock blockchain anchorer for development and testing
/// 
/// This implementation simulates blockchain anchoring without any real
/// network calls or costs. It's useful for:
/// - Development and testing
/// - UI development
/// - Integration tests
/// - Demonstrating the feature without setup
pub struct MockAnchorer {
    /// Simulated network delay in milliseconds
    delay_ms: u64,
    
    /// Simulated balance in native currency
    balance: f64,
    
    /// Simulated cost per anchor in USD
    cost_per_anchor: f64,
}

impl MockAnchorer {
    /// Create a new mock anchorer with default settings
    pub fn new() -> Self {
        Self {
            delay_ms: 100,  // 100ms simulated delay
            balance: 10.0,  // 10 units of currency
            cost_per_anchor: 0.01,  // $0.01 per anchor
        }
    }
    
    /// Create a mock anchorer with custom settings
    pub fn with_settings(delay_ms: u64, balance: f64, cost_per_anchor: f64) -> Self {
        Self {
            delay_ms,
            balance,
            cost_per_anchor,
        }
    }
    
    /// Create a mock anchorer with instant responses (no delay)
    pub fn instant() -> Self {
        Self {
            delay_ms: 0,
            balance: 10.0,
            cost_per_anchor: 0.01,
        }
    }
}

impl Default for MockAnchorer {
    fn default() -> Self {
        Self::new()
    }
}

#[async_trait]
impl BlockchainAnchorer for MockAnchorer {
    async fn anchor(&self, hash: &str) -> Result<AnchorProof, Box<dyn Error>> {
        // Simulate network delay
        if self.delay_ms > 0 {
            sleep(Duration::from_millis(self.delay_ms)).await;
        }
        
        // Create mock proof
        let proof = AnchorProof::Mock {
            hash: hash.to_string(),
            timestamp: Utc::now(),
        };
        
        Ok(proof)
    }
    
    async fn verify(&self, hash: &str, proof: &AnchorProof) -> Result<bool, Box<dyn Error>> {
        // Simulate network delay
        if self.delay_ms > 0 {
            sleep(Duration::from_millis(self.delay_ms)).await;
        }
        
        // Verify the proof matches the hash
        match proof {
            AnchorProof::Mock { hash: proof_hash, .. } => {
                Ok(proof_hash == hash)
            }
            _ => Err("Invalid proof type for mock anchorer".into()),
        }
    }
    
    async fn estimate_cost(&self) -> Result<f64, Box<dyn Error>> {
        Ok(self.cost_per_anchor)
    }
    
    async fn get_balance(&self) -> Result<f64, Box<dyn Error>> {
        Ok(self.balance)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_mock_anchor() {
        let anchorer = MockAnchorer::instant();
        let hash = "abc123def456";
        
        let proof = anchorer.anchor(hash).await.unwrap();
        
        match proof {
            AnchorProof::Mock { hash: proof_hash, .. } => {
                assert_eq!(proof_hash, hash);
            }
            _ => panic!("Expected Mock proof"),
        }
    }
    
    #[tokio::test]
    async fn test_mock_verify() {
        let anchorer = MockAnchorer::instant();
        let hash = "abc123def456";
        
        let proof = anchorer.anchor(hash).await.unwrap();
        let verified = anchorer.verify(hash, &proof).await.unwrap();
        
        assert!(verified);
    }
    
    #[tokio::test]
    async fn test_mock_verify_wrong_hash() {
        let anchorer = MockAnchorer::instant();
        let hash = "abc123def456";
        let wrong_hash = "wrong_hash";
        
        let proof = anchorer.anchor(hash).await.unwrap();
        let verified = anchorer.verify(wrong_hash, &proof).await.unwrap();
        
        assert!(!verified);
    }
    
    #[tokio::test]
    async fn test_mock_estimate_cost() {
        let anchorer = MockAnchorer::with_settings(0, 10.0, 0.05);
        let cost = anchorer.estimate_cost().await.unwrap();
        
        assert_eq!(cost, 0.05);
    }
    
    #[tokio::test]
    async fn test_mock_get_balance() {
        let anchorer = MockAnchorer::with_settings(0, 15.5, 0.01);
        let balance = anchorer.get_balance().await.unwrap();
        
        assert_eq!(balance, 15.5);
    }
    
    #[tokio::test]
    async fn test_mock_with_delay() {
        let anchorer = MockAnchorer::with_settings(50, 10.0, 0.01);
        let hash = "test_hash";
        
        let start = std::time::Instant::now();
        let _proof = anchorer.anchor(hash).await.unwrap();
        let elapsed = start.elapsed();
        
        // Should take at least 50ms
        assert!(elapsed.as_millis() >= 50);
    }
}

