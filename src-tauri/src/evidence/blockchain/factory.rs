use super::{
    BlockchainAnchorer, BlockchainConfig, BlockchainEnvironment, EthereumAnchorer, MockAnchorer,
    WalletManager,
};
use std::error::Error;

/// Factory for creating blockchain anchorer instances
///
/// This factory encapsulates the logic for creating the appropriate
/// anchorer implementation based on the blockchain configuration.
/// It follows the Strategy pattern, allowing different anchoring
/// strategies to be swapped at runtime.
pub struct BlockchainAnchorerFactory;

impl BlockchainAnchorerFactory {
    /// Create an anchorer instance from blockchain configuration
    ///
    /// # Arguments
    /// * `config` - The blockchain configuration
    ///
    /// # Returns
    /// A boxed trait object implementing BlockchainAnchorer
    ///
    /// # Errors
    /// Returns an error if:
    /// - Wallet is not configured for non-Mock environments
    /// - Private key cannot be retrieved
    /// - Anchorer initialization fails
    pub fn create_anchorer(
        config: &BlockchainConfig,
    ) -> Result<Box<dyn BlockchainAnchorer>, Box<dyn Error>> {
        match config.environment {
            BlockchainEnvironment::Mock => Ok(Box::new(MockAnchorer::new())),
            BlockchainEnvironment::Testnet | BlockchainEnvironment::Mainnet => {
                let wallet = config
                    .wallet
                    .as_ref()
                    .ok_or("No wallet configured for non-Mock environment")?;

                let private_key = WalletManager::get_private_key(
                    config.chain.chain_id,
                    &wallet.address,
                )?;

                let anchorer = EthereumAnchorer::new(
                    &config.chain.rpc_url,
                    &private_key,
                    &config.chain.contract_address,
                    config.chain.chain_id,
                    &config.chain.name,
                    &config.chain.explorer_url,
                )?;

                Ok(Box::new(anchorer))
            }
        }
    }

    /// Create an anchorer instance from individual config components
    ///
    /// This is a convenience method for cases where the config is already
    /// destructured into its components.
    ///
    /// # Arguments
    /// * `environment` - The blockchain environment (Mock, Testnet, Mainnet)
    /// * `chain_config` - The chain configuration
    /// * `wallet_config` - Optional wallet configuration
    ///
    /// # Returns
    /// A boxed trait object implementing BlockchainAnchorer
    pub fn create_from_components(
        environment: &BlockchainEnvironment,
        chain_config: &super::ChainConfig,
        wallet_config: &Option<super::WalletConfig>,
    ) -> Result<Box<dyn BlockchainAnchorer>, Box<dyn Error>> {
        match environment {
            BlockchainEnvironment::Mock => Ok(Box::new(MockAnchorer::new())),
            BlockchainEnvironment::Testnet | BlockchainEnvironment::Mainnet => {
                let wallet = wallet_config
                    .as_ref()
                    .ok_or("No wallet configured for non-Mock environment")?;

                let private_key = WalletManager::get_private_key(
                    chain_config.chain_id,
                    &wallet.address,
                )?;

                let anchorer = EthereumAnchorer::new(
                    &chain_config.rpc_url,
                    &private_key,
                    &chain_config.contract_address,
                    chain_config.chain_id,
                    &chain_config.name,
                    &chain_config.explorer_url,
                )?;

                Ok(Box::new(anchorer))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::evidence::blockchain::ChainConfig;

    #[test]
    fn test_create_mock_anchorer() {
        let config = BlockchainConfig {
            enabled: true,
            environment: BlockchainEnvironment::Mock,
            chain: ChainConfig {
                chain_id: 1,
                name: "Mock".to_string(),
                rpc_url: "".to_string(),
                contract_address: "".to_string(),
                explorer_url: "".to_string(),
                currency_symbol: "ETH".to_string(),
            },
            auto_anchor: false,
            wallet: None,
        };

        let result = BlockchainAnchorerFactory::create_anchorer(&config);
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_ethereum_anchorer_without_wallet() {
        let config = BlockchainConfig {
            enabled: true,
            environment: BlockchainEnvironment::Testnet,
            chain: ChainConfig {
                chain_id: 80002,
                name: "Polygon Amoy".to_string(),
                rpc_url: "https://rpc-amoy.polygon.technology".to_string(),
                contract_address: "0x0000000000000000000000000000000000000000".to_string(),
                explorer_url: "https://amoy.polygonscan.com".to_string(),
                currency_symbol: "MATIC".to_string(),
            },
            auto_anchor: false,
            wallet: None,
        };

        let result = BlockchainAnchorerFactory::create_anchorer(&config);
        assert!(result.is_err());
        if let Err(e) = result {
            assert!(e.to_string().contains("No wallet configured"));
        }
    }

    #[test]
    fn test_create_from_components_mock() {
        let environment = BlockchainEnvironment::Mock;
        let chain_config = ChainConfig {
            chain_id: 1,
            name: "Mock".to_string(),
            rpc_url: "".to_string(),
            contract_address: "".to_string(),
            explorer_url: "".to_string(),
            currency_symbol: "ETH".to_string(),
        };
        let wallet_config = None;

        let result = BlockchainAnchorerFactory::create_from_components(
            &environment,
            &chain_config,
            &wallet_config,
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_create_from_components_testnet_without_wallet() {
        let environment = BlockchainEnvironment::Testnet;
        let chain_config = ChainConfig {
            chain_id: 80002,
            name: "Polygon Amoy".to_string(),
            rpc_url: "https://rpc-amoy.polygon.technology".to_string(),
            contract_address: "0x0000000000000000000000000000000000000000".to_string(),
            explorer_url: "https://amoy.polygonscan.com".to_string(),
            currency_symbol: "MATIC".to_string(),
        };
        let wallet_config = None;

        let result = BlockchainAnchorerFactory::create_from_components(
            &environment,
            &chain_config,
            &wallet_config,
        );
        assert!(result.is_err());
        if let Err(e) = result {
            assert!(e.to_string().contains("No wallet configured"));
        }
    }
}

