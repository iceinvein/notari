//! Keychain-based repository implementation
//!
//! This repository uses the system keychain for secure key storage.
//! On macOS, this uses the macOS Keychain. Other platforms can be added.

use super::traits::KeyRepository;
use crate::error::{NotariError, NotariResult};

#[cfg(target_os = "macos")]
use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

/// Service name for keychain entries
const SERVICE_NAME: &str = "com.notari.evidence";

/// Keychain-based key repository
///
/// Uses the system keychain for secure storage of cryptographic keys.
/// On macOS, this uses the macOS Keychain Services API.
pub struct KeychainRepository {
    service_name: String,
}

impl KeychainRepository {
    /// Create a new keychain repository with default service name
    pub fn new() -> Self {
        Self {
            service_name: SERVICE_NAME.to_string(),
        }
    }

    /// Create a new keychain repository with custom service name
    pub fn with_service_name(service_name: impl Into<String>) -> Self {
        Self {
            service_name: service_name.into(),
        }
    }

    /// Get the service name
    pub fn service_name(&self) -> &str {
        &self.service_name
    }
}

impl Default for KeychainRepository {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(target_os = "macos")]
impl KeyRepository for KeychainRepository {
    fn store_key(&self, key_id: &str, key_bytes: &[u8]) -> NotariResult<()> {
        set_generic_password(&self.service_name, key_id, key_bytes).map_err(|e| {
            NotariError::KeychainStoreFailed(format!("Failed to store key '{}': {}", key_id, e))
        })?;
        Ok(())
    }

    fn retrieve_key(&self, key_id: &str) -> NotariResult<Vec<u8>> {
        get_generic_password(&self.service_name, key_id)
            .map_err(|e| {
                NotariError::KeychainRetrieveFailed(format!(
                    "Failed to retrieve key '{}': {}",
                    key_id, e
                ))
            })
            .map(|bytes| bytes.to_vec())
    }

    fn delete_key(&self, key_id: &str) -> NotariResult<()> {
        delete_generic_password(&self.service_name, key_id).map_err(|e| {
            NotariError::KeychainDeleteFailed(format!("Failed to delete key '{}': {}", key_id, e))
        })?;
        Ok(())
    }

    fn has_key(&self, key_id: &str) -> NotariResult<bool> {
        match get_generic_password(&self.service_name, key_id) {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }

    fn list_keys(&self) -> NotariResult<Vec<String>> {
        // Note: macOS Keychain API doesn't provide a direct way to list all keys
        // for a service. This would require using the SecItemCopyMatching API
        // which is more complex. For now, we return an empty list.
        // In practice, we know the key IDs we use (signing_key, wallet keys, etc.)
        Ok(vec![])
    }
}

// Stub implementations for non-macOS platforms
#[cfg(not(target_os = "macos"))]
impl KeyRepository for KeychainRepository {
    fn store_key(&self, _key_id: &str, _key_bytes: &[u8]) -> NotariResult<()> {
        Err(NotariError::PlatformNotSupported)
    }

    fn retrieve_key(&self, _key_id: &str) -> NotariResult<Vec<u8>> {
        Err(NotariError::PlatformNotSupported)
    }

    fn delete_key(&self, _key_id: &str) -> NotariResult<()> {
        Err(NotariError::PlatformNotSupported)
    }

    fn has_key(&self, _key_id: &str) -> NotariResult<bool> {
        Err(NotariError::PlatformNotSupported)
    }

    fn list_keys(&self) -> NotariResult<Vec<String>> {
        Err(NotariError::PlatformNotSupported)
    }
}

/// Well-known key identifiers used by Notari
pub mod key_ids {
    /// Signing key for evidence manifests (Ed25519)
    pub const SIGNING_KEY: &str = "signing_key";

    /// Encryption key for video encryption (X25519)
    pub const ENCRYPTION_KEY: &str = "encryption_key";

    /// Prefix for wallet private keys (followed by chain_id)
    pub const WALLET_KEY_PREFIX: &str = "wallet_";

    /// Create a wallet key ID for a specific chain
    pub fn wallet_key(chain_id: u64) -> String {
        format!("{}{}", WALLET_KEY_PREFIX, chain_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keychain_repository_creation() {
        let repo = KeychainRepository::new();
        assert_eq!(repo.service_name(), SERVICE_NAME);

        let custom_repo = KeychainRepository::with_service_name("com.test.app");
        assert_eq!(custom_repo.service_name(), "com.test.app");
    }

    #[test]
    fn test_key_ids() {
        assert_eq!(key_ids::SIGNING_KEY, "signing_key");
        assert_eq!(key_ids::wallet_key(1), "wallet_1");
        assert_eq!(key_ids::wallet_key(80002), "wallet_80002");
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn test_keychain_operations() {
        let repo = KeychainRepository::with_service_name("com.notari.test");
        let test_key_id = "test_key_12345";
        let test_data = b"test_secret_data";

        // Clean up any existing test key
        let _ = repo.delete_key(test_key_id);

        // Initially should not exist
        assert!(!repo.has_key(test_key_id).unwrap());

        // Store key
        repo.store_key(test_key_id, test_data).unwrap();

        // Should exist now
        assert!(repo.has_key(test_key_id).unwrap());

        // Retrieve key
        let retrieved = repo.retrieve_key(test_key_id).unwrap();
        assert_eq!(retrieved, test_data);

        // Delete key
        repo.delete_key(test_key_id).unwrap();

        // Should not exist anymore
        assert!(!repo.has_key(test_key_id).unwrap());
    }

    #[cfg(not(target_os = "macos"))]
    #[test]
    fn test_keychain_not_supported() {
        let repo = KeychainRepository::new();

        // All operations should return PlatformNotSupported error
        assert!(matches!(
            repo.store_key("test", b"data"),
            Err(NotariError::PlatformNotSupported)
        ));

        assert!(matches!(
            repo.retrieve_key("test"),
            Err(NotariError::PlatformNotSupported)
        ));

        assert!(matches!(
            repo.delete_key("test"),
            Err(NotariError::PlatformNotSupported)
        ));

        assert!(matches!(
            repo.has_key("test"),
            Err(NotariError::PlatformNotSupported)
        ));

        assert!(matches!(
            repo.list_keys(),
            Err(NotariError::PlatformNotSupported)
        ));
    }
}
