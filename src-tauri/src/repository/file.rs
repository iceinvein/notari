//! File-based repository implementations
//!
//! These repositories use tauri-plugin-store for persistent JSON storage.

use super::traits::{AnchorRepository, ConfigRepository, PreferencesRepository};
use crate::error::{NotariError, NotariResult};
use crate::evidence::blockchain::{AnchorProof, BlockchainConfig};
use crate::recording_manager::RecordingPreferences;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Storage keys
const BLOCKCHAIN_CONFIG_KEY: &str = "blockchain_config";
const MOCK_ANCHORS_KEY: &str = "mock_anchors";
const RECORDING_PREFERENCES_KEY: &str = "recording_preferences";

/// File-based configuration repository using tauri-plugin-store
pub struct FileConfigRepository {
    store_path: PathBuf,
    store: Mutex<Option<Arc<tauri_plugin_store::Store<tauri::Wry>>>>,
}

impl FileConfigRepository {
    /// Create a new file-based config repository
    pub fn new(store_path: PathBuf) -> Self {
        Self {
            store_path,
            store: Mutex::new(None),
        }
    }

    /// Initialize with app handle
    pub fn init(&self, app_handle: tauri::AppHandle) -> NotariResult<()> {
        let mut store_lock = self.store.lock()?;
        let store = tauri_plugin_store::StoreBuilder::new(&app_handle, &self.store_path)
            .build()
            .map_err(|_| NotariError::StorageNotInitialized)?;
        *store_lock = Some(store);
        Ok(())
    }

    /// Get the store instance
    fn get_store(&self) -> NotariResult<Arc<tauri_plugin_store::Store<tauri::Wry>>> {
        self.store
            .lock()?
            .clone()
            .ok_or_else(|| NotariError::StorageNotInitialized)
    }
}

impl ConfigRepository for FileConfigRepository {
    fn save_config(&self, config: &BlockchainConfig) -> NotariResult<()> {
        let store = self.get_store()?;
        let json = serde_json::to_value(config)?;
        store.set(BLOCKCHAIN_CONFIG_KEY.to_string(), json);
        store
            .save()
            .map_err(|e| NotariError::StorageSaveFailed(e.to_string()))?;
        Ok(())
    }

    fn load_config(&self) -> NotariResult<Option<BlockchainConfig>> {
        let store = self.get_store()?;
        if let Some(value) = store.get(BLOCKCHAIN_CONFIG_KEY) {
            let config: BlockchainConfig = serde_json::from_value(value.clone())?;
            Ok(Some(config))
        } else {
            Ok(None)
        }
    }

    fn delete_config(&self) -> NotariResult<()> {
        let store = self.get_store()?;
        store.delete(BLOCKCHAIN_CONFIG_KEY.to_string());
        store
            .save()
            .map_err(|e| NotariError::StorageSaveFailed(e.to_string()))?;
        Ok(())
    }
}

/// File-based preferences repository using tauri-plugin-store
pub struct FilePreferencesRepository {
    store_path: PathBuf,
    store: Mutex<Option<Arc<tauri_plugin_store::Store<tauri::Wry>>>>,
}

impl FilePreferencesRepository {
    /// Create a new file-based preferences repository
    pub fn new(store_path: PathBuf) -> Self {
        Self {
            store_path,
            store: Mutex::new(None),
        }
    }

    /// Initialize with app handle
    pub fn init(&self, app_handle: tauri::AppHandle) -> NotariResult<()> {
        let mut store_lock = self.store.lock()?;
        let store = tauri_plugin_store::StoreBuilder::new(&app_handle, &self.store_path)
            .build()
            .map_err(|_| NotariError::StorageNotInitialized)?;
        *store_lock = Some(store);
        Ok(())
    }

    /// Get the store instance
    fn get_store(&self) -> NotariResult<Arc<tauri_plugin_store::Store<tauri::Wry>>> {
        self.store
            .lock()?
            .clone()
            .ok_or_else(|| NotariError::StorageNotInitialized)
    }
}

impl PreferencesRepository for FilePreferencesRepository {
    fn save_preferences(&self, preferences: &RecordingPreferences) -> NotariResult<()> {
        let store = self.get_store()?;
        let json = serde_json::to_value(preferences)?;
        store.set(RECORDING_PREFERENCES_KEY.to_string(), json);
        store
            .save()
            .map_err(|e| NotariError::StorageSaveFailed(e.to_string()))?;
        Ok(())
    }

