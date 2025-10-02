use super::config::{BlockchainConfig, BlockchainEnvironment, ChainConfig, WalletConfig};
use crate::error::{NotariError, NotariResult};

/// Builder for constructing BlockchainConfig instances with a fluent API
///
/// # Example
/// ```
/// use notari::evidence::blockchain::BlockchainConfigBuilder;
/// use notari::evidence::blockchain::{BlockchainEnvironment, ChainConfig};
///
/// let config = BlockchainConfigBuilder::new()
///     .enabled(true)
///     .environment(BlockchainEnvironment::Testnet)
///     .chain(ChainConfig::polygon_amoy())
///     .auto_anchor(true)
///     .build()
///     .unwrap();
/// ```
#[derive(Debug)]
pub struct BlockchainConfigBuilder {
    enabled: bool,
    environment: Option<BlockchainEnvironment>,
    chain: Option<ChainConfig>,
    wallet: Option<WalletConfig>,
    auto_anchor: bool,
}

impl BlockchainConfigBuilder {
    /// Create a new builder with default values
    pub fn new() -> Self {
        Self {
            enabled: false,
            environment: None,
            chain: None,
            wallet: None,
            auto_anchor: false,
        }
    }

    /// Set whether blockchain anchoring is enabled
    pub fn enabled(mut self, enabled: bool) -> Self {
        self.enabled = enabled;
        self
    }

    /// Set the blockchain environment
    pub fn environment(mut self, env: BlockchainEnvironment) -> Self {
        self.environment = Some(env);
        self
    }

    /// Set the chain configuration
    pub fn chain(mut self, chain: ChainConfig) -> Self {
        self.chain = Some(chain);
        self
    }

    /// Set the chain configuration by chain ID
    pub fn chain_id(mut self, chain_id: u64) -> NotariResult<Self> {
        let chain = ChainConfig::from_chain_id(chain_id).ok_or_else(|| {
            NotariError::BuilderError(format!("Unknown chain ID: {}", chain_id))
        })?;
        self.chain = Some(chain);
        Ok(self)
    }

    /// Set the wallet configuration
    pub fn wallet(mut self, wallet: WalletConfig) -> Self {
        self.wallet = Some(wallet);
        self
    }

    /// Set the wallet by address
    pub fn wallet_address(mut self, address: impl Into<String>) -> Self {
        self.wallet = Some(WalletConfig {
            address: address.into(),
        });
        self
    }

    /// Set whether to automatically anchor recordings
    pub fn auto_anchor(mut self, auto_anchor: bool) -> Self {
        self.auto_anchor = auto_anchor;
        self
    }

    /// Build the BlockchainConfig instance
    ///
    /// # Errors
    /// Returns `NotariError::BuilderError` if required fields are missing or invalid
    pub fn build(self) -> NotariResult<BlockchainConfig> {
        // If enabled, environment and chain are required
        if self.enabled {
            let environment = self.environment.ok_or_else(|| {
                NotariError::BuilderError(
                    "environment is required when blockchain is enabled".to_string(),
                )
            })?;

            let chain = self.chain.ok_or_else(|| {
                NotariError::BuilderError("chain is required when blockchain is enabled".to_string())
            })?;

            // Validate environment and chain compatibility
            match (&environment, chain.chain_id) {
                (BlockchainEnvironment::Mock, _) => {
                    // Mock accepts any chain ID
                }
                (BlockchainEnvironment::Testnet, chain_id) => {
                    // Validate testnet chain IDs
                    if ![80002, 11155111, 421614].contains(&chain_id) {
                        return Err(NotariError::BuilderError(format!(
                            "Chain ID {} is not a valid testnet",
                            chain_id
                        )));
                    }
                }
                (BlockchainEnvironment::Mainnet, chain_id) => {
                    // Validate mainnet chain IDs
                    if ![1, 137, 42161].contains(&chain_id) {
                        return Err(NotariError::BuilderError(format!(
                            "Chain ID {} is not a valid mainnet",
                            chain_id
                        )));
                    }
                }
            }

            Ok(BlockchainConfig {
                enabled: true,
                environment,
                chain,
                wallet: self.wallet,
                auto_anchor: self.auto_anchor,
            })
        } else {
            // If disabled, use defaults
            Ok(BlockchainConfig {
                enabled: false,
                environment: self.environment.unwrap_or(BlockchainEnvironment::Mock),
                chain: self.chain.unwrap_or_else(ChainConfig::polygon_amoy),
                wallet: self.wallet,
                auto_anchor: false,
            })
        }
    }
}

