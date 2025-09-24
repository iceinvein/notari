use crate::crypto::{
    CryptoResult, DeviceKey, KeyPair, EncryptionResult, DecryptionParams,
    CryptoSignature, HashResult, KeyInfo,
    KeyManager, EncryptionManager, SignatureManager, KeychainManager,
};
use base64::{engine::general_purpose, Engine as _};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

// Application state for managing crypto instances
pub struct CryptoState {
    key_manager: KeyManager,
    encryption_manager: Mutex<EncryptionManager>,
    signature_manager: SignatureManager,
    keychain_manager: KeychainManager,
    // In-memory storage for keys during session (encrypted keys would be stored in keychain)
    session_keys: Mutex<HashMap<String, Vec<u8>>>,
}

impl Default for CryptoState {
    fn default() -> Self {
        Self {
            key_manager: KeyManager::new(),
            encryption_manager: Mutex::new(EncryptionManager::new()),
            signature_manager: SignatureManager::new(),
            keychain_manager: KeychainManager::default(),
            session_keys: Mutex::new(HashMap::new()),
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CryptoResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> CryptoResponse<T> {
    fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    fn error(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

impl<T> From<CryptoResult<T>> for CryptoResponse<T> {
    fn from(result: CryptoResult<T>) -> Self {
        match result {
            Ok(data) => CryptoResponse::success(data),
            Err(error) => CryptoResponse::error(error.to_string()),
        }
    }
}

#[tauri::command]
pub async fn generate_device_key(
    state: State<'_, CryptoState>,
) -> Result<CryptoResponse<DeviceKey>, String> {
    let result = state.key_manager.generate_device_key();
    Ok(result.into())
}

#[tauri::command]
pub async fn generate_keypair(
    state: State<'_, CryptoState>,
) -> Result<CryptoResponse<KeyPair>, String> {
    let result = state.key_manager.generate_ed25519_keypair();
    Ok(result.into())
}

#[tauri::command]
pub async fn encrypt_data(
    data: Vec<u8>,
    key_id: String,
    state: State<'_, CryptoState>,
) -> Result<CryptoResponse<(EncryptionResult, String)>, String> {
    let mut encryption_manager = state.encryption_manager.lock().unwrap();
    
    // Generate a new AES key for this encryption
    let aes_key = match encryption_manager.generate_key() {
        Ok(key) => key,
        Err(e) => return Ok(CryptoResponse::error(e.to_string())),
    };
    
    // Encrypt the data
    let encryption_result = match encryption_manager.encrypt(&data, &aes_key, key_id.clone()) {
        Ok(result) => result,
        Err(e) => return Ok(CryptoResponse::error(e.to_string())),
    };
    
    // Store the AES key in session storage (in production, this would be encrypted and stored securely)
    let mut session_keys = state.session_keys.lock().unwrap();
    session_keys.insert(key_id.clone(), aes_key);
    
    // Return the encryption result and a key reference
    Ok(CryptoResponse::success((encryption_result, key_id)))
}

#[tauri::command]
pub async fn decrypt_data(
    params: DecryptionParams,
    state: State<'_, CryptoState>,
) -> Result<CryptoResponse<Vec<u8>>, String> {
    let encryption_manager = state.encryption_manager.lock().unwrap();
    
    // Retrieve the AES key from session storage
    let session_keys = state.session_keys.lock().unwrap();
    let aes_key = match session_keys.get(&params.key_id) {
        Some(key) => key,
        None => return Ok(CryptoResponse::error(format!("Key not found: {}", params.key_id))),
    };
    
    let result = encryption_manager.decrypt(&params, aes_key);
    Ok(result.into())
}

#[tauri::command]
pub async fn sign_data(
    data: Vec<u8>,
    private_key: Vec<u8>,
    key_id: String,
    state: State<'_, CryptoState>,
) -> Result<CryptoResponse<CryptoSignature>, String> {
    let result = state.signature_manager.sign(&data, &private_key, key_id);
    Ok(result.into())
}

#[tauri::command]
pub async fn verify_signature(
    data: Vec<u8>,
    signature: CryptoSignature,
    public_key: Vec<u8>,
    state: State<'_, CryptoState>,
) -> Result<CryptoResponse<bool>, String> {
    let result = state.signature_manager.verify(&data, &signature, &public_key);
    Ok(result.into())
}

#[tauri::command]
pub async fn hash_data(
    data: Vec<u8>,
    algorithm: Option<String>,
    state: State<'_, CryptoState>,
) -> Result<CryptoResponse<HashResult>, String> {
    let hash_result = match state.signature_manager.hash_for_signing(&data) {
        Ok(hash_bytes) => {
            let timestamp = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs();
            
            HashResult {
                hash: general_purpose::STANDARD.encode(&hash_bytes),
                algorithm: algorithm.unwrap_or_else(|| "SHA-256".to_string()),
                timestamp,
            }
        }
        Err(e) => return Ok(CryptoResponse::error(e.to_string())),
    };
    
    Ok(CryptoResponse::success(hash_result))
}

#[tauri::command]
pub async fn store_key_in_keychain(
    key_id: String,
    key_data: Vec<u8>,
    state: State<'_, CryptoState>,
) -> Result<CryptoResponse<()>, String> {
    let result = state.keychain_manager.store_key(&key_id, &key_data);
    Ok(result.into())
}

#[tauri::command]
pub async fn retrieve_key_from_keychain(
    key_id: String,
    state: State<'_, CryptoState>,
) -> Result<CryptoResponse<Vec<u8>>, String> {
    let result = state.keychain_manager.retrieve_key(&key_id);
    Ok(result.into())
}

#[tauri::command]
pub async fn delete_key_from_keychain(
    key_id: String,
    state: State<'_, CryptoState>,
) -> Result<CryptoResponse<()>, String> {
    let result = state.keychain_manager.delete_key(&key_id);
    Ok(result.into())
}

#[tauri::command]
pub async fn get_key_info(
    key_id: String,
    device_key: DeviceKey,
    state: State<'_, CryptoState>,
) -> Result<CryptoResponse<KeyInfo>, String> {
    let result = state.key_manager.get_key_info(&key_id, &device_key);
    Ok(result.into())
}