    fn load_preferences(&self) -> NotariResult<Option<RecordingPreferences>> {
        let store = self.get_store()?;
        if let Some(value) = store.get(RECORDING_PREFERENCES_KEY) {
            let preferences: RecordingPreferences = serde_json::from_value(value.clone())?;
            Ok(Some(preferences))
        } else {
            Ok(None)
        }
    }

    fn delete_preferences(&self) -> NotariResult<()> {
        let store = self.get_store()?;
        store.delete(RECORDING_PREFERENCES_KEY.to_string());
        store
            .save()
            .map_err(|e| NotariError::StorageSaveFailed(e.to_string()))?;
        Ok(())
    }
}

/// File-based anchor repository using tauri-plugin-store
pub struct FileAnchorRepository {
    store_path: PathBuf,
    store: Mutex<Option<Arc<tauri_plugin_store::Store<tauri::Wry>>>>,
}

impl FileAnchorRepository {
    /// Create a new file-based anchor repository
    pub fn new(store_path: PathBuf) -> Self {
        Self {
            store_path,
            store: Mutex::new(None),
        }
    }

    /// Initialize with app handle
    pub fn init(&self, app_handle: tauri::AppHandle) -> NotariResult<()> {
        let mut store_lock = self.store.lock()?;
        let store = tauri_plugin_store::StoreBuilder::new(&app_handle, &self.store_path)
            .build()
            .map_err(|_| NotariError::StorageNotInitialized)?;
        *store_lock = Some(store);
        Ok(())
    }

    /// Get the store instance
    fn get_store(&self) -> NotariResult<Arc<tauri_plugin_store::Store<tauri::Wry>>> {
        self.store
            .lock()?
            .clone()
            .ok_or_else(|| NotariError::StorageNotInitialized)
    }
}

impl AnchorRepository for FileAnchorRepository {
    fn save_anchor(&self, hash: &str, proof: &AnchorProof) -> NotariResult<()> {
        let store = self.get_store()?;

        // Load existing anchors
        let mut anchors = self.load_all_anchors()?;

        // Add new anchor
        anchors.insert(hash.to_string(), proof.clone());

        // Save back
        let json = serde_json::to_value(&anchors)?;
        store.set(MOCK_ANCHORS_KEY.to_string(), json);
        store
            .save()
            .map_err(|e| NotariError::StorageSaveFailed(e.to_string()))?;
        Ok(())
    }

    fn load_anchor(&self, hash: &str) -> NotariResult<Option<AnchorProof>> {
        let anchors = self.load_all_anchors()?;
        Ok(anchors.get(hash).cloned())
    }

    fn load_all_anchors(&self) -> NotariResult<HashMap<String, AnchorProof>> {
        let store = self.get_store()?;
        if let Some(value) = store.get(MOCK_ANCHORS_KEY) {
            let anchors: HashMap<String, AnchorProof> = serde_json::from_value(value.clone())?;
            Ok(anchors)
        } else {
            Ok(HashMap::new())
        }
    }

    fn delete_anchor(&self, hash: &str) -> NotariResult<()> {
        let store = self.get_store()?;

        // Load existing anchors
        let mut anchors = self.load_all_anchors()?;

        // Remove anchor
        anchors.remove(hash);

        // Save back
        let json = serde_json::to_value(&anchors)?;
        store.set(MOCK_ANCHORS_KEY.to_string(), json);
        store
            .save()
            .map_err(|e| NotariError::StorageSaveFailed(e.to_string()))?;
        Ok(())
    }

    fn clear_all_anchors(&self) -> NotariResult<()> {
        let store = self.get_store()?;
        store.delete(MOCK_ANCHORS_KEY.to_string());
        store
            .save()
            .map_err(|e| NotariError::StorageSaveFailed(e.to_string()))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_file_repository_creation() {
        let config_repo = FileConfigRepository::new(PathBuf::from("test-store.json"));
        assert_eq!(config_repo.store_path, PathBuf::from("test-store.json"));

        let prefs_repo = FilePreferencesRepository::new(PathBuf::from("test-store.json"));
        assert_eq!(prefs_repo.store_path, PathBuf::from("test-store.json"));

        let anchor_repo = FileAnchorRepository::new(PathBuf::from("test-store.json"));
        assert_eq!(anchor_repo.store_path, PathBuf::from("test-store.json"));
    }
}
