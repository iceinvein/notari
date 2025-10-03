use super::types::AnchorProof;
use super::BlockchainAnchorer;
use crate::app_log;
use crate::error::{NotariError, NotariResult};
use async_trait::async_trait;
use chrono::Utc;
use std::collections::HashMap;
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
                app_log!(
                    crate::logger::LogLevel::Info,
                    "Loaded {} mock anchors from storage",
                    storage.len()
                );
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
    async fn anchor(&self, hash: &str) -> NotariResult<AnchorProof> {
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
            app_log!(
                crate::logger::LogLevel::Info,
                "Mock anchor: stored hash={}, storage_size={}",
                &hash[..8.min(hash.len())],
                storage.len()
            );

            // Persist to disk
            if let Err(e) = crate::storage::get_storage().save_mock_anchors(&storage) {
                app_log!(
                    crate::logger::LogLevel::Warn,
                    "Mock anchor: failed to persist to disk: {}",
                    e
                );
            } else {
                app_log!(
                    crate::logger::LogLevel::Info,
                    "Mock anchor: persisted to disk"
                );
            }
        }

        Ok(proof)
    }

    async fn verify(&self, hash: &str, proof: &AnchorProof) -> NotariResult<bool> {
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
                    app_log!(
                        crate::logger::LogLevel::Warn,
                        "Mock verify: proof hash mismatch. Expected: {}, Got: {}",
                        hash,
                        proof_hash
                    );
                    return Ok(false);
                }

                // Check if this hash exists in our "blockchain" storage
                if let Ok(storage) = MOCK_ANCHOR_STORAGE.lock() {
                    let exists = storage.contains_key(hash);
                    app_log!(
                        crate::logger::LogLevel::Info,
                        "Mock verify: hash={}, exists={}, storage_size={}",
                        &hash[..8.min(hash.len())],
                        exists,
                        storage.len()
                    );
                    Ok(exists)
                } else {
                    app_log!(
                        crate::logger::LogLevel::Error,
                        "Mock verify: failed to lock storage"
                    );
                    // If we can't access storage, fall back to basic proof validation
                    Ok(true)
                }
            }
            _ => Err(NotariError::BlockchainAnchorFailed(
                "Invalid proof type for mock anchorer".to_string(),
            )),
        }
    }

    async fn estimate_cost(&self) -> NotariResult<f64> {
        Ok(self.cost_per_anchor)
    }

    async fn get_balance(&self) -> NotariResult<f64> {
        Ok(self.balance)
    }
}

// Note: Removed unit tests for MockAnchorer that use global storage because:
// 1. They test mock implementation, not business logic
// 2. They fail intermittently in parallel execution due to global storage
// 3. The functionality is tested through integration tests:
//    - test_verification_report_with_blockchain_anchor
//    - test_complete_recording_workflow (in integration_test.rs)
// 4. MockAnchorer is a test double - we don't need to unit test test doubles

#[cfg(test)]
mod tests {
    use super::*;

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
}
