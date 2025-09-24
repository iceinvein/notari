use crate::blockchain::types::{
    AnchorMetadata, AnchorResult, AnchorVerification, BlockchainError, BlockchainNetwork,
    BlockchainResult, TransactionConfig, TransactionPriority,
};
use ethers::{
    prelude::*,
    providers::{Http, Provider},
    types::{Address, Bytes, TransactionReceipt, TransactionRequest, U256},
    utils::keccak256,
};
use std::collections::HashMap;
use std::str::FromStr;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};
use tokio::time::{sleep, Duration};

#[derive(Debug, Clone)]
pub struct EthereumClient {
    provider: Arc<Provider<Http>>,
    network: BlockchainNetwork,
    chain_id: u64,
}

impl EthereumClient {
    /// Create a new Ethereum client
    pub async fn new(network: BlockchainNetwork) -> BlockchainResult<Self> {
        let (rpc_url, chain_id) = match network {
            BlockchainNetwork::Ethereum => ("https://mainnet.infura.io/v3/YOUR_PROJECT_ID", 1),
            BlockchainNetwork::EthereumTestnet => ("https://sepolia.infura.io/v3/YOUR_PROJECT_ID", 11155111),
            _ => {
                return Err(BlockchainError::UnsupportedNetwork(format!(
                    "Network {:?} is not supported by EthereumClient",
                    network
                )));
            }
        };

        let provider = Provider::<Http>::try_from(rpc_url)
            .map_err(|e| BlockchainError::NetworkError(e.to_string()))?;

        Ok(Self {
            provider: Arc::new(provider),
            network,
            chain_id,
        })
    }

    /// Anchor a hash on Ethereum using a smart contract or transaction data
    pub async fn anchor_hash(
        &self,
        hash: &str,
        metadata: &AnchorMetadata,
        config: &TransactionConfig,
    ) -> BlockchainResult<AnchorResult> {
        // Prepare transaction data
        let data = self.prepare_anchor_data(hash, metadata)?;
        
        // Get current gas price and estimate gas
        let gas_price = self.get_optimal_gas_price(&config.priority).await?;
        let gas_estimate = self.estimate_gas(&data).await?;
        
        let total_cost = gas_price * gas_estimate;
        
        // Check if cost is within budget
        if let Some(max_fee) = config.max_fee {
            if total_cost.as_u64() > max_fee {
                return Err(BlockchainError::InsufficientFunds {
                    required: total_cost.as_u64(),
                    available: max_fee,
                });
            }
        }

        // Submit transaction with retry logic
        let mut last_error = None;
        for attempt in 0..=config.max_retries {
            match self.submit_transaction(&data, gas_price, gas_estimate).await {
                Ok(result) => return Ok(result),
                Err(e) => {
                    last_error = Some(e);
                    if attempt < config.max_retries {
                        let delay = Duration::from_millis(
                            config.retry_delay_ms * (2_u64.pow(attempt))
                        );
                        sleep(delay).await;
                        
                        // Adjust gas price for retry
                        let adjusted_gas_price = gas_price * U256::from(110) / U256::from(100); // 10% increase
                        if let Ok(new_result) = self.submit_transaction(&data, adjusted_gas_price, gas_estimate).await {
                            return Ok(new_result);
                        }
                    }
                }
            }
        }

        Err(last_error.unwrap_or_else(|| {
            BlockchainError::TransactionFailed("Unknown error during submission".to_string())
        }))
    }

    /// Verify an anchor on Ethereum
    pub async fn verify_anchor(&self, transaction_hash: &str) -> BlockchainResult<AnchorVerification> {
        let tx_hash = H256::from_str(transaction_hash)
            .map_err(|e| BlockchainError::InvalidTransaction(e.to_string()))?;

        // Get transaction receipt
        let receipt = self
            .provider
            .get_transaction_receipt(tx_hash)
            .await
            .map_err(|e| BlockchainError::NetworkError(e.to_string()))?;

        match receipt {
            Some(receipt) => {
                let current_block = self
                    .provider
                    .get_block_number()
                    .await
                    .map_err(|e| BlockchainError::NetworkError(e.to_string()))?;

                let confirmations = if let Some(block_number) = receipt.block_number {
                    current_block.saturating_sub(block_number).as_u64()
                } else {
                    0
                };

                // Get block timestamp
                let timestamp = if let Some(block_number) = receipt.block_number {
                    self.get_block_timestamp(block_number).await.unwrap_or(0)
                } else {
                    0
                };

                Ok(AnchorVerification {
                    is_valid: receipt.status == Some(U64::from(1)),
                    transaction_id: transaction_hash.to_string(),
                    block_number: receipt.block_number.map(|n| n.as_u64()),
                    confirmations,
                    timestamp,
                    network_id: self.network.as_str().to_string(),
                    merkle_proof: None, // Ethereum doesn't use Merkle proofs for transaction verification
                })
            }
            None => Ok(AnchorVerification {
                is_valid: false,
                transaction_id: transaction_hash.to_string(),
                block_number: None,
                confirmations: 0,
                timestamp: 0,
                network_id: self.network.as_str().to_string(),
                merkle_proof: None,
            }),
        }
    }

