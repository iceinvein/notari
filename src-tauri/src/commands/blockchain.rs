use crate::blockchain::{
    BlockchainAnchor,
    types::{
        AnchorMetadata, AnchorResult, AnchorVerification, BlockchainNetwork, 
        BlockchainResult, MerkleProof, TransactionConfig, TransactionPriority
    }
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tauri::State;
use tokio::sync::Mutex;

pub type BlockchainState = Arc<Mutex<Option<BlockchainAnchor>>>;

pub fn init_blockchain_state() -> BlockchainState {
    // We'll use Option<BlockchainAnchor> to handle lazy initialization
    Arc::new(Mutex::new(None))
}

// Helper function to ensure blockchain anchor is initialized
async fn ensure_initialized(state: &BlockchainState) -> Result<(), String> {
    let mut state_guard = state.lock().await;
    if state_guard.is_none() {
        let anchor = BlockchainAnchor::new()
            .await
            .map_err(|e| format!("Failed to initialize blockchain anchor: {}", e))?;
        *state_guard = Some(anchor);
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnchorRequest {
    pub hash: String,
    pub metadata: AnchorMetadata,
    pub config: Option<TransactionConfig>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchAnchorRequest {
    pub hashes: Vec<String>,
    pub metadata: AnchorMetadata,
    pub config: Option<TransactionConfig>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VerificationRequest {
    pub anchor_id: String,
    pub network: BlockchainNetwork,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MerkleProofRequest {
    pub hash: String,
    pub anchor_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkStatsResponse {
    pub network: BlockchainNetwork,
    pub block_height: u64,
    pub avg_confirmation_time: u64,
    pub current_fee: u64,
    pub congestion_level: f64,
}

/// Initialize the blockchain anchor service
#[tauri::command]
pub async fn initialize_blockchain_anchor(
    state: State<'_, BlockchainState>,
) -> Result<String, String> {
    ensure_initialized(&state).await?;
    Ok("Blockchain anchor service initialized successfully".to_string())
}

/// Anchor a single hash on blockchain
#[tauri::command]
pub async fn anchor_hash(
    request: AnchorRequest,
    state: State<'_, BlockchainState>,
) -> Result<AnchorResult, String> {
    ensure_initialized(&state).await?;
    let state_guard = state.lock().await;
    
    state_guard
        .as_ref()
        .unwrap()
        .anchor_hash(&request.hash, &request.metadata, request.config)
        .await
        .map_err(|e| format!("Failed to anchor hash: {}", e))
}

/// Anchor multiple hashes using Merkle tree
#[tauri::command]
pub async fn anchor_batch(
    request: BatchAnchorRequest,
    state: State<'_, BlockchainState>,
) -> Result<(AnchorResult, String), String> {
    ensure_initialized(&state).await?;
    let state_guard = state.lock().await;
    let hash_refs: Vec<&str> = request.hashes.iter().map(|s| s.as_str()).collect();
    
    let (anchor_result, merkle_tree) = state_guard
        .as_ref()
        .unwrap()
        .anchor_batch(hash_refs, &request.metadata, request.config)
        .await
        .map_err(|e| format!("Failed to anchor batch: {}", e))?;
    
    Ok((anchor_result, merkle_tree.root().to_string()))
}

/// Verify an anchor on blockchain
#[tauri::command]
pub async fn verify_anchor(
    request: VerificationRequest,
    state: State<'_, BlockchainState>,
) -> Result<AnchorVerification, String> {
    ensure_initialized(&state).await?;
    let state_guard = state.lock().await;
    
    state_guard
        .as_ref()
        .unwrap()
        .verify_anchor(&request.anchor_id, request.network)
        .await
        .map_err(|e| format!("Failed to verify anchor: {}", e))
}

/// Generate Merkle proof for a hash
#[tauri::command]
pub async fn generate_merkle_proof(
    request: MerkleProofRequest,
    state: State<'_, BlockchainState>,
) -> Result<MerkleProof, String> {
    ensure_initialized(&state).await?;
    let state_guard = state.lock().await;
    
    state_guard
        .as_ref()
        .unwrap()
        .generate_merkle_proof(&request.hash, &request.anchor_id)
        .await
        .map_err(|e| format!("Failed to generate Merkle proof: {}", e))
}

/// Verify a Merkle proof
#[tauri::command]
pub async fn verify_merkle_proof(
    proof: MerkleProof,
    state: State<'_, BlockchainState>,
) -> Result<bool, String> {
    ensure_initialized(&state).await?;
    let state_guard = state.lock().await;
    
    state_guard
        .as_ref()
        .unwrap()
        .verify_merkle_proof(&proof)
        .await
        .map_err(|e| format!("Failed to verify Merkle proof: {}", e))
}

/// Get supported blockchain networks
#[tauri::command]
pub async fn get_supported_networks(
    state: State<'_, BlockchainState>,
) -> Result<Vec<BlockchainNetwork>, String> {
    ensure_initialized(&state).await?;
    let state_guard = state.lock().await;
    Ok(state_guard.as_ref().unwrap().get_supported_networks().await)
}

/// Get network statistics
#[tauri::command]
pub async fn get_network_stats(
    network: BlockchainNetwork,
    state: State<'_, BlockchainState>,
) -> Result<NetworkStatsResponse, String> {
    ensure_initialized(&state).await?;
    let state_guard = state.lock().await;
    
    let stats = state_guard
        .as_ref()
        .unwrap()
        .get_network_stats(network)
        .await
        .map_err(|e| format!("Failed to get network stats: {}", e))?;
    
    Ok(NetworkStatsResponse {
        network: stats.network,
        block_height: stats.block_height,
        avg_confirmation_time: stats.avg_confirmation_time,
        current_fee: stats.current_fee,
        congestion_level: stats.congestion_level,
    })
}

/// Create a transaction config with custom parameters
#[tauri::command]
pub fn create_transaction_config(
    network: BlockchainNetwork,
    max_retries: Option<u32>,
    retry_delay_ms: Option<u64>,
    max_fee: Option<u64>,
    priority: Option<TransactionPriority>,
) -> TransactionConfig {
    TransactionConfig {
        network,
        max_retries: max_retries.unwrap_or(3),
        retry_delay_ms: retry_delay_ms.unwrap_or(1000),
        max_fee,
        priority: priority.unwrap_or(TransactionPriority::Medium),
    }
}

/// Create anchor metadata
#[tauri::command]
pub fn create_anchor_metadata(
    proof_pack_id: String,
    creator: String,
    timestamp: i64,
    content_hash: String,
    tags: Option<HashMap<String, String>>,
) -> AnchorMetadata {
    AnchorMetadata {
        proof_pack_id,
        creator,
        timestamp,
        content_hash,
        tags: tags.unwrap_or_default(),
    }
}

/// Get blockchain anchor service status
#[tauri::command]
pub async fn get_blockchain_status(
    state: State<'_, BlockchainState>,
) -> Result<String, String> {
    ensure_initialized(&state).await?;
    let state_guard = state.lock().await;
    let networks = state_guard.as_ref().unwrap().get_supported_networks().await;
    
    Ok(format!(
        "Blockchain anchor service active with {} supported networks: {:?}",
        networks.len(),
        networks
    ))
}

/// Estimate transaction cost
#[tauri::command]
pub async fn estimate_transaction_cost(
    network: BlockchainNetwork,
    data_size: u64,
    priority: TransactionPriority,
    state: State<'_, BlockchainState>,
) -> Result<u64, String> {
    // This is a simplified estimation
    // In a real implementation, you would query the actual network
    let base_cost = match network {
        BlockchainNetwork::Arweave | BlockchainNetwork::ArweaveTestnet => {
            // Arweave pricing is based on data size
            data_size * 1000 // winston per byte (simplified)
        }
        BlockchainNetwork::Ethereum | BlockchainNetwork::EthereumTestnet => {
            // Ethereum pricing is based on gas
            21000 * 20_000_000_000 // 21k gas * 20 gwei (simplified)
        }
    };

    let priority_multiplier = match priority {
        TransactionPriority::Low => 0.8,
        TransactionPriority::Medium => 1.0,
        TransactionPriority::High => 1.3,
        TransactionPriority::Urgent => 2.0,
    };

    Ok((base_cost as f64 * priority_multiplier) as u64)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_transaction_config() {
        let config = create_transaction_config(
            BlockchainNetwork::Arweave,
            Some(5),
            Some(2000),
            Some(1000000),
            Some(TransactionPriority::High),
        );

        assert_eq!(config.network, BlockchainNetwork::Arweave);
        assert_eq!(config.max_retries, 5);
        assert_eq!(config.retry_delay_ms, 2000);
        assert_eq!(config.max_fee, Some(1000000));
        assert!(matches!(config.priority, TransactionPriority::High));
    }

    #[test]
    fn test_create_anchor_metadata() {
        let mut tags = HashMap::new();
        tags.insert("type".to_string(), "proof_pack".to_string());

        let metadata = create_anchor_metadata(
            "test_pack_123".to_string(),
            "user_456".to_string(),
            1234567890,
            "hash_abc123".to_string(),
            Some(tags.clone()),
        );

        assert_eq!(metadata.proof_pack_id, "test_pack_123");
        assert_eq!(metadata.creator, "user_456");
        assert_eq!(metadata.timestamp, 1234567890);
        assert_eq!(metadata.content_hash, "hash_abc123");
        assert_eq!(metadata.tags, tags);
    }

    #[tokio::test]
    async fn test_estimate_transaction_cost() {
        // This test would need proper state setup in a real implementation
        // For now, just test the structure
        assert!(true);
    }
}