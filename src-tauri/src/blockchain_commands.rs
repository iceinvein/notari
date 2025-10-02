use crate::app_log;
use crate::evidence::{
    BlockchainAnchorerFactory, BlockchainConfig, BlockchainEnvironment, ChainConfig, WalletManager,
};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

/// Blockchain configuration state
pub struct BlockchainState {
    pub config: Mutex<Option<BlockchainConfig>>,
}

impl BlockchainState {
    pub fn new() -> Self {
        Self {
            config: Mutex::new(None),
        }
    }
}

/// Serializable blockchain configuration for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockchainConfigDto {
    pub enabled: bool,
    pub environment: String, // "Mock", "Testnet", "Mainnet"
    pub chain_id: u64,
    pub chain_name: String,
    pub auto_anchor: bool,
    pub has_wallet: bool,
    pub wallet_address: Option<String>,
}

/// Chain information for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainInfo {
    pub chain_id: u64,
    pub name: String,
    pub rpc_url: String,
    pub contract_address: String,
    pub explorer_url: String,
    pub currency_symbol: String,
}

impl From<ChainConfig> for ChainInfo {
    fn from(config: ChainConfig) -> Self {
        Self {
            chain_id: config.chain_id,
            name: config.name,
            rpc_url: config.rpc_url,
            contract_address: config.contract_address,
            explorer_url: config.explorer_url,
            currency_symbol: config.currency_symbol,
        }
    }
}

/// Get current blockchain configuration
#[tauri::command]
pub async fn get_blockchain_config(
    state: State<'_, BlockchainState>,
) -> Result<BlockchainConfigDto, String> {
    let config_lock = state.config.lock().map_err(|e| e.to_string())?;

    if let Some(config) = config_lock.as_ref() {
        let has_wallet = if let Some(wallet) = &config.wallet {
            WalletManager::has_private_key(config.chain.chain_id, &wallet.address)
        } else {
            false
        };

        Ok(BlockchainConfigDto {
            enabled: config.enabled,
            environment: format!("{:?}", config.environment),
            chain_id: config.chain.chain_id,
            chain_name: config.chain.name.clone(),
            auto_anchor: config.auto_anchor,
            has_wallet,
            wallet_address: config.wallet.as_ref().map(|w| w.address.clone()),
        })
    } else {
        // Return default config
        Ok(BlockchainConfigDto {
            enabled: false,
            environment: "Mock".to_string(),
            chain_id: 80002,
            chain_name: "Polygon Amoy".to_string(),
            auto_anchor: false,
            has_wallet: false,
            wallet_address: None,
        })
    }
}

/// Update blockchain configuration
#[tauri::command]
pub async fn set_blockchain_config(
    state: State<'_, BlockchainState>,
    enabled: bool,
    environment: String,
    chain_id: u64,
    auto_anchor: bool,
) -> Result<(), String> {
    let mut config_lock = state.config.lock().map_err(|e| e.to_string())?;

    let env = match environment.as_str() {
        "Mock" => BlockchainEnvironment::Mock,
        "Testnet" => BlockchainEnvironment::Testnet,
        "Mainnet" => BlockchainEnvironment::Mainnet,
        _ => return Err("Invalid environment".to_string()),
    };

    let chain = ChainConfig::from_chain_id(chain_id).ok_or("Invalid chain ID")?;

    let mut config = config_lock.take().unwrap_or_else(BlockchainConfig::default);
    config.enabled = enabled;
    config.environment = env;
    config.chain = chain;
    config.auto_anchor = auto_anchor;

    // Save to persistent storage
    crate::storage::get_storage().save_blockchain_config(&config)?;

    *config_lock = Some(config);
    Ok(())
}

/// Get list of available chains
#[tauri::command]
pub async fn get_available_chains() -> Result<Vec<ChainInfo>, String> {
    Ok(ChainConfig::all_chains()
        .into_iter()
        .map(ChainInfo::from)
        .collect())
}

/// Validate a private key format
#[tauri::command]
pub async fn validate_private_key(private_key: String) -> Result<bool, String> {
    WalletManager::validate_private_key(&private_key)
        .map(|_| true)
        .map_err(|e| e.to_string())
}

