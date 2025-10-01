use serde::{Deserialize, Serialize};

/// Blockchain configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockchainConfig {
    /// Whether blockchain anchoring is enabled
    pub enabled: bool,
    
    /// Environment (mock, testnet, mainnet)
    pub environment: BlockchainEnvironment,
    
    /// Chain configuration
    pub chain: ChainConfig,
    
    /// Wallet configuration
    #[serde(skip_serializing_if = "Option::is_none")]
    pub wallet: Option<WalletConfig>,
    
    /// Automatically anchor recordings after completion
    pub auto_anchor: bool,
}

/// Blockchain environment
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum BlockchainEnvironment {
    /// Mock implementation for development (no real blockchain)
    Mock,
    
    /// Testnet for testing with free tokens
    Testnet,
    
    /// Mainnet for production (real costs)
    Mainnet,
}

/// Chain configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainConfig {
    pub chain_id: u64,
    pub name: String,
    pub rpc_url: String,
    pub contract_address: String,
    pub explorer_url: String,
    pub currency_symbol: String,
}

/// Wallet configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WalletConfig {
    /// Public wallet address
    pub address: String,
    
    // Private key is stored encrypted in system keychain, not here
}

impl Default for BlockchainConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            environment: BlockchainEnvironment::Mock,
            chain: ChainConfig::polygon_amoy(),
            wallet: None,
            auto_anchor: false,
        }
    }
}

impl ChainConfig {
    /// Polygon Amoy testnet (free testing)
    pub fn polygon_amoy() -> Self {
        Self {
            chain_id: 80002,
            name: "Polygon Amoy".to_string(),
            rpc_url: "https://rpc-amoy.polygon.technology".to_string(),
            contract_address: "0x0000000000000000000000000000000000000000".to_string(), // TODO: Deploy contract
            explorer_url: "https://amoy.polygonscan.com".to_string(),
            currency_symbol: "MATIC".to_string(),
        }
    }
    
    /// Polygon mainnet (low cost)
    pub fn polygon_mainnet() -> Self {
        Self {
            chain_id: 137,
            name: "Polygon".to_string(),
            rpc_url: "https://polygon-rpc.com".to_string(),
            contract_address: "0x0000000000000000000000000000000000000000".to_string(), // TODO: Deploy contract
            explorer_url: "https://polygonscan.com".to_string(),
            currency_symbol: "MATIC".to_string(),
        }
    }
    
    /// Ethereum mainnet (high cost, maximum security)
    pub fn ethereum_mainnet() -> Self {
        Self {
            chain_id: 1,
            name: "Ethereum".to_string(),
            rpc_url: "https://eth.llamarpc.com".to_string(),
            contract_address: "0x0000000000000000000000000000000000000000".to_string(), // TODO: Deploy contract
            explorer_url: "https://etherscan.io".to_string(),
            currency_symbol: "ETH".to_string(),
        }
    }
    
    /// Arbitrum One (medium cost, fast)
    pub fn arbitrum_one() -> Self {
        Self {
            chain_id: 42161,
            name: "Arbitrum One".to_string(),
            rpc_url: "https://arb1.arbitrum.io/rpc".to_string(),
            contract_address: "0x0000000000000000000000000000000000000000".to_string(), // TODO: Deploy contract
            explorer_url: "https://arbiscan.io".to_string(),
            currency_symbol: "ETH".to_string(),
        }
    }
    
    /// Base mainnet (low cost, Coinbase L2)
    pub fn base_mainnet() -> Self {
        Self {
            chain_id: 8453,
            name: "Base".to_string(),
            rpc_url: "https://mainnet.base.org".to_string(),
            contract_address: "0x0000000000000000000000000000000000000000".to_string(), // TODO: Deploy contract
            explorer_url: "https://basescan.org".to_string(),
            currency_symbol: "ETH".to_string(),
        }
    }
    
    /// Get all available chains
    pub fn all_chains() -> Vec<Self> {
        vec![
            Self::polygon_amoy(),
            Self::polygon_mainnet(),
            Self::arbitrum_one(),
            Self::base_mainnet(),
            Self::ethereum_mainnet(),
        ]
    }
    
    /// Get chain by ID
    pub fn from_chain_id(chain_id: u64) -> Option<Self> {
        Self::all_chains().into_iter().find(|c| c.chain_id == chain_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = BlockchainConfig::default();
        assert!(!config.enabled);
        assert_eq!(config.environment, BlockchainEnvironment::Mock);
        assert!(!config.auto_anchor);
    }
    
    #[test]
    fn test_chain_configs() {
        let polygon = ChainConfig::polygon_mainnet();
        assert_eq!(polygon.chain_id, 137);
        assert_eq!(polygon.currency_symbol, "MATIC");
        
        let ethereum = ChainConfig::ethereum_mainnet();
        assert_eq!(ethereum.chain_id, 1);
        assert_eq!(ethereum.currency_symbol, "ETH");
    }
    
    #[test]
    fn test_from_chain_id() {
        let polygon = ChainConfig::from_chain_id(137).unwrap();
        assert_eq!(polygon.name, "Polygon");
        
        let invalid = ChainConfig::from_chain_id(99999);
        assert!(invalid.is_none());
    }
    
    #[test]
    fn test_config_serialization() {
        let config = BlockchainConfig::default();
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: BlockchainConfig = serde_json::from_str(&json).unwrap();
        
        assert_eq!(config.enabled, deserialized.enabled);
        assert_eq!(config.environment, deserialized.environment);
    }
}

