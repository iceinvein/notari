use crate::app_log;
use crate::error::{NotariError, NotariResult};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Storage keys
const BLOCKCHAIN_CONFIG_KEY: &str = "blockchain_config";
const MOCK_ANCHORS_KEY: &str = "mock_anchors";
const RECORDING_PREFERENCES_KEY: &str = "recording_preferences";

/// Persistent storage manager using tauri-plugin-store
pub struct StorageManager {
    store_path: PathBuf,
    store: Mutex<Option<Arc<tauri_plugin_store::Store<tauri::Wry>>>>,
}

impl StorageManager {
    /// Create a new storage manager
    pub fn new() -> Self {
        Self {
            store_path: PathBuf::from("notari-store.json"),
            store: Mutex::new(None),
        }
    }

    /// Initialize with app handle
    pub fn init(&self, app_handle: tauri::AppHandle) {
        if let Ok(mut store_lock) = self.store.lock() {
            match tauri_plugin_store::StoreBuilder::new(&app_handle, &self.store_path).build() {
                Ok(store) => {
                    *store_lock = Some(store);
                }
                Err(e) => {
                    app_log!(crate::logger::LogLevel::Error, "Failed to initialize storage: {}", e);
                }
            }
        }
    }

    /// Get the store instance
    fn get_store(&self) -> NotariResult<Arc<tauri_plugin_store::Store<tauri::Wry>>> {
        self.store
            .lock()?
            .clone()
            .ok_or_else(|| NotariError::StorageNotInitialized)
    }

    /// Save blockchain configuration
    pub fn save_blockchain_config(
        &self,
        config: &crate::evidence::BlockchainConfig,
    ) -> NotariResult<()> {
        let store = self.get_store()?;
        let json = serde_json::to_value(config)?;
        store.set(BLOCKCHAIN_CONFIG_KEY.to_string(), json);
        store.save().map_err(|e| NotariError::StorageSaveFailed(e.to_string()))?;
        Ok(())
    }

    /// Load blockchain configuration
    pub fn load_blockchain_config(
        &self,
    ) -> NotariResult<Option<crate::evidence::BlockchainConfig>> {
        let store = self.get_store()?;
        if let Some(value) = store.get(BLOCKCHAIN_CONFIG_KEY) {
            let config: crate::evidence::BlockchainConfig =
                serde_json::from_value(value.clone())?;
            Ok(Some(config))
        } else {
            Ok(None)
        }
    }

    /// Save mock anchored hashes
    pub fn save_mock_anchors(
        &self,
        anchors: &HashMap<String, crate::evidence::blockchain::AnchorProof>,
    ) -> NotariResult<()> {
        let store = self.get_store()?;
        let json = serde_json::to_value(anchors)?;
        store.set(MOCK_ANCHORS_KEY.to_string(), json);
        store.save().map_err(|e| NotariError::StorageSaveFailed(e.to_string()))?;
        Ok(())
    }

    /// Load mock anchored hashes
    pub fn load_mock_anchors(
        &self,
    ) -> NotariResult<HashMap<String, crate::evidence::blockchain::AnchorProof>> {
        let store = self.get_store()?;
        if let Some(value) = store.get(MOCK_ANCHORS_KEY) {
            let anchors: HashMap<String, crate::evidence::blockchain::AnchorProof> =
                serde_json::from_value(value.clone())?;
            Ok(anchors)
        } else {
            Ok(HashMap::new())
        }
    }

    /// Clear all mock anchored hashes
    pub fn clear_mock_anchors(&self) -> NotariResult<()> {
        let store = self.get_store()?;
        store.delete(MOCK_ANCHORS_KEY.to_string());
        store.save().map_err(|e| NotariError::StorageSaveFailed(e.to_string()))?;
        Ok(())
    }

    /// Save recording preferences
    pub fn save_recording_preferences(
        &self,
        preferences: &crate::recording_manager::RecordingPreferences,
    ) -> NotariResult<()> {
        let store = self.get_store()?;
        let json = serde_json::to_value(preferences)?;
        store.set(RECORDING_PREFERENCES_KEY.to_string(), json);
        store.save().map_err(|e| NotariError::StorageSaveFailed(e.to_string()))?;
        Ok(())
    }

    /// Load recording preferences
    pub fn load_recording_preferences(
        &self,
    ) -> NotariResult<Option<crate::recording_manager::RecordingPreferences>> {
        let store = self.get_store()?;
        if let Some(value) = store.get(RECORDING_PREFERENCES_KEY) {
            let preferences: crate::recording_manager::RecordingPreferences =
                serde_json::from_value(value.clone())?;
            Ok(Some(preferences))
        } else {
            Ok(None)
        }
    }
}

impl Default for StorageManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Global storage manager instance
static STORAGE_MANAGER: once_cell::sync::Lazy<StorageManager> =
    once_cell::sync::Lazy::new(StorageManager::new);

/// Initialize storage with app handle
pub fn init_storage(app_handle: tauri::AppHandle) {
    STORAGE_MANAGER.init(app_handle);
}

/// Get the global storage manager
pub fn get_storage() -> &'static StorageManager {
    &STORAGE_MANAGER
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_storage_manager_creation() {
        let manager = StorageManager::new();
        assert_eq!(manager.store_path, PathBuf::from("notari-store.json"));
    }
}