/// Derive Ethereum address from private key
#[tauri::command]
pub async fn derive_address(private_key: String) -> Result<String, String> {
    WalletManager::derive_address(&private_key).map_err(|e| e.to_string())
}

/// Store private key in keychain
#[tauri::command]
pub async fn store_private_key(
    state: State<'_, BlockchainState>,
    private_key: String,
) -> Result<String, String> {
    // Validate first
    WalletManager::validate_private_key(&private_key).map_err(|e| e.to_string())?;

    // Derive address
    let address = WalletManager::derive_address(&private_key).map_err(|e| e.to_string())?;

    // Get current chain ID
    let config_lock = state.config.lock().map_err(|e| e.to_string())?;
    let chain_id = config_lock
        .as_ref()
        .map(|c| c.chain.chain_id)
        .unwrap_or(80002);

    // Store in keychain
    WalletManager::store_private_key(chain_id, &address, &private_key)
        .map_err(|e| e.to_string())?;

    // Update config with wallet info
    drop(config_lock);
    let mut config_lock = state.config.lock().map_err(|e| e.to_string())?;
    if let Some(config) = config_lock.as_mut() {
        config.wallet = Some(crate::evidence::WalletConfig {
            address: address.clone(),
        });

        // Save to persistent storage
        crate::storage::get_storage().save_blockchain_config(config)?;
    }

    Ok(address)
}

/// Get stored wallet address for current chain
#[tauri::command]
pub async fn get_stored_address(
    state: State<'_, BlockchainState>,
) -> Result<Option<String>, String> {
    let config_lock = state.config.lock().map_err(|e| e.to_string())?;
    Ok(config_lock
        .as_ref()
        .and_then(|c| c.wallet.as_ref())
        .map(|w| w.address.clone()))
}

/// Delete private key from keychain
#[tauri::command]
pub async fn delete_private_key(state: State<'_, BlockchainState>) -> Result<(), String> {
    let config_lock = state.config.lock().map_err(|e| e.to_string())?;

    if let Some(config) = config_lock.as_ref() {
        if let Some(wallet) = &config.wallet {
            WalletManager::delete_private_key(config.chain.chain_id, &wallet.address)
                .map_err(|e| e.to_string())?;
        }
    }

    drop(config_lock);
    let mut config_lock = state.config.lock().map_err(|e| e.to_string())?;
    if let Some(config) = config_lock.as_mut() {
        config.wallet = None;

        // Save to persistent storage
        crate::storage::get_storage().save_blockchain_config(config)?;
    }

    Ok(())
}

/// Check if private key exists in keychain
#[tauri::command]
pub async fn has_private_key(state: State<'_, BlockchainState>) -> Result<bool, String> {
    let config_lock = state.config.lock().map_err(|e| e.to_string())?;

    if let Some(config) = config_lock.as_ref() {
        if let Some(wallet) = &config.wallet {
            return Ok(WalletManager::has_private_key(
                config.chain.chain_id,
                &wallet.address,
            ));
        }
    }

    Ok(false)
}

/// Get wallet balance
#[tauri::command]
pub async fn get_balance(state: State<'_, BlockchainState>) -> Result<f64, String> {
    // Extract config data before any async operations
    let (environment, chain_config, wallet_config) = {
        let config_lock = state.config.lock().map_err(|e| e.to_string())?;
        let config = config_lock.as_ref().ok_or("No blockchain config")?;
        (
            config.environment.clone(),
            config.chain.clone(),
            config.wallet.clone(),
        )
    };

    // Create anchorer using factory
    let anchorer = BlockchainAnchorerFactory::create_from_components(
        &environment,
        &chain_config,
        &wallet_config,
    )
    .map_err(|e| e.to_string())?;

    anchorer.get_balance().await.map_err(|e| e.to_string())
}

