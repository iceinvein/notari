use std::error::Error;

#[cfg(target_os = "macos")]
use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

const WALLET_KEYCHAIN_SERVICE: &str = "com.notari.blockchain.wallet";

/// Wallet manager for blockchain operations
pub struct WalletManager;

impl WalletManager {
    /// Store a private key in the keychain
    ///
    /// # Arguments
    /// * `chain_id` - The chain ID (e.g., 137 for Polygon)
    /// * `address` - The wallet address (for identification)
    /// * `private_key` - The private key to store (with or without 0x prefix)
    ///
    /// # Returns
    /// * `Ok(())` if successful
    /// * `Err` if keychain operation fails
    #[cfg(target_os = "macos")]
    pub fn store_private_key(
        chain_id: u64,
        address: &str,
        private_key: &str,
    ) -> Result<(), Box<dyn Error>> {
        let account = format!("chain_{}_address_{}", chain_id, address);
        set_generic_password(WALLET_KEYCHAIN_SERVICE, &account, private_key.as_bytes())?;
        Ok(())
    }

    /// Retrieve a private key from the keychain
    ///
    /// # Arguments
    /// * `chain_id` - The chain ID
    /// * `address` - The wallet address
    ///
    /// # Returns
    /// * `Ok(private_key)` if found
    /// * `Err` if not found or keychain operation fails
    #[cfg(target_os = "macos")]
    pub fn get_private_key(chain_id: u64, address: &str) -> Result<String, Box<dyn Error>> {
        let account = format!("chain_{}_address_{}", chain_id, address);
        let bytes = get_generic_password(WALLET_KEYCHAIN_SERVICE, &account)?;
        let private_key = String::from_utf8(bytes)?;
        Ok(private_key)
    }

    /// Delete a private key from the keychain
    ///
    /// # Arguments
    /// * `chain_id` - The chain ID
    /// * `address` - The wallet address
    ///
    /// # Returns
    /// * `Ok(())` if successful
    /// * `Err` if keychain operation fails
    #[cfg(target_os = "macos")]
    pub fn delete_private_key(chain_id: u64, address: &str) -> Result<(), Box<dyn Error>> {
        let account = format!("chain_{}_address_{}", chain_id, address);
        delete_generic_password(WALLET_KEYCHAIN_SERVICE, &account)?;
        Ok(())
    }

    /// Check if a private key exists in the keychain
    ///
    /// # Arguments
    /// * `chain_id` - The chain ID
    /// * `address` - The wallet address
    ///
    /// # Returns
    /// * `true` if the private key exists
    /// * `false` otherwise
    #[cfg(target_os = "macos")]
    pub fn has_private_key(chain_id: u64, address: &str) -> bool {
        Self::get_private_key(chain_id, address).is_ok()
    }

    // Stub implementations for non-macOS platforms
    #[cfg(not(target_os = "macos"))]
    pub fn store_private_key(
        _chain_id: u64,
        _address: &str,
        _private_key: &str,
    ) -> Result<(), Box<dyn Error>> {
        Err("Keychain storage not supported on this platform".into())
    }

    #[cfg(not(target_os = "macos"))]
    pub fn get_private_key(_chain_id: u64, _address: &str) -> Result<String, Box<dyn Error>> {
        Err("Keychain storage not supported on this platform".into())
    }

    #[cfg(not(target_os = "macos"))]
    pub fn delete_private_key(_chain_id: u64, _address: &str) -> Result<(), Box<dyn Error>> {
        Err("Keychain storage not supported on this platform".into())
    }

    #[cfg(not(target_os = "macos"))]
    pub fn has_private_key(_chain_id: u64, _address: &str) -> bool {
        false
    }

    /// Validate a private key format
    ///
    /// # Arguments
    /// * `private_key` - The private key to validate
    ///
    /// # Returns
    /// * `Ok(())` if valid
    /// * `Err` if invalid format
    pub fn validate_private_key(private_key: &str) -> Result<(), Box<dyn Error>> {
        let key = private_key.trim_start_matches("0x");

        // Check length (64 hex characters = 32 bytes)
        if key.len() != 64 {
            return Err("Private key must be 64 hex characters (32 bytes)".into());
        }

        // Check if valid hex
        hex::decode(key).map_err(|_| "Private key must be valid hexadecimal")?;

        Ok(())
    }

    /// Derive wallet address from private key
    ///
    /// # Arguments
    /// * `private_key` - The private key
    ///
    /// # Returns
    /// * `Ok(address)` - The Ethereum address
    /// * `Err` if invalid private key
    pub fn derive_address(private_key: &str) -> Result<String, Box<dyn Error>> {
        use ethers::prelude::*;

        let wallet: LocalWallet = private_key.parse()?;
        let address = format!("0x{:x}", wallet.address());
        Ok(address)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_private_key_valid() {
        let key = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        assert!(WalletManager::validate_private_key(key).is_ok());
    }

    #[test]
    fn test_validate_private_key_without_prefix() {
        let key = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        assert!(WalletManager::validate_private_key(key).is_ok());
    }

    #[test]
    fn test_validate_private_key_too_short() {
        let key = "0x1234";
        assert!(WalletManager::validate_private_key(key).is_err());
    }

    #[test]
    fn test_validate_private_key_invalid_hex() {
        let key = "0xZZZZ567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";
        assert!(WalletManager::validate_private_key(key).is_err());
    }

    #[test]
    fn test_derive_address() {
        // Test with a known private key
        let private_key = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318";
        let result = WalletManager::derive_address(private_key);
        assert!(result.is_ok());

        let address = result.unwrap();
        assert!(address.starts_with("0x"));
        assert_eq!(address.len(), 42); // 0x + 40 hex chars
    }

    #[test]
    fn test_keychain_account_format() {
        let chain_id = 137u64;
        let address = "0x1234567890abcdef1234567890abcdef12345678";
        let account = format!("chain_{}_address_{}", chain_id, address);
        assert_eq!(
            account,
            "chain_137_address_0x1234567890abcdef1234567890abcdef12345678"
        );
    }

    // Note: Keychain integration tests are skipped because they require
    // actual keychain access and would interfere with user's keychain.
    // These should be tested manually or in a sandboxed environment.
}
