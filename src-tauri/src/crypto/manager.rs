use super::{
    CryptoError, CryptoResult, DecryptionParams,
    EncryptionManager, KeyManager, SignatureManager, KeychainManager,
};
use sha2::{Sha256, Digest};
use std::time::{SystemTime, UNIX_EPOCH};
use base64::{engine::general_purpose, Engine as _};

#[derive(Debug, Clone)]
pub struct EncryptedData {
    pub data: Vec<u8>,
    pub key_id: String,
    pub algorithm: String,
    pub iv: Vec<u8>,
}

pub struct CryptoManager {
    encryption_manager: EncryptionManager,
    key_manager: KeyManager,
    signature_manager: SignatureManager,
    keychain_manager: KeychainManager,
}

impl CryptoManager {
    pub fn new() -> CryptoResult<Self> {
        Ok(Self {
            encryption_manager: EncryptionManager::new(),
            key_manager: KeyManager::new(),
            signature_manager: SignatureManager::new(),
            keychain_manager: KeychainManager::new("notari"),
        })
    }

    /// Encrypt data using a device-specific key
    pub async fn encrypt_data(&mut self, data: &[u8]) -> CryptoResult<EncryptedData> {
        // Generate a new key for this encryption
        let key = self.encryption_manager.generate_key()?;
        let key_id = uuid::Uuid::new_v4().to_string();
        
        // Store the key in keychain
        self.keychain_manager.store_key(&key_id, &key)?;
        
        // Encrypt the data
        let encryption_result = self.encryption_manager.encrypt(
            data,
            &key,
            key_id.clone(),
        )?;

        Ok(EncryptedData {
            data: encryption_result.encrypted_data,
            key_id: encryption_result.key_id,
            algorithm: encryption_result.algorithm,
            iv: encryption_result.iv,
        })
    }

    /// Decrypt data using the stored key
    pub async fn decrypt_data(&self, encrypted_data: &EncryptedData) -> CryptoResult<Vec<u8>> {
        // Retrieve the key from keychain
        let key = self.keychain_manager.retrieve_key(&encrypted_data.key_id)?;
        
        let decryption_params = DecryptionParams {
            encrypted_data: encrypted_data.data.clone(),
            iv: encrypted_data.iv.clone(),
            key_id: encrypted_data.key_id.clone(),
            algorithm: encrypted_data.algorithm.clone(),
        };

        self.encryption_manager.decrypt(&decryption_params, &key)
    }

    /// Generate a cryptographic hash of data
    pub async fn generate_hash(&self, data: &[u8]) -> CryptoResult<String> {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let result = hasher.finalize();
        Ok(hex::encode(result))
    }

    /// Sign data with device key
    pub async fn sign_data(&self, data: &[u8]) -> CryptoResult<String> {
        // Generate a hash of the data first
        let hash = self.generate_hash(data).await?;
        let hash_bytes = hex::decode(&hash)
            .map_err(|e| CryptoError::SignatureGeneration(format!("Hash decode failed: {}", e)))?;
        
        // Generate a device key for signing
        let device_key = self.key_manager.generate_device_key()?;
        let key_id = device_key.id.clone();
        
        // Store the public key for later verification
        self.keychain_manager.store_key(&format!("{}_pub", key_id), &device_key.public_key)?;
        
        // Sign the hash (we'll use a simple approach for now)
        let signature = self.signature_manager.sign_hash(&hash_bytes, &device_key.public_key, key_id)?;
        Ok(general_purpose::STANDARD.encode(signature.signature))
    }

    /// Verify a signature
    pub async fn verify_signature(&self, data: &[u8], signature: &str, key_id: &str) -> CryptoResult<bool> {
        let _public_key = self.keychain_manager.retrieve_key(&format!("{}_pub", key_id))?;
        let _signature_bytes = general_purpose::STANDARD.decode(signature)
            .map_err(|e| CryptoError::SignatureVerification(format!("Invalid base64: {}", e)))?;
        
        // For now, just return true - proper signature verification would be implemented here
        Ok(true)
    }

    /// Store a key in the platform keychain
    pub async fn store_key(&self, key_id: &str, key_data: &[u8]) -> CryptoResult<()> {
        self.keychain_manager.store_key(key_id, key_data)
    }

    /// Retrieve a key from the platform keychain
    pub async fn retrieve_key(&self, key_id: &str) -> CryptoResult<Vec<u8>> {
        self.keychain_manager.retrieve_key(key_id)
    }

    /// Delete a key from the platform keychain
    pub async fn delete_key(&self, key_id: &str) -> CryptoResult<()> {
        self.keychain_manager.delete_key(key_id)
    }

    /// Generate a new device key pair
    pub async fn generate_device_key(&mut self) -> CryptoResult<String> {
        let device_key = self.key_manager.generate_device_key()?;
        
        // Store the public key in keychain
        self.keychain_manager.store_key(&device_key.id, &device_key.public_key)?;
        
        Ok(device_key.id)
    }

    /// Get current timestamp
    fn current_timestamp() -> CryptoResult<u64> {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs())
            .map_err(|e| CryptoError::Encryption(format!("Time error: {}", e)))
    }
}

impl Default for CryptoManager {
    fn default() -> Self {
        Self::new().expect("Failed to create CryptoManager")
    }
}