/// Estimate cost of anchoring
#[tauri::command]
pub async fn estimate_anchor_cost(state: State<'_, BlockchainState>) -> Result<f64, String> {
    // Extract config data before any async operations
    let (environment, chain_config, wallet_config) = {
        let config_lock = state.config.lock().map_err(|e| e.to_string())?;
        let config = config_lock.as_ref().ok_or("No blockchain config")?;
        (
            config.environment.clone(),
            config.chain.clone(),
            config.wallet.clone(),
        )
    };

    // Create anchorer using factory
    let anchorer = BlockchainAnchorerFactory::create_from_components(
        &environment,
        &chain_config,
        &wallet_config,
    )
    .map_err(|e| e.to_string())?;

    anchorer.estimate_cost().await.map_err(|e| e.to_string())
}

/// Test blockchain connection
#[tauri::command]
pub async fn test_connection(state: State<'_, BlockchainState>) -> Result<String, String> {
    // Extract config data before any async operations
    let (environment, chain_config, wallet_config) = {
        let config_lock = state.config.lock().map_err(|e| e.to_string())?;
        let config = config_lock.as_ref().ok_or("No blockchain config")?;
        (
            config.environment.clone(),
            config.chain.clone(),
            config.wallet.clone(),
        )
    };

    match environment {
        BlockchainEnvironment::Mock => Ok("Mock environment - always connected".to_string()),
        _ => {
            // Create anchorer using factory
            let anchorer = BlockchainAnchorerFactory::create_from_components(
                &environment,
                &chain_config,
                &wallet_config,
            )
            .map_err(|e| e.to_string())?;

            // Try to get balance as a connection test
            let balance = anchorer.get_balance().await.map_err(|e| e.to_string())?;

            Ok(format!(
                "Connected to {} - Balance: {} {}",
                chain_config.name, balance, chain_config.currency_symbol
            ))
        }
    }
}

