use super::{CryptoError, CryptoResult, CryptoSignature};
use ring::{signature, digest};
use std::time::{SystemTime, UNIX_EPOCH};

pub struct SignatureManager;

impl SignatureManager {
    pub fn new() -> Self {
        Self
    }

    /// Sign data using Ed25519 with the device's private key
    pub fn sign(&self, data: &[u8], private_key: &[u8], key_id: String) -> CryptoResult<CryptoSignature> {
        let key_pair = signature::Ed25519KeyPair::from_pkcs8(private_key)
            .map_err(|e| CryptoError::SignatureGeneration(format!("Invalid private key: {}", e)))?;

        let signature_bytes = key_pair.sign(data);
        
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| CryptoError::SignatureGeneration(format!("Time error: {}", e)))?
            .as_secs();

        Ok(CryptoSignature {
            signature: signature_bytes.as_ref().to_vec(),
            algorithm: "Ed25519".to_string(),
            key_id,
            timestamp,
        })
    }

    /// Verify a signature using Ed25519 with the device's public key
    pub fn verify(&self, data: &[u8], signature: &CryptoSignature, public_key: &[u8]) -> CryptoResult<bool> {
        if signature.algorithm != "Ed25519" {
            return Err(CryptoError::SignatureVerification(format!(
                "Unsupported signature algorithm: {}",
                signature.algorithm
            )));
        }

        let public_key = signature::UnparsedPublicKey::new(&signature::ED25519, public_key);
        
        match public_key.verify(data, &signature.signature) {
            Ok(()) => Ok(true),
            Err(_) => Ok(false), // Verification failed, but not an error in our system
        }
    }

    /// Create a hash of data for signing (useful for large data)
    pub fn hash_for_signing(&self, data: &[u8]) -> CryptoResult<Vec<u8>> {
        let hash = digest::digest(&digest::SHA256, data);
        Ok(hash.as_ref().to_vec())
    }

    /// Sign a hash instead of raw data (for performance with large data)
    pub fn sign_hash(&self, hash: &[u8], private_key: &[u8], key_id: String) -> CryptoResult<CryptoSignature> {
        self.sign(hash, private_key, key_id)
    }

    /// Verify a signature against a hash
    pub fn verify_hash(&self, hash: &[u8], signature: &CryptoSignature, public_key: &[u8]) -> CryptoResult<bool> {
        self.verify(hash, signature, public_key)
    }

    /// Create a timestamped signature that includes the current time in the signed data
    pub fn sign_with_timestamp(&self, data: &[u8], private_key: &[u8], key_id: String) -> CryptoResult<CryptoSignature> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| CryptoError::SignatureGeneration(format!("Time error: {}", e)))?
            .as_secs();

        // Combine data with timestamp for signing
        let timestamp_bytes = timestamp.to_be_bytes();
        let combined_data = [data, &timestamp_bytes].concat();
        
        let mut signature = self.sign(&combined_data, private_key, key_id)?;
        signature.timestamp = timestamp;
        
        Ok(signature)
    }

    /// Verify a timestamped signature
    pub fn verify_with_timestamp(&self, data: &[u8], signature: &CryptoSignature, public_key: &[u8]) -> CryptoResult<bool> {
        // Combine data with the signature's timestamp
        let timestamp_bytes = signature.timestamp.to_be_bytes();
        let combined_data = [data, &timestamp_bytes].concat();
        
        self.verify(&combined_data, signature, public_key)
    }

    /// Batch sign multiple pieces of data
    pub fn batch_sign(&self, data_items: &[&[u8]], private_key: &[u8], key_id: String) -> CryptoResult<Vec<CryptoSignature>> {
        let mut signatures = Vec::new();
        
        for data in data_items {
            let signature = self.sign(data, private_key, key_id.clone())?;
            signatures.push(signature);
        }
        
        Ok(signatures)
    }

    /// Batch verify multiple signatures
    pub fn batch_verify(&self, data_items: &[&[u8]], signatures: &[CryptoSignature], public_key: &[u8]) -> CryptoResult<Vec<bool>> {
        if data_items.len() != signatures.len() {
            return Err(CryptoError::SignatureVerification(
                "Data items and signatures count mismatch".to_string(),
            ));
        }

        let mut results = Vec::new();
        
        for (data, signature) in data_items.iter().zip(signatures.iter()) {
            let is_valid = self.verify(data, signature, public_key)?;
            results.push(is_valid);
        }
        
        Ok(results)
    }
}

impl Default for SignatureManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Utility functions for signature operations
pub mod utils {
    use super::*;
    use base64::{engine::general_purpose, Engine as _};

    /// Encode signature to base64 for storage/transmission
    pub fn encode_signature(signature: &CryptoSignature) -> String {
        general_purpose::STANDARD.encode(&signature.signature)
    }

    /// Decode base64 signature
    pub fn decode_signature(
        encoded: &str,
        algorithm: String,
        key_id: String,
        timestamp: u64,
    ) -> CryptoResult<CryptoSignature> {
        let signature_bytes = general_purpose::STANDARD
            .decode(encoded)
            .map_err(|e| CryptoError::SignatureVerification(format!("Base64 decode failed: {}", e)))?;

        Ok(CryptoSignature {
            signature: signature_bytes,
            algorithm,
            key_id,
            timestamp,
        })
    }

