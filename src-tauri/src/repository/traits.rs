//! Repository trait definitions
//!
//! These traits define the abstract interfaces for data access operations.
//! Different implementations can provide different storage backends.

use crate::error::NotariResult;
use crate::evidence::blockchain::{AnchorProof, BlockchainConfig};
use crate::recording_manager::RecordingPreferences;
use std::collections::HashMap;

/// Repository for blockchain configuration
///
/// Implementations can use different storage backends (file, database, cloud, etc.)
pub trait ConfigRepository: Send + Sync {
    /// Save blockchain configuration
    fn save_config(&self, config: &BlockchainConfig) -> NotariResult<()>;

    /// Load blockchain configuration
    fn load_config(&self) -> NotariResult<Option<BlockchainConfig>>;

    /// Delete blockchain configuration
    fn delete_config(&self) -> NotariResult<()>;

    /// Check if configuration exists
    fn has_config(&self) -> NotariResult<bool> {
        Ok(self.load_config()?.is_some())
    }
}

/// Repository for recording preferences
///
/// Implementations can use different storage backends (file, database, cloud, etc.)
pub trait PreferencesRepository: Send + Sync {
    /// Save recording preferences
    fn save_preferences(&self, preferences: &RecordingPreferences) -> NotariResult<()>;

    /// Load recording preferences
    fn load_preferences(&self) -> NotariResult<Option<RecordingPreferences>>;

    /// Delete recording preferences
    fn delete_preferences(&self) -> NotariResult<()>;

    /// Check if preferences exist
    fn has_preferences(&self) -> NotariResult<bool> {
        Ok(self.load_preferences()?.is_some())
    }
}

/// Repository for blockchain anchor proofs
///
/// Used primarily for mock anchors during development/testing.
/// Production anchors are stored on-chain and verified through blockchain queries.
pub trait AnchorRepository: Send + Sync {
    /// Save anchor proof for a hash
    fn save_anchor(&self, hash: &str, proof: &AnchorProof) -> NotariResult<()>;

    /// Load anchor proof for a hash
    fn load_anchor(&self, hash: &str) -> NotariResult<Option<AnchorProof>>;

    /// Load all anchors
    fn load_all_anchors(&self) -> NotariResult<HashMap<String, AnchorProof>>;

    /// Delete anchor proof for a hash
    fn delete_anchor(&self, hash: &str) -> NotariResult<()>;

    /// Clear all anchors
    fn clear_all_anchors(&self) -> NotariResult<()>;

    /// Check if anchor exists for a hash
    fn has_anchor(&self, hash: &str) -> NotariResult<bool> {
        Ok(self.load_anchor(hash)?.is_some())
    }

    /// Count total anchors
    fn count_anchors(&self) -> NotariResult<usize> {
        Ok(self.load_all_anchors()?.len())
    }
}

/// Repository for cryptographic keys
///
/// Implementations should use secure storage (keychain, HSM, etc.)
pub trait KeyRepository: Send + Sync {
    /// Store a key with a given identifier
    fn store_key(&self, key_id: &str, key_bytes: &[u8]) -> NotariResult<()>;

    /// Retrieve a key by identifier
    fn retrieve_key(&self, key_id: &str) -> NotariResult<Vec<u8>>;

    /// Delete a key by identifier
    fn delete_key(&self, key_id: &str) -> NotariResult<()>;

    /// Check if a key exists
    fn has_key(&self, key_id: &str) -> NotariResult<bool>;

    /// List all key identifiers
    fn list_keys(&self) -> NotariResult<Vec<String>>;
}

#[cfg(test)]
mod tests {
    use super::*;

    // Mock implementation for testing
    struct MockConfigRepository {
        config: std::sync::Mutex<Option<BlockchainConfig>>,
    }

    impl MockConfigRepository {
        fn new() -> Self {
            Self {
                config: std::sync::Mutex::new(None),
            }
        }
    }

    impl ConfigRepository for MockConfigRepository {
        fn save_config(&self, config: &BlockchainConfig) -> NotariResult<()> {
            *self.config.lock().unwrap() = Some(config.clone());
            Ok(())
        }

        fn load_config(&self) -> NotariResult<Option<BlockchainConfig>> {
            Ok(self.config.lock().unwrap().clone())
        }

        fn delete_config(&self) -> NotariResult<()> {
            *self.config.lock().unwrap() = None;
            Ok(())
        }
    }

    #[test]
    fn test_config_repository_trait() {
        use crate::evidence::blockchain::{BlockchainEnvironment, ChainConfig};

        let repo = MockConfigRepository::new();

        // Initially no config
        assert!(!repo.has_config().unwrap());

        // Save config
        let config = BlockchainConfig {
            enabled: true,
            environment: BlockchainEnvironment::Mock,
            chain: ChainConfig {
                chain_id: 1,
                name: "Test".to_string(),
                rpc_url: "".to_string(),
                contract_address: "".to_string(),
                explorer_url: "".to_string(),
                currency_symbol: "ETH".to_string(),
            },
            auto_anchor: false,
            wallet: None,
        };

        repo.save_config(&config).unwrap();

        // Config should exist
        assert!(repo.has_config().unwrap());

        // Load config
        let loaded = repo.load_config().unwrap();
        assert!(loaded.is_some());
        assert_eq!(loaded.unwrap().enabled, true);

        // Delete config
        repo.delete_config().unwrap();
        assert!(!repo.has_config().unwrap());
    }

    #[test]
    fn test_anchor_repository_default_methods() {
        struct MockAnchorRepo;

        impl AnchorRepository for MockAnchorRepo {
            fn save_anchor(&self, _hash: &str, _proof: &AnchorProof) -> NotariResult<()> {
                Ok(())
            }

            fn load_anchor(&self, _hash: &str) -> NotariResult<Option<AnchorProof>> {
                Ok(None)
            }

            fn load_all_anchors(&self) -> NotariResult<HashMap<String, AnchorProof>> {
                Ok(HashMap::new())
            }

            fn delete_anchor(&self, _hash: &str) -> NotariResult<()> {
                Ok(())
            }

            fn clear_all_anchors(&self) -> NotariResult<()> {
                Ok(())
            }
        }

        let repo = MockAnchorRepo;

        // Test default implementations
        assert!(!repo.has_anchor("test").unwrap());
        assert_eq!(repo.count_anchors().unwrap(), 0);
    }
}
