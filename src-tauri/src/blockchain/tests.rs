#[cfg(test)]
mod tests {
    use super::*;
    use crate::blockchain::{
        anchor::BlockchainAnchor,
        merkle::MerkleTree,
        types::{AnchorMetadata, BlockchainNetwork, TransactionConfig, TransactionPriority},
    };
    use std::collections::HashMap;
    use tokio;

    fn create_test_metadata() -> AnchorMetadata {
        let mut tags = HashMap::new();
        tags.insert("type".to_string(), "test".to_string());
        tags.insert("version".to_string(), "1.0".to_string());

        AnchorMetadata {
            proof_pack_id: "test_pack_123".to_string(),
            creator: "test_user".to_string(),
            timestamp: 1234567890,
            content_hash: "test_content_hash".to_string(),
            tags,
        }
    }

    fn create_test_config(network: BlockchainNetwork) -> TransactionConfig {
        TransactionConfig {
            network,
            max_retries: 3,
            retry_delay_ms: 1000,
            max_fee: Some(1000000),
            priority: TransactionPriority::Medium,
        }
    }

    #[tokio::test]
    async fn test_blockchain_anchor_initialization() {
        let result = BlockchainAnchor::new().await;
        assert!(result.is_ok(), "BlockchainAnchor should initialize successfully");
    }

    #[tokio::test]
    async fn test_supported_networks() {
        let anchor = BlockchainAnchor::new().await.unwrap();
        let networks = anchor.get_supported_networks().await;
        
        assert!(!networks.is_empty(), "Should have supported networks");
        assert!(networks.contains(&BlockchainNetwork::Arweave));
        assert!(networks.contains(&BlockchainNetwork::Ethereum));
    }

    #[tokio::test]
    async fn test_merkle_tree_functionality() {
        let data = vec!["hash1", "hash2", "hash3", "hash4"];
        let tree = MerkleTree::new(data).unwrap();
        
        // Test proof generation and verification
        for i in 0..4 {
            let proof = tree.generate_proof(i).unwrap();
            assert!(MerkleTree::verify_proof(&proof).unwrap());
        }
    }

    #[tokio::test]
    async fn test_merkle_tree_odd_number_of_leaves() {
        let data = vec!["hash1", "hash2", "hash3"];
        let tree = MerkleTree::new(data).unwrap();
        
        let proof = tree.generate_proof(1).unwrap();
        assert!(MerkleTree::verify_proof(&proof).unwrap());
    }

    #[tokio::test]
    async fn test_merkle_tree_single_leaf() {
        let data = vec!["single_hash"];
        let tree = MerkleTree::new(data).unwrap();
        
        let proof = tree.generate_proof(0).unwrap();
        assert!(MerkleTree::verify_proof(&proof).unwrap());
    }

    #[tokio::test]
    async fn test_invalid_merkle_proof() {
        let data = vec!["hash1", "hash2", "hash3", "hash4"];
        let tree = MerkleTree::new(data).unwrap();
        
        let mut proof = tree.generate_proof(0).unwrap();
        proof.leaf = "invalid_hash".to_string();
        
        assert!(!MerkleTree::verify_proof(&proof).unwrap());
    }

    #[test]
    fn test_transaction_config_creation() {
        let config = TransactionConfig {
            network: BlockchainNetwork::Arweave,
            max_retries: 5,
            retry_delay_ms: 2000,
            max_fee: Some(500000),
            priority: TransactionPriority::High,
        };

        assert_eq!(config.network, BlockchainNetwork::Arweave);
        assert_eq!(config.max_retries, 5);
        assert_eq!(config.retry_delay_ms, 2000);
        assert_eq!(config.max_fee, Some(500000));
        assert!(matches!(config.priority, TransactionPriority::High));
    }

    #[test]
    fn test_anchor_metadata_creation() {
        let metadata = create_test_metadata();
        
        assert_eq!(metadata.proof_pack_id, "test_pack_123");
        assert_eq!(metadata.creator, "test_user");
        assert_eq!(metadata.timestamp, 1234567890);
        assert_eq!(metadata.content_hash, "test_content_hash");
        assert_eq!(metadata.tags.get("type"), Some(&"test".to_string()));
    }

    #[test]
    fn test_blockchain_network_string_conversion() {
        assert_eq!(BlockchainNetwork::Arweave.as_str(), "arweave");
        assert_eq!(BlockchainNetwork::Ethereum.as_str(), "ethereum");
        assert_eq!(BlockchainNetwork::EthereumTestnet.as_str(), "ethereum-testnet");
        assert_eq!(BlockchainNetwork::ArweaveTestnet.as_str(), "arweave-testnet");
    }

