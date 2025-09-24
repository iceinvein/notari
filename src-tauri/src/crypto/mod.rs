pub mod encryption;
pub mod keychain;
pub mod keys;
pub mod signatures;

pub use encryption::*;
pub use keychain::*;
pub use keys::*;
pub use signatures::*;

use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum CryptoError {
    #[error("Key generation failed: {0}")]
    KeyGeneration(String),
    
    #[error("Encryption failed: {0}")]
    Encryption(String),
    
    #[error("Decryption failed: {0}")]
    Decryption(String),
    
    #[error("Signature generation failed: {0}")]
    SignatureGeneration(String),
    
    #[error("Signature verification failed: {0}")]
    SignatureVerification(String),
    
    #[error("Keychain operation failed: {0}")]
    Keychain(String),
    
    #[error("Invalid key format: {0}")]
    InvalidKeyFormat(String),
    
    #[error("Key not found: {0}")]
    KeyNotFound(String),
}

pub type CryptoResult<T> = Result<T, CryptoError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceKey {
    pub id: String,
    pub public_key: Vec<u8>,
    pub algorithm: String,
    pub created: u64,
    pub last_used: u64,
    pub is_hardware_backed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CryptoSignature {
    pub signature: Vec<u8>,
    pub algorithm: String,
    pub key_id: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionResult {
    pub encrypted_data: Vec<u8>,
    pub iv: Vec<u8>,
    pub key_id: String,
    pub algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DecryptionParams {
    pub encrypted_data: Vec<u8>,
    pub iv: Vec<u8>,
    pub key_id: String,
    pub algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HashResult {
    pub hash: String,
    pub algorithm: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyPair {
    pub public_key: Vec<u8>,
    pub private_key: Vec<u8>,
    pub algorithm: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyInfo {
    pub id: String,
    pub algorithm: String,
    pub created: u64,
    pub last_used: u64,
    pub is_hardware_backed: bool,
    pub status: KeyStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum KeyStatus {
    Active,
    Revoked,
    Expired,
}