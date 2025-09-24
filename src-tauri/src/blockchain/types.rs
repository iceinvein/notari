use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnchorMetadata {
    pub proof_pack_id: String,
    pub creator: String,
    pub timestamp: i64,
    pub content_hash: String,
    pub tags: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnchorResult {
    pub transaction_id: String,
    pub block_number: Option<u64>,
    pub timestamp: i64,
    pub network_id: String,
    pub cost: u64, // Cost in smallest unit (wei for Ethereum, winston for Arweave)
    pub confirmation_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnchorVerification {
    pub is_valid: bool,
    pub transaction_id: String,
    pub block_number: Option<u64>,
    pub confirmations: u64,
    pub timestamp: i64,
    pub network_id: String,
    pub merkle_proof: Option<MerkleProof>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleProof {
    pub root: String,
    pub leaf: String,
    pub path: Vec<MerkleNode>,
    pub index: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MerkleNode {
    pub hash: String,
    pub is_left: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum BlockchainNetwork {
    Arweave,
    Ethereum,
    EthereumTestnet,
    ArweaveTestnet,
}

impl BlockchainNetwork {
    pub fn as_str(&self) -> &'static str {
        match self {
            BlockchainNetwork::Arweave => "arweave",
            BlockchainNetwork::Ethereum => "ethereum",
            BlockchainNetwork::EthereumTestnet => "ethereum-testnet",
            BlockchainNetwork::ArweaveTestnet => "arweave-testnet",
        }
    }

    pub fn is_testnet(&self) -> bool {
        matches!(self, BlockchainNetwork::EthereumTestnet | BlockchainNetwork::ArweaveTestnet)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionConfig {
    pub network: BlockchainNetwork,
    pub max_retries: u32,
    pub retry_delay_ms: u64,
    pub max_fee: Option<u64>,
    pub priority: TransactionPriority,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TransactionPriority {
    Low,
    Medium,
    High,
    Urgent,
}

impl Default for TransactionConfig {
    fn default() -> Self {
        Self {
            network: BlockchainNetwork::Arweave,
            max_retries: 3,
            retry_delay_ms: 1000,
            max_fee: None,
            priority: TransactionPriority::Medium,
        }
    }
}

#[derive(Error, Debug)]
pub enum BlockchainError {
    #[error("Network error: {0}")]
    NetworkError(String),
    
    #[error("Transaction failed: {0}")]
    TransactionFailed(String),
    
    #[error("Insufficient funds: required {required}, available {available}")]
    InsufficientFunds { required: u64, available: u64 },
    
    #[error("Invalid transaction: {0}")]
    InvalidTransaction(String),
    
    #[error("Verification failed: {0}")]
    VerificationFailed(String),
    
    #[error("Unsupported network: {0}")]
    UnsupportedNetwork(String),
    
    #[error("Configuration error: {0}")]
    ConfigurationError(String),
    
    #[error("Timeout: operation took longer than {timeout_ms}ms")]
    Timeout { timeout_ms: u64 },
    
    #[error("Serialization error: {0}")]
    SerializationError(String),
    
    #[error("Merkle tree error: {0}")]
    MerkleTreeError(String),
}

pub type BlockchainResult<T> = Result<T, BlockchainError>;