//! Encryption key pair management for X25519 public key encryption
//!
//! This module manages X25519 key pairs used for encrypting video files.
//! These are separate from Ed25519 signing keys used for digital signatures.
//!
//! Key Storage:
//! - Private keys: Stored in macOS Keychain (secure)
//! - Public keys: Can be exported and shared with others
//!
//! Usage:
//! - Generate a key pair once per user
//! - Share public key with people who will send you encrypted videos
//! - Use their public keys to encrypt videos for them

use crate::error::{NotariError, NotariResult};
use base64::{engine::general_purpose, Engine as _};
use crypto_box::{PublicKey, SecretKey};
use rand::rngs::OsRng;

/// Encryption key manager for X25519 key pairs
pub struct EncryptionKeyManager {
    secret_key: SecretKey,
}

impl EncryptionKeyManager {
    /// Generate a new X25519 keypair
    pub fn generate() -> Self {
        let secret_key = SecretKey::generate(&mut OsRng);
        Self { secret_key }
    }

    /// Load keypair from secret key bytes
    pub fn from_bytes(bytes: &[u8]) -> NotariResult<Self> {
        if bytes.len() != 32 {
            return Err(NotariError::EncryptionFailed(
                "Invalid key length: expected 32 bytes".to_string(),
            ));
        }

        let mut key_bytes = [0u8; 32];
        key_bytes.copy_from_slice(bytes);
        let secret_key = SecretKey::from(key_bytes);

        Ok(Self { secret_key })
    }

    /// Get the secret key bytes (private key)
    pub fn to_bytes(&self) -> [u8; 32] {
        self.secret_key.to_bytes()
    }

    /// Get the public key
    pub fn public_key(&self) -> PublicKey {
        self.secret_key.public_key()
    }

    /// Get the secret key reference
    pub fn secret_key(&self) -> &SecretKey {
        &self.secret_key
    }

    /// Export public key as base64 string
    pub fn export_public_key(&self) -> String {
        let public_key = self.public_key();
        general_purpose::STANDARD.encode(public_key.as_bytes())
    }

    /// Import public key from base64 string
    pub fn import_public_key(public_key_b64: &str) -> NotariResult<PublicKey> {
        let public_key_bytes = general_purpose::STANDARD
            .decode(public_key_b64)
            .map_err(|e| NotariError::EncryptionFailed(format!("Invalid base64: {}", e)))?;

        if public_key_bytes.len() != 32 {
            return Err(NotariError::EncryptionFailed(
                "Invalid public key length: expected 32 bytes".to_string(),
            ));
        }

        let mut key_bytes = [0u8; 32];
        key_bytes.copy_from_slice(&public_key_bytes);
        Ok(PublicKey::from(key_bytes))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_keypair() {
        let key_manager = EncryptionKeyManager::generate();
        let public_key = key_manager.public_key();
        assert_eq!(public_key.as_bytes().len(), 32);
    }

    #[test]
    fn test_export_import_public_key() {
        let key_manager = EncryptionKeyManager::generate();
        let exported = key_manager.export_public_key();

        // Should be valid base64
        assert!(!exported.is_empty());

        // Should be able to import it back
        let imported = EncryptionKeyManager::import_public_key(&exported).unwrap();
        assert_eq!(imported.as_bytes(), key_manager.public_key().as_bytes());
    }

    #[test]
    fn test_from_bytes_roundtrip() {
        let key_manager1 = EncryptionKeyManager::generate();
        let bytes = key_manager1.to_bytes();

        let key_manager2 = EncryptionKeyManager::from_bytes(&bytes).unwrap();

        assert_eq!(
            key_manager1.public_key().as_bytes(),
            key_manager2.public_key().as_bytes()
        );
    }

    #[test]
    fn test_invalid_key_length() {
        let result = EncryptionKeyManager::from_bytes(&[0u8; 16]);
        assert!(result.is_err());

        let result = EncryptionKeyManager::from_bytes(&[0u8; 64]);
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_public_key_base64() {
        let result = EncryptionKeyManager::import_public_key("not-valid-base64!!!");
        assert!(result.is_err());
    }

    #[test]
    fn test_invalid_public_key_length() {
        // Valid base64 but wrong length
        let short_key = general_purpose::STANDARD.encode(&[0u8; 16]);
        let result = EncryptionKeyManager::import_public_key(&short_key);
        assert!(result.is_err());
    }
}
