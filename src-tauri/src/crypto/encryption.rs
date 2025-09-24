use super::{CryptoError, CryptoResult, EncryptionResult, DecryptionParams};
use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use std::time::{SystemTime, UNIX_EPOCH};

pub struct EncryptionManager {
    rng: OsRng,
}

impl EncryptionManager {
    pub fn new() -> Self {
        Self { rng: OsRng }
    }

    /// Encrypt data using AES-256-GCM with a provided key
    pub fn encrypt(&mut self, data: &[u8], key: &[u8], key_id: String) -> CryptoResult<EncryptionResult> {
        if key.len() != 32 {
            return Err(CryptoError::Encryption(
                "Key must be 32 bytes for AES-256".to_string(),
            ));
        }

        let cipher_key = Key::<Aes256Gcm>::from_slice(key);
        let cipher = Aes256Gcm::new(cipher_key);
        
        // Generate a random nonce
        let nonce = Aes256Gcm::generate_nonce(&mut self.rng);
        
        // Encrypt the data
        let encrypted_data = cipher
            .encrypt(&nonce, data)
            .map_err(|e| CryptoError::Encryption(format!("AES-GCM encryption failed: {}", e)))?;

        Ok(EncryptionResult {
            encrypted_data,
            iv: nonce.to_vec(),
            key_id,
            algorithm: "AES-256-GCM".to_string(),
        })
    }

    /// Decrypt data using AES-256-GCM with a provided key
    pub fn decrypt(&self, params: &DecryptionParams, key: &[u8]) -> CryptoResult<Vec<u8>> {
        if key.len() != 32 {
            return Err(CryptoError::Decryption(
                "Key must be 32 bytes for AES-256".to_string(),
            ));
        }

        if params.algorithm != "AES-256-GCM" {
            return Err(CryptoError::Decryption(format!(
                "Unsupported algorithm: {}",
                params.algorithm
            )));
        }

        if params.iv.len() != 12 {
            return Err(CryptoError::Decryption(
                "IV must be 12 bytes for AES-256-GCM".to_string(),
            ));
        }

        let cipher_key = Key::<Aes256Gcm>::from_slice(key);
        let cipher = Aes256Gcm::new(cipher_key);
        
        let nonce = Nonce::from_slice(&params.iv);
        
        // Decrypt the data
        let decrypted_data = cipher
            .decrypt(nonce, params.encrypted_data.as_ref())
            .map_err(|e| CryptoError::Decryption(format!("AES-GCM decryption failed: {}", e)))?;

        Ok(decrypted_data)
    }

    /// Generate a secure random key for AES-256
    pub fn generate_key(&mut self) -> CryptoResult<Vec<u8>> {
        let key = Aes256Gcm::generate_key(&mut self.rng);
        Ok(key.to_vec())
    }

    /// Encrypt data with a newly generated key
    pub fn encrypt_with_new_key(&mut self, data: &[u8], key_id: String) -> CryptoResult<(EncryptionResult, Vec<u8>)> {
        let key = self.generate_key()?;
        let encryption_result = self.encrypt(data, &key, key_id)?;
        Ok((encryption_result, key))
    }
}

impl Default for EncryptionManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Utility functions for common encryption operations
pub mod utils {
    use super::*;
    use base64::{engine::general_purpose, Engine as _};

    /// Encode encrypted data to base64 for storage/transmission
    pub fn encode_encryption_result(result: &EncryptionResult) -> String {
        let combined = [&result.encrypted_data[..], &result.iv[..]].concat();
        general_purpose::STANDARD.encode(combined)
    }

    /// Decode base64 encrypted data back to EncryptionResult
    pub fn decode_encryption_result(
        encoded: &str,
        key_id: String,
        algorithm: String,
    ) -> CryptoResult<EncryptionResult> {
        let combined = general_purpose::STANDARD
            .decode(encoded)
            .map_err(|e| CryptoError::Decryption(format!("Base64 decode failed: {}", e)))?;

        if combined.len() < 12 {
            return Err(CryptoError::Decryption(
                "Invalid encrypted data format".to_string(),
            ));
        }

        let iv_len = 12; // AES-GCM nonce is always 12 bytes
        let encrypted_data = combined[..combined.len() - iv_len].to_vec();
        let iv = combined[combined.len() - iv_len..].to_vec();

        Ok(EncryptionResult {
            encrypted_data,
            iv,
            key_id,
            algorithm,
        })
    }

    /// Create a timestamp for encryption operations
    pub fn current_timestamp() -> CryptoResult<u64> {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .map_err(|e| CryptoError::Encryption(format!("Time error: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let mut encryption_manager = EncryptionManager::new();
        let test_data = b"Hello, World! This is a test message.";
        let key_id = "test-key-123".to_string();
        
        // Generate a key and encrypt
        let (encryption_result, key) = encryption_manager
            .encrypt_with_new_key(test_data, key_id.clone())
            .unwrap();
        
        // Verify encryption result
        assert_eq!(encryption_result.key_id, key_id);
        assert_eq!(encryption_result.algorithm, "AES-256-GCM");
        assert_eq!(encryption_result.iv.len(), 12);
        assert!(!encryption_result.encrypted_data.is_empty());
        
        // Create decryption params
        let decryption_params = DecryptionParams {
            encrypted_data: encryption_result.encrypted_data,
            iv: encryption_result.iv,
            key_id: encryption_result.key_id,
            algorithm: encryption_result.algorithm,
        };
        
        // Decrypt and verify
        let decrypted_data = encryption_manager
            .decrypt(&decryption_params, &key)
            .unwrap();
        
        assert_eq!(decrypted_data, test_data);
    }

    #[test]
    fn test_encrypt_with_invalid_key_size() {
        let mut encryption_manager = EncryptionManager::new();
        let test_data = b"test data";
        let invalid_key = vec![0u8; 16]; // Wrong size (should be 32)
        let key_id = "test-key".to_string();
        
        let result = encryption_manager.encrypt(test_data, &invalid_key, key_id);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), CryptoError::Encryption(_)));
    }

    #[test]
    fn test_decrypt_with_wrong_algorithm() {
        let encryption_manager = EncryptionManager::new();
        let key = vec![0u8; 32];
        
        let params = DecryptionParams {
            encrypted_data: vec![1, 2, 3, 4],
            iv: vec![0u8; 12],
            key_id: "test".to_string(),
            algorithm: "INVALID-ALGORITHM".to_string(),
        };
        
        let result = encryption_manager.decrypt(&params, &key);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), CryptoError::Decryption(_)));
    }

    #[test]
    fn test_base64_encoding_decoding() {
        let mut encryption_manager = EncryptionManager::new();
        let test_data = b"Test data for base64 encoding";
        let key_id = "test-key".to_string();
        
        let (encryption_result, _) = encryption_manager
            .encrypt_with_new_key(test_data, key_id.clone())
            .unwrap();
        
        // Encode to base64
        let encoded = utils::encode_encryption_result(&encryption_result);
        assert!(!encoded.is_empty());
        
        // Decode back
        let decoded = utils::decode_encryption_result(
            &encoded,
            key_id,
            "AES-256-GCM".to_string(),
        ).unwrap();
        
        assert_eq!(decoded.encrypted_data, encryption_result.encrypted_data);
        assert_eq!(decoded.iv, encryption_result.iv);
        assert_eq!(decoded.algorithm, encryption_result.algorithm);
    }
}