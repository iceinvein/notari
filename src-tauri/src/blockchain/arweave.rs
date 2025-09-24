use crate::blockchain::types::{
    AnchorMetadata, AnchorResult, AnchorVerification, BlockchainError, BlockchainNetwork,
    BlockchainResult, TransactionConfig,
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::time::{sleep, Duration};

#[derive(Debug, Clone)]
pub struct ArweaveClient {
    client: Client,
    gateway_url: String,
    network: BlockchainNetwork,
}

#[derive(Debug, Serialize, Deserialize)]
struct ArweaveTransaction {
    id: String,
    last_tx: String,
    owner: String,
    tags: Vec<ArweaveTag>,
    target: String,
    quantity: String,
    data: String,
    data_size: String,
    data_root: String,
    reward: String,
    signature: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ArweaveTag {
    name: String,
    value: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ArweavePrice {
    winston: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ArweaveStatus {
    block_height: u64,
    current: String,
    blocks: u64,
    peers: u64,
    queue_length: u64,
    node_state_latency: u64,
}

impl ArweaveClient {
    /// Create a new Arweave client
    pub fn new(network: BlockchainNetwork) -> BlockchainResult<Self> {
        let gateway_url = match network {
            BlockchainNetwork::Arweave => "https://arweave.net".to_string(),
            BlockchainNetwork::ArweaveTestnet => "https://testnet.arweave.net".to_string(),
            _ => {
                return Err(BlockchainError::UnsupportedNetwork(format!(
                    "Network {:?} is not supported by ArweaveClient",
                    network
                )));
            }
        };

        let client = Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| BlockchainError::NetworkError(e.to_string()))?;

        Ok(Self {
            client,
            gateway_url,
            network,
        })
    }

    /// Anchor a hash on Arweave
    pub async fn anchor_hash(
        &self,
        hash: &str,
        metadata: &AnchorMetadata,
        config: &TransactionConfig,
    ) -> BlockchainResult<AnchorResult> {
        // Prepare transaction data
        let data = self.prepare_anchor_data(hash, metadata)?;
        
        // Get price estimate
        let price = self.get_price_estimate(&data).await?;
        
        // Check if price is within budget
        if let Some(max_fee) = config.max_fee {
            if price > max_fee {
                return Err(BlockchainError::InsufficientFunds {
                    required: price,
                    available: max_fee,
                });
            }
        }

        // Create and submit transaction with retry logic
        let mut last_error = None;
        for attempt in 0..=config.max_retries {
            match self.submit_transaction(&data, metadata, price).await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    last_error = Some(e);
                    if attempt < config.max_retries {
                        let delay = Duration::from_millis(
                            config.retry_delay_ms * (2_u64.pow(attempt))
                        );
                        sleep(delay).await;
                    }
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            BlockchainError::TransactionFailed("Unknown error during submission".to_string())
        }))
    }

    /// Verify an anchor on Arweave
    pub async fn verify_anchor(&self, transaction_id: &str) -> BlockchainResult<AnchorVerification> {
        // Get transaction details
        let tx_url = format!("{}/tx/{}", self.gateway_url, transaction_id);
        let response = self
            .client
            .get(&tx_url)
            .send()
            .await
            .map_err(|e| BlockchainError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Ok(AnchorVerification {
                is_valid: false,
                transaction_id: transaction_id.to_string(),
                block_number: None,
                confirmations: 0,
                timestamp: 0,
                network_id: self.network.as_str().to_string(),
                merkle_proof: None,
            });
        }

        let transaction: ArweaveTransaction = response
            .json()
            .await
            .map_err(|e| BlockchainError::SerializationError(e.to_string()))?;

        // Get block information
        let block_info = self.get_block_info(&transaction.id).await?;
        
        Ok(AnchorVerification {
            is_valid: true,
            transaction_id: transaction_id.to_string(),
            block_number: block_info.as_ref().map(|b| b.height),
            confirmations: block_info.as_ref().map(|b| b.confirmations).unwrap_or(0),
            timestamp: block_info.as_ref().map(|b| b.timestamp).unwrap_or(0),
            network_id: self.network.as_str().to_string(),
            merkle_proof: None, // Arweave uses its own proof system
        })
    }

    /// Get the current network status
    pub async fn get_network_status(&self) -> BlockchainResult<ArweaveStatus> {
        let status_url = format!("{}/info", self.gateway_url);
        let response = self
            .client
            .get(&status_url)
            .send()
            .await
            .map_err(|e| BlockchainError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(BlockchainError::NetworkError(
                "Failed to get network status".to_string(),
            ));
        }

        response
            .json()
            .await
            .map_err(|e| BlockchainError::SerializationError(e.to_string()))
    }

    /// Prepare anchor data for Arweave transaction
    fn prepare_anchor_data(
        &self,
        hash: &str,
        metadata: &AnchorMetadata,
    ) -> BlockchainResult<String> {
        let anchor_data = serde_json::json!({
            "type": "notari_proof_anchor",
            "version": "1.0",
            "proof_pack_hash": hash,
            "proof_pack_id": metadata.proof_pack_id,
            "creator": metadata.creator,
            "timestamp": metadata.timestamp,
            "content_hash": metadata.content_hash,
            "tags": metadata.tags
        });

        serde_json::to_string(&anchor_data)
            .map_err(|e| BlockchainError::SerializationError(e.to_string()))
    }

    /// Get price estimate for data
    async fn get_price_estimate(&self, data: &str) -> BlockchainResult<u64> {
        let data_size = data.len();
        let price_url = format!("{}/price/{}", self.gateway_url, data_size);
        
        let response = self
            .client
            .get(&price_url)
            .send()
            .await
            .map_err(|e| BlockchainError::NetworkError(e.to_string()))?;

        if !response.status().is_success() {
            return Err(BlockchainError::NetworkError(
                "Failed to get price estimate".to_string(),
            ));
        }

        let price_text = response
            .text()
            .await
            .map_err(|e| BlockchainError::NetworkError(e.to_string()))?;

        price_text
            .parse::<u64>()
            .map_err(|e| BlockchainError::SerializationError(e.to_string()))
    }

    /// Submit transaction to Arweave
    async fn submit_transaction(
        &self,
        data: &str,
        metadata: &AnchorMetadata,
        price: u64,
    ) -> BlockchainResult<AnchorResult> {
        // For this implementation, we'll simulate transaction submission
        // In a real implementation, you would need to:
        // 1. Create a proper Arweave transaction with wallet signing
        // 2. Submit it to the network
        // 3. Wait for confirmation
        
        // Simulate transaction ID generation
        let transaction_id = format!(
            "ar_{}_{}", 
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_secs(),
            uuid::Uuid::new_v4().to_string()[..8].to_string()
        );

        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs() as i64;

        Ok(AnchorResult {
            transaction_id: transaction_id.clone(),
            block_number: None, // Will be set once mined
            timestamp,
            network_id: self.network.as_str().to_string(),
            cost: price,
            confirmation_url: format!("{}/tx/{}", self.gateway_url, transaction_id),
        })
    }

    /// Get block information for a transaction
    async fn get_block_info(&self, _transaction_id: &str) -> BlockchainResult<Option<BlockInfo>> {
        // In a real implementation, this would query the Arweave network
        // for block information containing the transaction
        Ok(None)
    }
}

#[derive(Debug, Clone)]
struct BlockInfo {
    height: u64,
    confirmations: u64,
    timestamp: i64,
}

/// Calculate optimal fee based on network congestion and priority
pub fn calculate_optimal_fee(
    base_price: u64,
    network_congestion: f64,
    priority: &crate::blockchain::types::TransactionPriority,
) -> u64 {
    let priority_multiplier = match priority {
        crate::blockchain::types::TransactionPriority::Low => 1.0,
        crate::blockchain::types::TransactionPriority::Medium => 1.2,
        crate::blockchain::types::TransactionPriority::High => 1.5,
        crate::blockchain::types::TransactionPriority::Urgent => 2.0,
    };

    let congestion_multiplier = 1.0 + (network_congestion * 0.5);
    
    (base_price as f64 * priority_multiplier * congestion_multiplier) as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_arweave_client_creation() {
        let client = ArweaveClient::new(BlockchainNetwork::ArweaveTestnet);
        assert!(client.is_ok());
    }

    #[test]
    fn test_prepare_anchor_data() {
        let client = ArweaveClient::new(BlockchainNetwork::ArweaveTestnet).unwrap();
        let metadata = AnchorMetadata {
            proof_pack_id: "test_pack".to_string(),
            creator: "test_user".to_string(),
            timestamp: 1234567890,
            content_hash: "test_hash".to_string(),
            tags: HashMap::new(),
        };

        let data = client.prepare_anchor_data("test_hash", &metadata);
        assert!(data.is_ok());
        assert!(data.unwrap().contains("notari_proof_anchor"));
    }

    #[test]
    fn test_calculate_optimal_fee() {
        let base_price = 1000;
        let fee = calculate_optimal_fee(
            base_price,
            0.5,
            &crate::blockchain::types::TransactionPriority::Medium,
        );
        assert!(fee > base_price);
    }
}