/// Anchor a recording to blockchain
#[tauri::command]
pub async fn anchor_recording(
    state: State<'_, BlockchainState>,
    manifest_path: String,
) -> Result<AnchorResult, String> {
    use crate::evidence::{BlockchainAnchor, EvidenceManifest};
    use chrono::Utc;
    use std::fs;

    // Extract config data before any async operations
    let (environment, chain_config, wallet_config) = {
        let config_lock = state.config.lock().map_err(|e| e.to_string())?;
        let config = config_lock.as_ref().ok_or("Blockchain not configured")?;

        if !config.enabled {
            return Err("Blockchain anchoring is not enabled".to_string());
        }

        (
            config.environment.clone(),
            config.chain.clone(),
            config.wallet.clone(),
        )
    };

    // Load manifest from .notari ZIP file
    use std::io::{Read, Write};
    use zip::ZipArchive;

    let notari_file = fs::File::open(&manifest_path)
        .map_err(|e| format!("Failed to open .notari file: {}", e))?;
    let mut archive = ZipArchive::new(notari_file)
        .map_err(|e| format!("Failed to read .notari archive: {}", e))?;

    // Find the manifest file in the evidence/ directory (it has .json extension)
    let mut manifest_filename = None;
    for i in 0..archive.len() {
        let file = archive
            .by_index(i)
            .map_err(|e| format!("Failed to read archive entry: {}", e))?;
        let name = file.name();
        if name.starts_with("evidence/") && name.ends_with(".json") {
            manifest_filename = Some(name.to_string());
            break;
        }
    }

    let manifest_filename =
        manifest_filename.ok_or("Failed to find manifest file in .notari archive")?;

    // Read the manifest file
    let mut manifest_file = archive
        .by_name(&manifest_filename)
        .map_err(|e| format!("Failed to open manifest file: {}", e))?;
    let mut manifest_json = String::new();
    manifest_file
        .read_to_string(&mut manifest_json)
        .map_err(|e| format!("Failed to read manifest: {}", e))?;
    drop(manifest_file); // Release the borrow

    // Store the manifest filename for later use
    let manifest_filename_for_write = manifest_filename.clone();
    drop(archive); // Close the archive so we can modify the file

    let mut manifest: EvidenceManifest = serde_json::from_str(&manifest_json)
        .map_err(|e| format!("Failed to parse manifest: {}", e))?;

    // Check if already anchored
    if manifest.blockchain_anchor.is_some() {
        return Err("Recording is already anchored to blockchain".to_string());
    }

    // Compute the manifest hash (SHA256 of the manifest JSON)
    use sha2::{Digest, Sha256};
    let mut hasher = Sha256::new();
    hasher.update(manifest_json.as_bytes());
    let manifest_hash = format!("{:x}", hasher.finalize());

    // Create anchorer using factory
    let anchorer = BlockchainAnchorerFactory::create_from_components(
        &environment,
        &chain_config,
        &wallet_config,
    )
    .map_err(|e| e.to_string())?;

    // Anchor the hash
    app_log!(crate::logger::LogLevel::Info, "Anchoring manifest hash: {}", &manifest_hash[..16.min(manifest_hash.len())]);
    let proof = anchorer
        .anchor(&manifest_hash)
        .await
        .map_err(|e| format!("Failed to anchor: {}", e))?;
    app_log!(crate::logger::LogLevel::Info, "Anchoring successful");

    // Update manifest with anchor
    manifest.blockchain_anchor = Some(BlockchainAnchor {
        anchored_at: Utc::now(),
        anchored_hash: manifest_hash.clone(),
        manifest_hash: manifest_hash.clone(),
        proof: proof.clone(),
    });

    // Re-sign the manifest to include the blockchain anchor in the signature
    // This provides offline verification of anchor metadata
    use crate::evidence::keychain;
    use crate::evidence::KeyManager;

    let key_bytes = keychain::retrieve_signing_key()
        .map_err(|e| format!("Failed to retrieve signing key: {}", e))?;
    let key_manager = KeyManager::from_bytes(&key_bytes)
        .map_err(|e| format!("Failed to load signing key: {}", e))?;
    manifest.sign(&key_manager);

    // Save updated manifest back to .notari ZIP file
    let updated_json = serde_json::to_string_pretty(&manifest)
        .map_err(|e| format!("Failed to serialize manifest: {}", e))?;

    // Create a temporary file for the new ZIP
    let temp_path = format!("{}.tmp", manifest_path);

    // Open the original archive for reading
    let original_file = fs::File::open(&manifest_path)
        .map_err(|e| format!("Failed to open original .notari file: {}", e))?;
    let mut original_archive = ZipArchive::new(original_file)
        .map_err(|e| format!("Failed to read original archive: {}", e))?;

    // Create new archive for writing
    let new_file =
        fs::File::create(&temp_path).map_err(|e| format!("Failed to create temp file: {}", e))?;
    let mut new_archive = zip::ZipWriter::new(new_file);

    // Copy all files except the manifest file
    for i in 0..original_archive.len() {
        let mut file = original_archive
            .by_index(i)
            .map_err(|e| format!("Failed to read file from archive: {}", e))?;
        let name = file.name().to_string();

        if name != manifest_filename_for_write {
            // Copy this file as-is
            let options =
                zip::write::FileOptions::<()>::default().compression_method(file.compression());
            new_archive
                .start_file(&name, options)
                .map_err(|e| format!("Failed to start file in new archive: {}", e))?;

            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)
                .map_err(|e| format!("Failed to read file contents: {}", e))?;
            new_archive
                .write_all(&buffer)
                .map_err(|e| format!("Failed to write file to new archive: {}", e))?;
        }
    }
    drop(original_archive); // Close original archive

    // Add the updated manifest file
    let options = zip::write::FileOptions::<()>::default()
        .compression_method(zip::CompressionMethod::Deflated);
    new_archive
        .start_file(&manifest_filename_for_write, options)
        .map_err(|e| format!("Failed to start manifest file: {}", e))?;
    new_archive
        .write_all(updated_json.as_bytes())
        .map_err(|e| format!("Failed to write manifest: {}", e))?;

    // Finalize the new archive
    new_archive
        .finish()
        .map_err(|e| format!("Failed to finalize archive: {}", e))?;

    // Replace the original file with the new one
    fs::rename(&temp_path, &manifest_path)
        .map_err(|e| format!("Failed to replace original file: {}", e))?;

    // Return result
    Ok(AnchorResult {
        success: true,
        anchored_at: manifest
            .blockchain_anchor
            .as_ref()
            .unwrap()
            .anchored_at
            .to_rfc3339(),
        proof: proof,
    })
}

/// Result of anchoring operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnchorResult {
    pub success: bool,
    pub anchored_at: String,
    pub proof: crate::evidence::AnchorProof,
}
