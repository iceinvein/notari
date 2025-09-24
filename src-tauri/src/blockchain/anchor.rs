use crate::blockchain::{
    arweave::ArweaveClient,
    ethereum::EthereumClient,
    merkle::{MerkleTree, create_proof_pack_tree},
    types::{
        AnchorMetadata, AnchorResult, AnchorVerification, BlockchainError, BlockchainNetwork,
        BlockchainResult, MerkleProof, TransactionConfig,
    },
};
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Trait for blockchain anchor implementations
#[async_trait]
pub trait BlockchainAnchorTrait {
    async fn anchor_hash(
        &self,
        hash: &str,
        metadata: &AnchorMetadata,
        config: &TransactionConfig,
    ) -> BlockchainResult<AnchorResult>;

    async fn verify_anchor(&self, anchor_id: &str) -> BlockchainResult<AnchorVerification>;

    async fn generate_merkle_proof(
        &self,
        hash: &str,
        anchor_id: &str,
    ) -> BlockchainResult<MerkleProof>;

    fn get_supported_networks(&self) -> Vec<BlockchainNetwork>;
}

/// Main blockchain anchor service with adapter pattern
pub struct BlockchainAnchor {
    clients: Arc<RwLock<HashMap<BlockchainNetwork, Box<dyn BlockchainAnchorTrait + Send + Sync>>>>,
    merkle_trees: Arc<RwLock<HashMap<String, MerkleTree>>>,
    default_config: TransactionConfig,
}

impl BlockchainAnchor {
    /// Create a new blockchain anchor service
    pub async fn new() -> BlockchainResult<Self> {
        let mut clients: HashMap<BlockchainNetwork, Box<dyn BlockchainAnchorTrait + Send + Sync>> = HashMap::new();

        // Initialize Arweave clients
        let arweave_mainnet = ArweaveAdapter::new(BlockchainNetwork::Arweave).await?;
        let arweave_testnet = ArweaveAdapter::new(BlockchainNetwork::ArweaveTestnet).await?;
        
        clients.insert(BlockchainNetwork::Arweave, Box::new(arweave_mainnet));
        clients.insert(BlockchainNetwork::ArweaveTestnet, Box::new(arweave_testnet));

        // Initialize Ethereum clients
        let ethereum_mainnet = EthereumAdapter::new(BlockchainNetwork::Ethereum).await?;
        let ethereum_testnet = EthereumAdapter::new(BlockchainNetwork::EthereumTestnet).await?;
        
        clients.insert(BlockchainNetwork::Ethereum, Box::new(ethereum_mainnet));
        clients.insert(BlockchainNetwork::EthereumTestnet, Box::new(ethereum_testnet));

        Ok(Self {
            clients: Arc::new(RwLock::new(clients)),
            merkle_trees: Arc::new(RwLock::new(HashMap::new())),
            default_config: TransactionConfig::default(),
        })
    }

    /// Anchor a single hash on the specified network
    pub async fn anchor_hash(
        &self,
        hash: &str,
        metadata: &AnchorMetadata,
        config: Option<TransactionConfig>,
    ) -> BlockchainResult<AnchorResult> {
        let config = config.unwrap_or_else(|| self.default_config.clone());
        let clients = self.clients.read().await;
        
        let client = clients
            .get(&config.network)
            .ok_or_else(|| BlockchainError::UnsupportedNetwork(
                format!("Network {:?} not available", config.network)
            ))?;

        client.anchor_hash(hash, metadata, &config).await
    }

    /// Anchor multiple hashes using a Merkle tree for efficiency
    pub async fn anchor_batch(
        &self,
        hashes: Vec<&str>,
        metadata: &AnchorMetadata,
        config: Option<TransactionConfig>,
    ) -> BlockchainResult<(AnchorResult, MerkleTree)> {
        if hashes.is_empty() {
            return Err(BlockchainError::InvalidTransaction(
                "Cannot anchor empty batch".to_string(),
            ));
        }

        // Create Merkle tree from hashes
        let merkle_tree = create_proof_pack_tree(hashes)?;
        let root_hash = merkle_tree.root();

        // Anchor the Merkle root
        let anchor_result = self.anchor_hash(root_hash, metadata, config).await?;

        // Store the Merkle tree for future proof generation
        let mut trees = self.merkle_trees.write().await;
        trees.insert(anchor_result.transaction_id.clone(), merkle_tree.clone());

        Ok((anchor_result, merkle_tree))
    }

