pub mod config;
pub mod ethereum;
pub mod mock;
pub mod types;
pub mod wallet;

#[cfg(test)]
mod tests;

pub use config::{BlockchainConfig, BlockchainEnvironment, ChainConfig, WalletConfig};
pub use ethereum::EthereumAnchorer;
pub use mock::MockAnchorer;
pub use types::{AnchorProof, BlockchainAnchor};
pub use wallet::WalletManager;

use async_trait::async_trait;
use std::error::Error;

/// Trait for blockchain anchoring implementations
#[async_trait]
pub trait BlockchainAnchorer: Send + Sync {
    /// Anchor a hash to the blockchain
    async fn anchor(&self, hash: &str) -> Result<AnchorProof, Box<dyn Error>>;

    /// Verify an anchor proof
    async fn verify(&self, hash: &str, proof: &AnchorProof) -> Result<bool, Box<dyn Error>>;

    /// Estimate cost of anchoring in USD
    async fn estimate_cost(&self) -> Result<f64, Box<dyn Error>>;

    /// Get wallet balance in native currency
    async fn get_balance(&self) -> Result<f64, Box<dyn Error>>;
}
