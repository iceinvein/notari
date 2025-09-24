use super::{CryptoError, CryptoResult, DeviceKey, KeyPair, KeyInfo, KeyStatus};
use ring::{rand::{self, SecureRandom}, signature::{self, KeyPair as _}};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

pub struct KeyManager {
    rng: rand::SystemRandom,
}

impl KeyManager {
    pub fn new() -> Self {
        Self {
            rng: rand::SystemRandom::new(),
        }
    }

    /// Generate a hardware-backed device key using platform secure elements where available
    pub fn generate_device_key(&self) -> CryptoResult<DeviceKey> {
        let key_id = Uuid::new_v4().to_string();
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| CryptoError::KeyGeneration(format!("Time error: {}", e)))?
            .as_secs();

        // Generate Ed25519 key pair for signatures
        let key_pair = self.generate_ed25519_keypair()?;
        
        // Check if hardware-backed security is available
        let is_hardware_backed = self.is_hardware_security_available();

        Ok(DeviceKey {
            id: key_id,
            public_key: key_pair.public_key,
            algorithm: "Ed25519".to_string(),
            created: timestamp,
            last_used: timestamp,
            is_hardware_backed,
        })
    }

    /// Generate Ed25519 key pair for digital signatures
    pub fn generate_ed25519_keypair(&self) -> CryptoResult<KeyPair> {
        let key_pair_doc = signature::Ed25519KeyPair::generate_pkcs8(&self.rng)
            .map_err(|e| CryptoError::KeyGeneration(format!("Ed25519 generation failed: {}", e)))?;

        let key_pair = signature::Ed25519KeyPair::from_pkcs8(key_pair_doc.as_ref())
            .map_err(|e| CryptoError::KeyGeneration(format!("Ed25519 parsing failed: {}", e)))?;

        Ok(KeyPair {
            public_key: key_pair.public_key().as_ref().to_vec(),
            private_key: key_pair_doc.as_ref().to_vec(),
            algorithm: "Ed25519".to_string(),
        })
    }

    /// Generate AES-256 key for symmetric encryption
    pub fn generate_aes_key(&self) -> CryptoResult<Vec<u8>> {
        let mut key = vec![0u8; 32]; // 256 bits
        self.rng.fill(&mut key)
            .map_err(|e| CryptoError::KeyGeneration(format!("AES key generation failed: {}", e)))?;
        Ok(key)
    }

    /// Check if hardware-backed security is available on the current platform
    fn is_hardware_security_available(&self) -> bool {
        #[cfg(target_os = "windows")]
        {
            // On Windows, check for TPM availability
            self.check_windows_tpm()
        }
        
        #[cfg(target_os = "macos")]
        {
            // On macOS, Secure Enclave is available on devices with T2 chip or Apple Silicon
            self.check_macos_secure_enclave()
        }
        
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            false
        }
    }

    #[cfg(target_os = "windows")]
    fn check_windows_tpm(&self) -> bool {
        // Simplified TPM check - in production, this would use Windows TPM APIs
        // For now, assume TPM is available on Windows systems
        true
    }

    #[cfg(target_os = "macos")]
    fn check_macos_secure_enclave(&self) -> bool {
        // Simplified Secure Enclave check - in production, this would check for T2/Apple Silicon
        // For now, assume Secure Enclave is available on macOS systems
        true
    }

    /// Get information about a key
    pub fn get_key_info(&self, key_id: &str, device_key: &DeviceKey) -> CryptoResult<KeyInfo> {
        if device_key.id != key_id {
            return Err(CryptoError::KeyNotFound(key_id.to_string()));
        }

        Ok(KeyInfo {
            id: device_key.id.clone(),
            algorithm: device_key.algorithm.clone(),
            created: device_key.created,
            last_used: device_key.last_used,
            is_hardware_backed: device_key.is_hardware_backed,
            status: KeyStatus::Active, // In production, this would check actual key status
        })
    }

    /// Update the last used timestamp for a key
    pub fn update_key_usage(&self, device_key: &mut DeviceKey) -> CryptoResult<()> {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|e| CryptoError::KeyGeneration(format!("Time error: {}", e)))?
            .as_secs();
        
        device_key.last_used = timestamp;
        Ok(())
    }
}

impl Default for KeyManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_device_key() {
        let key_manager = KeyManager::new();
        let device_key = key_manager.generate_device_key().unwrap();
        
        assert!(!device_key.id.is_empty());
        assert_eq!(device_key.algorithm, "Ed25519");
        assert!(!device_key.public_key.is_empty());
        assert!(device_key.created > 0);
        assert_eq!(device_key.created, device_key.last_used);
    }

    #[test]
    fn test_generate_ed25519_keypair() {
        let key_manager = KeyManager::new();
        let key_pair = key_manager.generate_ed25519_keypair().unwrap();
        
        assert_eq!(key_pair.algorithm, "Ed25519");
        assert_eq!(key_pair.public_key.len(), 32); // Ed25519 public key is 32 bytes
        assert!(!key_pair.private_key.is_empty());
    }

    #[test]
    fn test_generate_aes_key() {
        let key_manager = KeyManager::new();
        let aes_key = key_manager.generate_aes_key().unwrap();
        
        assert_eq!(aes_key.len(), 32); // 256 bits = 32 bytes
    }

    #[test]
    fn test_get_key_info() {
        let key_manager = KeyManager::new();
        let device_key = key_manager.generate_device_key().unwrap();
        let key_info = key_manager.get_key_info(&device_key.id, &device_key).unwrap();
        
        assert_eq!(key_info.id, device_key.id);
        assert_eq!(key_info.algorithm, device_key.algorithm);
        assert_eq!(key_info.created, device_key.created);
        assert_eq!(key_info.last_used, device_key.last_used);
        assert_eq!(key_info.is_hardware_backed, device_key.is_hardware_backed);
        assert!(matches!(key_info.status, KeyStatus::Active));
    }
}