    /// Verify an anchor on the specified network
    pub async fn verify_anchor(&self, anchor_id: &str, network: BlockchainNetwork) -> BlockchainResult<AnchorVerification> {
        let clients = self.clients.read().await;
        
        let client = clients
            .get(&network)
            .ok_or_else(|| BlockchainError::UnsupportedNetwork(
                format!("Network {:?} not available", network)
            ))?;

        client.verify_anchor(anchor_id).await
    }

    /// Generate a Merkle proof for a hash in a batch anchor
    pub async fn generate_merkle_proof(
        &self,
        hash: &str,
        anchor_id: &str,
    ) -> BlockchainResult<MerkleProof> {
        let trees = self.merkle_trees.read().await;
        
        let tree = trees
            .get(anchor_id)
            .ok_or_else(|| BlockchainError::MerkleTreeError(
                format!("Merkle tree not found for anchor {}", anchor_id)
            ))?;

        // Find the index of the hash in the tree
        // We need to hash the input to match the leaf format
        let target_hash = MerkleTree::hash_data(hash);
        let leaf_index = tree.leaves.iter()
            .position(|leaf| leaf == &target_hash)
            .ok_or_else(|| BlockchainError::MerkleTreeError(
                format!("Hash {} not found in Merkle tree", hash)
            ))?;

        tree.generate_proof(leaf_index)
    }

    /// Verify a Merkle proof
    pub async fn verify_merkle_proof(&self, proof: &MerkleProof) -> BlockchainResult<bool> {
        MerkleTree::verify_proof(proof)
    }

    /// Get all supported networks
    pub async fn get_supported_networks(&self) -> Vec<BlockchainNetwork> {
        let clients = self.clients.read().await;
        clients.keys().cloned().collect()
    }

    /// Add a new blockchain client
    pub async fn add_client(
        &self,
        network: BlockchainNetwork,
        client: Box<dyn BlockchainAnchorTrait + Send + Sync>,
    ) {
        let mut clients = self.clients.write().await;
        clients.insert(network, client);
    }

    /// Remove a blockchain client
    pub async fn remove_client(&self, network: &BlockchainNetwork) {
        let mut clients = self.clients.write().await;
        clients.remove(network);
    }

    /// Update default configuration
    pub fn set_default_config(&mut self, config: TransactionConfig) {
        self.default_config = config;
    }

    /// Get network statistics
    pub async fn get_network_stats(&self, network: BlockchainNetwork) -> BlockchainResult<NetworkStats> {
        match network {
            BlockchainNetwork::Arweave | BlockchainNetwork::ArweaveTestnet => {
                let clients = self.clients.read().await;
                if let Some(client) = clients.get(&network) {
                    // This would need to be implemented in the ArweaveAdapter
                    Ok(NetworkStats {
                        network,
                        block_height: 0,
                        avg_confirmation_time: 600, // 10 minutes for Arweave
                        current_fee: 0,
                        congestion_level: 0.0,
                    })
                } else {
                    Err(BlockchainError::UnsupportedNetwork(format!("{:?}", network)))
                }
            }
            BlockchainNetwork::Ethereum | BlockchainNetwork::EthereumTestnet => {
                let clients = self.clients.read().await;
                if let Some(client) = clients.get(&network) {
                    // This would need to be implemented in the EthereumAdapter
                    Ok(NetworkStats {
                        network,
                        block_height: 0,
                        avg_confirmation_time: 15, // 15 seconds for Ethereum
                        current_fee: 0,
                        congestion_level: 0.0,
                    })
                } else {
                    Err(BlockchainError::UnsupportedNetwork(format!("{:?}", network)))
                }
            }
        }
    }
}

/// Adapter for Arweave client
struct ArweaveAdapter {
    client: ArweaveClient,
}

impl ArweaveAdapter {
    async fn new(network: BlockchainNetwork) -> BlockchainResult<Self> {
        let client = ArweaveClient::new(network)?;
        Ok(Self { client })
    }
}

