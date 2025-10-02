use super::{AnchorProof, BlockchainAnchorer};
use async_trait::async_trait;
use ethers::prelude::*;
use std::error::Error;
use std::sync::Arc;

// ABI for NotariRegistry contract
abigen!(
    NotariRegistry,
    r#"[
        function anchor(bytes32 hash) external
        function batchAnchor(bytes32[] calldata hashes) external
        function isAnchored(bytes32 hash) external view returns (uint256)
        function getAnchor(bytes32 hash) external view returns (uint256 timestamp, address anchorer)
        event HashAnchored(bytes32 indexed hash, address indexed anchorer, uint256 timestamp, uint256 blockNumber)
    ]"#
);

/// Ethereum blockchain anchorer
pub struct EthereumAnchorer {
    provider: Arc<Provider<Http>>,
    wallet: LocalWallet,
    contract_address: Address,
    chain_id: u64,
    chain_name: String,
    explorer_url: String,
}

impl EthereumAnchorer {
    /// Create a new Ethereum anchorer
    pub fn new(
        rpc_url: &str,
        private_key: &str,
        contract_address: &str,
        chain_id: u64,
        chain_name: &str,
        explorer_url: &str,
    ) -> Result<Self, Box<dyn Error>> {
        // Create provider
        let provider = Provider::<Http>::try_from(rpc_url)?;
        let provider = Arc::new(provider);

        // Create wallet from private key
        let wallet: LocalWallet = private_key.parse()?;
        let wallet = wallet.with_chain_id(chain_id);

        // Parse contract address
        let contract_address: Address = contract_address.parse()?;

        Ok(Self {
            provider,
            wallet,
            contract_address,
            chain_id,
            chain_name: chain_name.to_string(),
            explorer_url: explorer_url.to_string(),
        })
    }

    /// Get the contract instance
    fn contract(&self) -> NotariRegistry<Provider<Http>> {
        NotariRegistry::new(self.contract_address, self.provider.clone())
    }

    /// Get the signer (wallet + provider)
    fn signer(&self) -> SignerMiddleware<Arc<Provider<Http>>, LocalWallet> {
        SignerMiddleware::new(self.provider.clone(), self.wallet.clone())
    }

    /// Convert hex string to bytes32
    fn hex_to_bytes32(hex: &str) -> Result<[u8; 32], Box<dyn Error>> {
        let hex = hex.trim_start_matches("0x");
        let bytes = hex::decode(hex)?;
        if bytes.len() != 32 {
            return Err("Hash must be 32 bytes".into());
        }
        let mut array = [0u8; 32];
        array.copy_from_slice(&bytes);
        Ok(array)
    }

    /// Get explorer URL for transaction
    fn tx_explorer_url(&self, tx_hash: &str) -> String {
        format!("{}/tx/{}", self.explorer_url, tx_hash)
    }
}

#[async_trait]
impl BlockchainAnchorer for EthereumAnchorer {
    async fn anchor(&self, hash: &str) -> Result<AnchorProof, Box<dyn Error>> {
        // Convert hash to bytes32
        let hash_bytes = Self::hex_to_bytes32(hash)?;

        // Create contract instance with signer
        let signer = Arc::new(self.signer());
        let contract = NotariRegistry::new(self.contract_address, signer);

        // Call anchor function and wait for receipt
        let call = contract.anchor(hash_bytes);
        let pending_tx = call.send().await?;
        let receipt = pending_tx.await?.ok_or("Transaction failed")?;

        // Get block number
        let block_number = receipt.block_number.ok_or("No block number")?.as_u64();

        // Get transaction hash
        let tx_hash = format!("0x{:x}", receipt.transaction_hash);

        Ok(AnchorProof::Ethereum {
            chain_id: self.chain_id,
            chain_name: self.chain_name.clone(),
            tx_hash,
            contract_address: format!("0x{:x}", self.contract_address),
            block_number,
            explorer_url: self.tx_explorer_url(&format!("0x{:x}", receipt.transaction_hash)),
        })
    }

    async fn verify(&self, hash: &str, proof: &AnchorProof) -> Result<bool, Box<dyn Error>> {
        // Extract Ethereum proof details
        let (chain_id, contract_addr, _tx_hash) = match proof {
            AnchorProof::Ethereum {
                chain_id,
                contract_address,
                tx_hash,
                ..
            } => (chain_id, contract_address, tx_hash),
            _ => return Err("Invalid proof type for Ethereum verifier".into()),
        };

        // Verify chain ID matches
        if *chain_id != self.chain_id {
            return Ok(false);
        }

        // Verify contract address matches
        let expected_addr = format!("0x{:x}", self.contract_address).to_lowercase();
        if contract_addr.to_lowercase() != expected_addr {
            return Ok(false);
        }

        // Convert hash to bytes32
        let hash_bytes = Self::hex_to_bytes32(hash)?;

        // Query contract to check if hash is anchored
        let contract = self.contract();
        let timestamp = contract.is_anchored(hash_bytes).call().await?;

        // If timestamp is non-zero, hash is anchored
        Ok(timestamp.as_u64() > 0)
    }

    async fn estimate_cost(&self) -> Result<f64, Box<dyn Error>> {
        // Get current gas price
        let gas_price = self.provider.get_gas_price().await?;

        // Estimate gas for anchor transaction (typical: ~50,000 gas)
        let estimated_gas = U256::from(50_000);

        // Calculate cost in wei
        let cost_wei = gas_price * estimated_gas;

        // Convert to ETH (or native token)
        let cost_eth = cost_wei.as_u128() as f64 / 1e18;

        Ok(cost_eth)
    }

    async fn get_balance(&self) -> Result<f64, Box<dyn Error>> {
        // Get wallet address
        let address = self.wallet.address();

        // Get balance
        let balance = self.provider.get_balance(address, None).await?;

        // Convert to ETH (or native token)
        let balance_eth = balance.as_u128() as f64 / 1e18;

        Ok(balance_eth)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hex_to_bytes32() {
        let hash = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        let result = EthereumAnchorer::hex_to_bytes32(hash);
        assert!(result.is_ok());

        let bytes = result.unwrap();
        assert_eq!(bytes.len(), 32);
        assert_eq!(bytes[0], 0x12);
        assert_eq!(bytes[31], 0xef);
    }

    #[test]
    fn test_hex_to_bytes32_without_prefix() {
        let hash = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        let result = EthereumAnchorer::hex_to_bytes32(hash);
        assert!(result.is_ok());
    }

    #[test]
    fn test_hex_to_bytes32_invalid_length() {
        let hash = "0x1234"; // Too short
        let result = EthereumAnchorer::hex_to_bytes32(hash);
        assert!(result.is_err());
    }

    #[test]
    fn test_tx_explorer_url() {
        let anchorer = EthereumAnchorer {
            provider: Arc::new(Provider::<Http>::try_from("http://localhost:8545").unwrap()),
            wallet: LocalWallet::new(&mut rand::thread_rng()),
            contract_address: Address::zero(),
            chain_id: 137,
            chain_name: "Polygon".to_string(),
            explorer_url: "https://polygonscan.com".to_string(),
        };

        let url = anchorer.tx_explorer_url("0xabc123");
        assert_eq!(url, "https://polygonscan.com/tx/0xabc123");
    }
}
