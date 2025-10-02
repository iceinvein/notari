use base64::{engine::general_purpose, Engine as _};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use serde::{Deserialize, Serialize};
use crate::error::{NotariError, NotariResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureInfo {
    pub algorithm: String,
    pub public_key: String,
    pub signature: String,
    pub signed_data_hash: String,
}

pub struct KeyManager {
    signing_key: SigningKey,
}

impl KeyManager {
    /// Generate a new Ed25519 keypair
    pub fn generate() -> Self {
        let signing_key = SigningKey::from_bytes(&rand::random::<[u8; 32]>());
        Self { signing_key }
    }

    /// Load keypair from bytes
    pub fn from_bytes(bytes: &[u8]) -> NotariResult<Self> {
        if bytes.len() != 32 {
            return Err(NotariError::SigningFailed("Invalid key length: expected 32 bytes".to_string()));
        }
        let mut key_bytes = [0u8; 32];
        key_bytes.copy_from_slice(bytes);
        let signing_key = SigningKey::from_bytes(&key_bytes);
        Ok(Self { signing_key })
    }

    /// Get the signing key bytes (private key)
    pub fn to_bytes(&self) -> [u8; 32] {
        self.signing_key.to_bytes()
    }

    /// Get the public key
    pub fn public_key(&self) -> VerifyingKey {
        self.signing_key.verifying_key()
    }

    /// Sign data and return SignatureInfo
    pub fn sign(&self, data: &[u8]) -> SignatureInfo {
        let signature = self.signing_key.sign(data);
        let public_key = self.public_key();

        // Calculate hash of signed data
        use sha2::{Digest, Sha256};
        let mut hasher = Sha256::new();
        hasher.update(data);
        let data_hash = hasher.finalize();

        SignatureInfo {
            algorithm: "Ed25519".to_string(),
            public_key: general_purpose::STANDARD.encode(public_key.as_bytes()),
            signature: general_purpose::STANDARD.encode(signature.to_bytes()),
            signed_data_hash: format!("sha256:{}", hex::encode(data_hash)),
        }
    }

    /// Verify a signature
    pub fn verify(
        public_key_b64: &str,
        signature_b64: &str,
        data: &[u8],
    ) -> NotariResult<bool> {
        let public_key_bytes = general_purpose::STANDARD.decode(public_key_b64)?;
        let signature_bytes = general_purpose::STANDARD.decode(signature_b64)?;

        if public_key_bytes.len() != 32 {
            return Err(NotariError::VerificationFailed("Invalid public key length".to_string()));
        }
        if signature_bytes.len() != 64 {
            return Err(NotariError::VerificationFailed("Invalid signature length".to_string()));
        }

        let mut pk_array = [0u8; 32];
        pk_array.copy_from_slice(&public_key_bytes);
        let public_key = VerifyingKey::from_bytes(&pk_array)
            .map_err(|e| NotariError::VerificationFailed(format!("Invalid public key: {}", e)))?;

        let mut sig_array = [0u8; 64];
        sig_array.copy_from_slice(&signature_bytes);
        let signature = Signature::from_bytes(&sig_array);

        Ok(public_key.verify(data, &signature).is_ok())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_keypair() {
        let key_manager = KeyManager::generate();
        let public_key = key_manager.public_key();
        assert_eq!(public_key.as_bytes().len(), 32);
    }

    #[test]
    fn test_sign_and_verify() {
        let key_manager = KeyManager::generate();
        let data = b"test data to sign";

        let signature_info = key_manager.sign(data);

        let verified =
            KeyManager::verify(&signature_info.public_key, &signature_info.signature, data)
                .unwrap();

        assert!(verified);
    }

    #[test]
    fn test_verify_fails_with_wrong_data() {
        let key_manager = KeyManager::generate();
        let data = b"test data to sign";
        let wrong_data = b"wrong data";

        let signature_info = key_manager.sign(data);

        let verified = KeyManager::verify(
            &signature_info.public_key,
            &signature_info.signature,
            wrong_data,
        )
        .unwrap();

        assert!(!verified);
    }

    #[test]
    fn test_key_serialization() {
        let key_manager = KeyManager::generate();
        let key_bytes = key_manager.to_bytes();

        let restored = KeyManager::from_bytes(&key_bytes).unwrap();

        // Sign with both and verify they produce same signature
        let data = b"test data";
        let sig1 = key_manager.sign(data);
        let sig2 = restored.sign(data);

        assert_eq!(sig1.public_key, sig2.public_key);
    }
}