    /// Create a signature for session integrity
    pub fn create_session_signature(
        session_id: &str,
        session_data_hash: &[u8],
        private_key: &[u8],
        key_id: String,
    ) -> CryptoResult<CryptoSignature> {
        let signature_manager = SignatureManager::new();
        
        // Combine session ID and data hash
        let combined_data = [session_id.as_bytes(), session_data_hash].concat();
        
        signature_manager.sign_with_timestamp(&combined_data, private_key, key_id)
    }

    /// Verify a session signature
    pub fn verify_session_signature(
        session_id: &str,
        session_data_hash: &[u8],
        signature: &CryptoSignature,
        public_key: &[u8],
    ) -> CryptoResult<bool> {
        let signature_manager = SignatureManager::new();
        
        // Combine session ID and data hash
        let combined_data = [session_id.as_bytes(), session_data_hash].concat();
        
        signature_manager.verify_with_timestamp(&combined_data, signature, public_key)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::crypto::keys::KeyManager;

    #[test]
    fn test_sign_and_verify() {
        let key_manager = KeyManager::new();
        let signature_manager = SignatureManager::new();
        
        let key_pair = key_manager.generate_ed25519_keypair().unwrap();
        let test_data = b"Hello, World! This is test data for signing.";
        let key_id = "test-key-123".to_string();
        
        // Sign the data
        let signature = signature_manager
            .sign(test_data, &key_pair.private_key, key_id.clone())
            .unwrap();
        
        // Verify signature properties
        assert_eq!(signature.algorithm, "Ed25519");
        assert_eq!(signature.key_id, key_id);
        assert!(!signature.signature.is_empty());
        assert!(signature.timestamp > 0);
        
        // Verify the signature
        let is_valid = signature_manager
            .verify(test_data, &signature, &key_pair.public_key)
            .unwrap();
        
        assert!(is_valid);
    }

    #[test]
    fn test_verify_invalid_signature() {
        let key_manager = KeyManager::new();
        let signature_manager = SignatureManager::new();
        
        let key_pair = key_manager.generate_ed25519_keypair().unwrap();
        let test_data = b"Original data";
        let different_data = b"Different data";
        let key_id = "test-key".to_string();
        
        // Sign original data
        let signature = signature_manager
            .sign(test_data, &key_pair.private_key, key_id)
            .unwrap();
        
        // Try to verify with different data
        let is_valid = signature_manager
            .verify(different_data, &signature, &key_pair.public_key)
            .unwrap();
        
        assert!(!is_valid);
    }

    #[test]
    fn test_hash_and_sign() {
        let key_manager = KeyManager::new();
        let signature_manager = SignatureManager::new();
        
        let key_pair = key_manager.generate_ed25519_keypair().unwrap();
        let large_data = vec![0u8; 1024 * 1024]; // 1MB of data
        let key_id = "test-key".to_string();
        
        // Hash the data
        let hash = signature_manager.hash_for_signing(&large_data).unwrap();
        assert_eq!(hash.len(), 32); // SHA-256 produces 32-byte hash
        
        // Sign the hash
        let signature = signature_manager
            .sign_hash(&hash, &key_pair.private_key, key_id)
            .unwrap();
        
        // Verify the hash signature
        let is_valid = signature_manager
            .verify_hash(&hash, &signature, &key_pair.public_key)
            .unwrap();
        
        assert!(is_valid);
    }

    #[test]
    fn test_timestamped_signature() {
        let key_manager = KeyManager::new();
        let signature_manager = SignatureManager::new();
        
        let key_pair = key_manager.generate_ed25519_keypair().unwrap();
        let test_data = b"Timestamped data";
        let key_id = "test-key".to_string();
        
        // Create timestamped signature
        let signature = signature_manager
            .sign_with_timestamp(test_data, &key_pair.private_key, key_id)
            .unwrap();
        
        // Verify timestamped signature
        let is_valid = signature_manager
            .verify_with_timestamp(test_data, &signature, &key_pair.public_key)
            .unwrap();
        
        assert!(is_valid);
        assert!(signature.timestamp > 0);
    }

    #[test]
    fn test_batch_operations() {
        let key_manager = KeyManager::new();
        let signature_manager = SignatureManager::new();
        
        let key_pair = key_manager.generate_ed25519_keypair().unwrap();
        let data1 = b"First piece of data";
        let data2 = b"Second piece of data";
        let data3 = b"Third piece of data";
        let data_items = vec![&data1[..], &data2[..], &data3[..]];
        let key_id = "test-key".to_string();
        
        // Batch sign
        let signatures = signature_manager
            .batch_sign(&data_items, &key_pair.private_key, key_id)
            .unwrap();
        
        assert_eq!(signatures.len(), 3);
        
        // Batch verify
        let results = signature_manager
            .batch_verify(&data_items, &signatures, &key_pair.public_key)
            .unwrap();
        
        assert_eq!(results.len(), 3);
        assert!(results.iter().all(|&r| r)); // All should be valid
    }

    #[test]
    fn test_session_signature_utils() {
        let key_manager = KeyManager::new();
        let key_pair = key_manager.generate_ed25519_keypair().unwrap();
        
        let session_id = "session-123";
        let session_data_hash = b"hash-of-session-data";
        let key_id = "device-key".to_string();
        
        // Create session signature
        let signature = utils::create_session_signature(
            session_id,
            session_data_hash,
            &key_pair.private_key,
            key_id,
        ).unwrap();
        
        // Verify session signature
        let is_valid = utils::verify_session_signature(
            session_id,
            session_data_hash,
            &signature,
            &key_pair.public_key,
        ).unwrap();
        
        assert!(is_valid);
    }
}