impl Default for BlockchainConfigBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_builder_disabled_config() {
        let config = BlockchainConfigBuilder::new().build().unwrap();

        assert!(!config.enabled);
        assert_eq!(config.environment, BlockchainEnvironment::Mock);
        assert!(!config.auto_anchor);
    }

    #[test]
    fn test_builder_enabled_testnet() {
        let config = BlockchainConfigBuilder::new()
            .enabled(true)
            .environment(BlockchainEnvironment::Testnet)
            .chain(ChainConfig::polygon_amoy())
            .auto_anchor(true)
            .build()
            .unwrap();

        assert!(config.enabled);
        assert_eq!(config.environment, BlockchainEnvironment::Testnet);
        assert_eq!(config.chain.chain_id, 80002);
        assert!(config.auto_anchor);
    }

    #[test]
    fn test_builder_with_wallet() {
        let wallet_address = "0x1234567890abcdef1234567890abcdef12345678";

        let config = BlockchainConfigBuilder::new()
            .enabled(true)
            .environment(BlockchainEnvironment::Testnet)
            .chain(ChainConfig::polygon_amoy())
            .wallet_address(wallet_address)
            .build()
            .unwrap();

        assert!(config.wallet.is_some());
        assert_eq!(config.wallet.unwrap().address, wallet_address);
    }

    #[test]
    fn test_builder_chain_by_id() {
        let config = BlockchainConfigBuilder::new()
            .enabled(true)
            .environment(BlockchainEnvironment::Mainnet)
            .chain_id(137)
            .unwrap()
            .build()
            .unwrap();

        assert_eq!(config.chain.chain_id, 137);
        assert_eq!(config.chain.name, "Polygon");
    }

    #[test]
    fn test_builder_missing_environment() {
        let result = BlockchainConfigBuilder::new()
            .enabled(true)
            .chain(ChainConfig::polygon_amoy())
            .build();

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), NotariError::BuilderError(_)));
    }

    #[test]
    fn test_builder_missing_chain() {
        let result = BlockchainConfigBuilder::new()
            .enabled(true)
            .environment(BlockchainEnvironment::Testnet)
            .build();

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), NotariError::BuilderError(_)));
    }

    #[test]
    fn test_builder_invalid_testnet_chain() {
        let result = BlockchainConfigBuilder::new()
            .enabled(true)
            .environment(BlockchainEnvironment::Testnet)
            .chain(ChainConfig::polygon_mainnet()) // Mainnet chain on testnet env
            .build();

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), NotariError::BuilderError(_)));
    }

    #[test]
    fn test_builder_invalid_mainnet_chain() {
        let result = BlockchainConfigBuilder::new()
            .enabled(true)
            .environment(BlockchainEnvironment::Mainnet)
            .chain(ChainConfig::polygon_amoy()) // Testnet chain on mainnet env
            .build();

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), NotariError::BuilderError(_)));
    }

    #[test]
    fn test_builder_mock_accepts_any_chain() {
        let config = BlockchainConfigBuilder::new()
            .enabled(true)
            .environment(BlockchainEnvironment::Mock)
            .chain(ChainConfig::polygon_mainnet()) // Any chain works with Mock
            .build()
            .unwrap();

        assert_eq!(config.environment, BlockchainEnvironment::Mock);
        assert_eq!(config.chain.chain_id, 137);
    }

    #[test]
    fn test_builder_unknown_chain_id() {
        let result = BlockchainConfigBuilder::new()
            .enabled(true)
            .environment(BlockchainEnvironment::Testnet)
            .chain_id(99999);

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), NotariError::BuilderError(_)));
    }
}

