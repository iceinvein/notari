pub mod config;
pub mod config_builder;
pub mod ethereum;
pub mod factory;
pub mod mock;
pub mod types;
pub mod wallet;

#[cfg(test)]
mod tests;

pub use config::{BlockchainConfig, BlockchainEnvironment, ChainConfig, WalletConfig};
pub use config_builder::BlockchainConfigBuilder;
pub use ethereum::EthereumAnchorer;
pub use factory::BlockchainAnchorerFactory;
pub use mock::MockAnchorer;
pub use types::{AnchorProof, BlockchainAnchor};
pub use wallet::WalletManager;

use async_trait::async_trait;
use crate::error::NotariResult;

/// Trait for blockchain anchoring implementations
#[async_trait]
pub trait BlockchainAnchorer: Send + Sync {
    /// Anchor a hash to the blockchain
    async fn anchor(&self, hash: &str) -> NotariResult<AnchorProof>;

    /// Verify an anchor proof
    async fn verify(&self, hash: &str, proof: &AnchorProof) -> NotariResult<bool>;

    /// Estimate cost of anchoring in USD
    async fn estimate_cost(&self) -> NotariResult<f64>;

    /// Get wallet balance in native currency
    async fn get_balance(&self) -> NotariResult<f64>;
}