    #[test]
    fn test_blockchain_network_testnet_detection() {
        assert!(!BlockchainNetwork::Arweave.is_testnet());
        assert!(!BlockchainNetwork::Ethereum.is_testnet());
        assert!(BlockchainNetwork::EthereumTestnet.is_testnet());
        assert!(BlockchainNetwork::ArweaveTestnet.is_testnet());
    }

    #[tokio::test]
    async fn test_network_failure_handling() {
        // Test with invalid network configuration
        let anchor = BlockchainAnchor::new().await.unwrap();
        let metadata = create_test_metadata();
        
        // This should handle network failures gracefully
        let result = anchor.anchor_hash("test_hash", &metadata, None).await;
        
        // In a real test environment, this might succeed or fail depending on network setup
        // The important thing is that it doesn't panic
        match result {
            Ok(_) => println!("Anchor succeeded (test network available)"),
            Err(e) => println!("Anchor failed as expected: {}", e),
        }
    }

    #[tokio::test]
    async fn test_batch_anchoring_empty_list() {
        let anchor = BlockchainAnchor::new().await.unwrap();
        let metadata = create_test_metadata();
        
        let result = anchor.anchor_batch(vec![], &metadata, None).await;
        assert!(result.is_err(), "Should fail with empty batch");
    }

    #[tokio::test]
    async fn test_merkle_proof_generation_for_nonexistent_hash() {
        let anchor = BlockchainAnchor::new().await.unwrap();
        
        let result = anchor.generate_merkle_proof("nonexistent_hash", "fake_anchor_id").await;
        assert!(result.is_err(), "Should fail for nonexistent Merkle tree");
    }

    #[test]
    fn test_transaction_priority_ordering() {
        use crate::blockchain::arweave::calculate_optimal_fee;
        use crate::blockchain::types::TransactionPriority;
        
        let base_price = 1000;
        let congestion = 0.5;
        
        let low_fee = calculate_optimal_fee(base_price, congestion, &TransactionPriority::Low);
        let medium_fee = calculate_optimal_fee(base_price, congestion, &TransactionPriority::Medium);
        let high_fee = calculate_optimal_fee(base_price, congestion, &TransactionPriority::High);
        let urgent_fee = calculate_optimal_fee(base_price, congestion, &TransactionPriority::Urgent);
        
        assert!(low_fee <= medium_fee);
        assert!(medium_fee <= high_fee);
        assert!(high_fee <= urgent_fee);
    }

    #[tokio::test]
    async fn test_concurrent_anchoring() {
        let anchor = BlockchainAnchor::new().await.unwrap();
        let metadata = create_test_metadata();
        
        // Test concurrent anchor operations
        let futures = (0..5).map(|i| {
            let anchor = &anchor;
            let metadata = metadata.clone();
            async move {
                anchor.anchor_hash(&format!("test_hash_{}", i), &metadata, None).await
            }
        });
        
        let results = futures::future::join_all(futures).await;
        
        // All operations should complete (success or failure, but no panics)
        assert_eq!(results.len(), 5);
    }

    #[test]
    fn test_error_types() {
        use crate::blockchain::types::BlockchainError;
        
        let network_error = BlockchainError::NetworkError("Connection failed".to_string());
        assert!(network_error.to_string().contains("Network error"));
        
        let insufficient_funds = BlockchainError::InsufficientFunds {
            required: 1000,
            available: 500,
        };
        assert!(insufficient_funds.to_string().contains("Insufficient funds"));
        
        let timeout_error = BlockchainError::Timeout { timeout_ms: 30000 };
        assert!(timeout_error.to_string().contains("Timeout"));
    }

    #[tokio::test]
    async fn test_network_stats_retrieval() {
        let anchor = BlockchainAnchor::new().await.unwrap();
        
        // Test getting stats for each supported network
        let networks = anchor.get_supported_networks().await;
        
        for network in networks {
            let result = anchor.get_network_stats(network.clone()).await;
            match result {
                Ok(stats) => {
                    assert_eq!(stats.network, network);
                    println!("Stats for {:?}: {:?}", network, stats);
                }
                Err(e) => {
                    println!("Failed to get stats for {:?}: {}", network, e);
                }
            }
        }
    }

    #[test]
    fn test_default_transaction_config() {
        let config = TransactionConfig::default();
        
        assert_eq!(config.network, BlockchainNetwork::Arweave);
        assert_eq!(config.max_retries, 3);
        assert_eq!(config.retry_delay_ms, 1000);
        assert_eq!(config.max_fee, None);
        assert!(matches!(config.priority, TransactionPriority::Medium));
    }
}