    /// Get current network status
    pub async fn get_network_status(&self) -> BlockchainResult<EthereumNetworkStatus> {
        let block_number = self
            .provider
            .get_block_number()
            .await
            .map_err(|e| BlockchainError::NetworkError(e.to_string()))?;

        let gas_price = self
            .provider
            .get_gas_price()
            .await
            .map_err(|e| BlockchainError::NetworkError(e.to_string()))?;

        let peer_count = U256::zero(); // Simplified for now - would need proper RPC call

        Ok(EthereumNetworkStatus {
            block_number: block_number.as_u64(),
            gas_price: gas_price.as_u64(),
            peer_count: peer_count.as_u64(),
            chain_id: self.chain_id,
        })
    }

    /// Prepare anchor data for Ethereum transaction
    fn prepare_anchor_data(
        &self,
        hash: &str,
        metadata: &AnchorMetadata,
    ) -> BlockchainResult<Bytes> {
        // Create a structured data payload for the transaction
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

        let data_string = serde_json::to_string(&anchor_data)
            .map_err(|e| BlockchainError::SerializationError(e.to_string()))?;

        // Convert to bytes and add a function selector for contract interaction
        let data_hash = keccak256(data_string.as_bytes());
        Ok(Bytes::from(data_hash.to_vec()))
    }

    /// Get optimal gas price based on network conditions and priority
    async fn get_optimal_gas_price(&self, priority: &TransactionPriority) -> BlockchainResult<U256> {
        let base_gas_price = self
            .provider
            .get_gas_price()
            .await
            .map_err(|e| BlockchainError::NetworkError(e.to_string()))?;

        let multiplier = match priority {
            TransactionPriority::Low => 90,      // 90% of current price
            TransactionPriority::Medium => 110,  // 110% of current price
            TransactionPriority::High => 130,   // 130% of current price
            TransactionPriority::Urgent => 200, // 200% of current price
        };

        Ok(base_gas_price * U256::from(multiplier) / U256::from(100))
    }

    /// Estimate gas for the transaction
    async fn estimate_gas(&self, _data: &Bytes) -> BlockchainResult<U256> {
        // Simplified gas estimation - in a real implementation would use proper estimation
        Ok(U256::from(21000)) // Standard gas limit for simple transactions
    }

    /// Submit transaction to Ethereum network
    async fn submit_transaction(
        &self,
        data: &Bytes,
        gas_price: U256,
        gas_limit: U256,
    ) -> BlockchainResult<AnchorResult> {
        // For this implementation, we'll simulate transaction submission
        // In a real implementation, you would need to:
        // 1. Have a wallet/signer configured
        // 2. Sign the transaction
        // 3. Submit it to the network
        // 4. Wait for confirmation

        // Simulate transaction hash generation
        let transaction_id = format!(
            "0x{}{}",
            hex::encode(&keccak256(data.as_ref())[..16]),
            hex::encode(&SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
                .to_le_bytes()[..16])
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
            cost: (gas_price * gas_limit).as_u64(),
            confirmation_url: format!(
                "https://{}etherscan.io/tx/{}",
                if self.network == BlockchainNetwork::EthereumTestnet { "sepolia." } else { "" },
                transaction_id
            ),
        })
    }

    /// Get block timestamp
    async fn get_block_timestamp(&self, block_number: U64) -> BlockchainResult<i64> {
        let block = self
            .provider
            .get_block(block_number)
            .await
            .map_err(|e| BlockchainError::NetworkError(e.to_string()))?;

        Ok(block
            .map(|b| b.timestamp.as_u64() as i64)
            .unwrap_or(0))
    }
}

#[derive(Debug)]
pub struct EthereumNetworkStatus {
    pub block_number: u64,
    pub gas_price: u64,
    pub peer_count: u64,
    pub chain_id: u64,
}

/// Calculate gas price adjustment based on network congestion
pub fn calculate_gas_price_adjustment(
    base_price: U256,
    network_congestion: f64,
    priority: &TransactionPriority,
) -> U256 {
    let priority_multiplier = match priority {
        TransactionPriority::Low => 0.9,
        TransactionPriority::Medium => 1.1,
        TransactionPriority::High => 1.3,
        TransactionPriority::Urgent => 2.0,
    };

    let congestion_multiplier = 1.0 + (network_congestion * 0.5);
    let total_multiplier = priority_multiplier * congestion_multiplier;

    base_price * U256::from((total_multiplier * 100.0) as u64) / U256::from(100)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_prepare_anchor_data() {
        let client = EthereumClient {
            provider: Arc::new(Provider::<Http>::try_from("http://localhost:8545").unwrap()),
            network: BlockchainNetwork::EthereumTestnet,
            chain_id: 11155111,
        };

        let metadata = AnchorMetadata {
            proof_pack_id: "test_pack".to_string(),
            creator: "test_user".to_string(),
            timestamp: 1234567890,
            content_hash: "test_hash".to_string(),
            tags: HashMap::new(),
        };

        let data = client.prepare_anchor_data("test_hash", &metadata);
        assert!(data.is_ok());
    }

    #[test]
    fn test_calculate_gas_price_adjustment() {
        let base_price = U256::from(20_000_000_000u64); // 20 gwei
        let adjusted = calculate_gas_price_adjustment(
            base_price,
            0.5,
            &TransactionPriority::Medium,
        );
        assert!(adjusted > base_price);
    }
}