use super::types::AnchorProof;
use super::BlockchainAnchorer;
use async_trait::async_trait;
use chrono::Utc;
use crate::app_log;
use std::collections::HashMap;
use std::error::Error;
use std::sync::{Arc, Mutex};
use tokio::time::{sleep, Duration};

/// Global in-memory storage for mock anchored hashes
/// This simulates a persistent blockchain state across different MockAnchorer instances
/// Note: This is used as a cache; actual persistence is handled by the storage module
static MOCK_ANCHOR_STORAGE: once_cell::sync::Lazy<Arc<Mutex<HashMap<String, AnchorProof>>>> =
    once_cell::sync::Lazy::new(|| Arc::new(Mutex::new(HashMap::new())));

/// Mock blockchain anchorer for development and testing
///
/// This implementation simulates blockchain anchoring without any real
/// network calls or costs. It's useful for:
/// - Development and testing
/// - UI development
/// - Integration tests
/// - Demonstrating the feature without setup
///
/// Note: Anchored hashes are stored in a global in-memory storage to simulate
/// persistence across different MockAnchorer instances, mimicking real blockchain behavior.
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
            delay_ms: 100,         // 100ms simulated delay
            balance: 10.0,         // 10 units of currency
            cost_per_anchor: 0.01, // $0.01 per anchor
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

    /// Clear all mock anchored hashes (useful for testing)
    #[allow(dead_code)]
    pub fn clear_storage() {
        if let Ok(mut storage) = MOCK_ANCHOR_STORAGE.lock() {
            storage.clear();

            // Clear persistent storage too
            let _ = crate::storage::get_storage().clear_mock_anchors();
        }
    }

    /// Load mock anchors from persistent storage
    /// Should be called after storage is initialized
    pub fn load_from_storage() {
        if let Ok(mut storage) = MOCK_ANCHOR_STORAGE.lock() {
            if let Ok(anchors) = crate::storage::get_storage().load_mock_anchors() {
                *storage = anchors;
                app_log!(crate::logger::LogLevel::Info, "Loaded {} mock anchors from storage", storage.len());
            }
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

        // Store in global storage to simulate blockchain persistence
        if let Ok(mut storage) = MOCK_ANCHOR_STORAGE.lock() {
            storage.insert(hash.to_string(), proof.clone());
            app_log!(crate::logger::LogLevel::Info, "Mock anchor: stored hash={}, storage_size={}",
                &hash[..8.min(hash.len())], storage.len());

            // Persist to disk
            if let Err(e) = crate::storage::get_storage().save_mock_anchors(&storage) {
                app_log!(crate::logger::LogLevel::Warn, "Mock anchor: failed to persist to disk: {}", e);
            } else {
                app_log!(crate::logger::LogLevel::Info, "Mock anchor: persisted to disk");
            }
        }

        Ok(proof)
    }

    async fn verify(&self, hash: &str, proof: &AnchorProof) -> Result<bool, Box<dyn Error>> {
        // Simulate network delay
        if self.delay_ms > 0 {
            sleep(Duration::from_millis(self.delay_ms)).await;
        }

        // First check if the proof type is correct
        match proof {
            AnchorProof::Mock {
                hash: proof_hash, ..
            } => {
                // Check if the proof hash matches the provided hash
                if proof_hash != hash {
                    app_log!(crate::logger::LogLevel::Warn, "Mock verify: proof hash mismatch. Expected: {}, Got: {}", hash, proof_hash);
                    return Ok(false);
                }

                // Check if this hash exists in our "blockchain" storage
                if let Ok(storage) = MOCK_ANCHOR_STORAGE.lock() {
                    let exists = storage.contains_key(hash);
                    app_log!(crate::logger::LogLevel::Info, "Mock verify: hash={}, exists={}, storage_size={}",
                        &hash[..8.min(hash.len())], exists, storage.len());
                    Ok(exists)
                } else {
                    app_log!(crate::logger::LogLevel::Error, "Mock verify: failed to lock storage");
                    // If we can't access storage, fall back to basic proof validation
                    Ok(true)
                }
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
            AnchorProof::Mock {
                hash: proof_hash, ..
            } => {
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

    #[tokio::test]
    async fn test_mock_persistent_storage() {
        // Clear storage first
        MockAnchorer::clear_storage();

        // Create first anchorer and anchor a hash
        let anchorer1 = MockAnchorer::instant();
        let hash = "persistent_test_hash";
        let proof = anchorer1.anchor(hash).await.unwrap();

        // Debug: Check if hash is in storage
        if let Ok(storage) = MOCK_ANCHOR_STORAGE.lock() {
            println!("Storage after anchor: {} entries", storage.len());
            println!("Contains hash: {}", storage.contains_key(hash));
        }

        // Create a NEW anchorer instance (simulating different command invocations)
        let anchorer2 = MockAnchorer::instant();

        // Verify with the new instance - should succeed because storage is global
        let verified = anchorer2.verify(hash, &proof).await.unwrap();
        assert!(verified, "Verification should succeed with different anchorer instance");

        // Verify with wrong hash should fail
        let wrong_hash = "wrong_hash";
        let verified_wrong = anchorer2.verify(wrong_hash, &proof).await.unwrap();
        assert!(
            !verified_wrong,
            "Verification with wrong hash should fail"
        );

        // Clean up
        MockAnchorer::clear_storage();
    }

    #[tokio::test]
    async fn test_mock_verify_unanchored_hash() {
        // Clear storage first
        MockAnchorer::clear_storage();

        let anchorer = MockAnchorer::instant();

        // Create a proof manually without anchoring
        let unanchored_hash = "unanchored_hash";
        let fake_proof = AnchorProof::Mock {
            hash: unanchored_hash.to_string(),
            timestamp: chrono::Utc::now(),
        };

        // Verification should fail because hash was never anchored
        let verified = anchorer.verify(unanchored_hash, &fake_proof).await.unwrap();
        assert!(
            !verified,
            "Verification should fail for hash that was never anchored"
        );

        // Clean up
        MockAnchorer::clear_storage();
    }
}