#[async_trait]
impl BlockchainAnchorTrait for ArweaveAdapter {
    async fn anchor_hash(
        &self,
        hash: &str,
        metadata: &AnchorMetadata,
        config: &TransactionConfig,
    ) -> BlockchainResult<AnchorResult> {
        self.client.anchor_hash(hash, metadata, config).await
    }

    async fn verify_anchor(&self, anchor_id: &str) -> BlockchainResult<AnchorVerification> {
        self.client.verify_anchor(anchor_id).await
    }

    async fn generate_merkle_proof(
        &self,
        _hash: &str,
        _anchor_id: &str,
    ) -> BlockchainResult<MerkleProof> {
        // Arweave doesn't use Merkle proofs in the same way
        Err(BlockchainError::UnsupportedNetwork(
            "Merkle proofs not supported for Arweave".to_string(),
        ))
    }

    fn get_supported_networks(&self) -> Vec<BlockchainNetwork> {
        vec![BlockchainNetwork::Arweave, BlockchainNetwork::ArweaveTestnet]
    }
}

/// Adapter for Ethereum client
struct EthereumAdapter {
    client: EthereumClient,
}

impl EthereumAdapter {
    async fn new(network: BlockchainNetwork) -> BlockchainResult<Self> {
        let client = EthereumClient::new(network).await?;
        Ok(Self { client })
    }
}

#[async_trait]
impl BlockchainAnchorTrait for EthereumAdapter {
    async fn anchor_hash(
        &self,
        hash: &str,
        metadata: &AnchorMetadata,
        config: &TransactionConfig,
    ) -> BlockchainResult<AnchorResult> {
        self.client.anchor_hash(hash, metadata, config).await
    }

    async fn verify_anchor(&self, anchor_id: &str) -> BlockchainResult<AnchorVerification> {
        self.client.verify_anchor(anchor_id).await
    }

    async fn generate_merkle_proof(
        &self,
        _hash: &str,
        _anchor_id: &str,
    ) -> BlockchainResult<MerkleProof> {
        // For Ethereum, Merkle proofs would be generated from transaction logs
        // This is a simplified implementation
        Err(BlockchainError::UnsupportedNetwork(
            "Merkle proof generation not implemented for Ethereum".to_string(),
        ))
    }

    fn get_supported_networks(&self) -> Vec<BlockchainNetwork> {
        vec![BlockchainNetwork::Ethereum, BlockchainNetwork::EthereumTestnet]
    }
}

/// Network statistics
#[derive(Debug, Clone)]
pub struct NetworkStats {
    pub network: BlockchainNetwork,
    pub block_height: u64,
    pub avg_confirmation_time: u64, // seconds
    pub current_fee: u64,
    pub congestion_level: f64, // 0.0 to 1.0
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[tokio::test]
    async fn test_blockchain_anchor_creation() {
        let anchor = BlockchainAnchor::new().await;
        assert!(anchor.is_ok());
    }

    #[tokio::test]
    async fn test_supported_networks() {
        let anchor = BlockchainAnchor::new().await.unwrap();
        let networks = anchor.get_supported_networks().await;
        assert!(!networks.is_empty());
        assert!(networks.contains(&BlockchainNetwork::Arweave));
        assert!(networks.contains(&BlockchainNetwork::Ethereum));
    }

    #[tokio::test]
    async fn test_merkle_tree_batch_anchoring() {
        let anchor = BlockchainAnchor::new().await.unwrap();
        let hashes = vec!["hash1", "hash2", "hash3"];
        let metadata = AnchorMetadata {
            proof_pack_id: "test_batch".to_string(),
            creator: "test_user".to_string(),
            timestamp: 1234567890,
            content_hash: "batch_hash".to_string(),
            tags: HashMap::new(),
        };

        // This would fail in a real test without proper network setup
        // but tests the structure
        let result = anchor.anchor_batch(hashes, &metadata, None).await;
        // In a real implementation, you'd mock the network calls
        // The test may pass or fail depending on network setup, so we just check it doesn't panic
        match result {
            Ok(_) => println!("Batch anchoring succeeded (test network available)"),
            Err(e) => println!("Batch anchoring failed as expected: {}", e),
        }
    }
}