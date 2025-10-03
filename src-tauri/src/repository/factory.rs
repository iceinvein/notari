//! Repository factory for creating repository instances
//!
//! This factory provides a centralized way to create repository instances
//! with the appropriate backend based on configuration.

use super::file::{FileAnchorRepository, FileConfigRepository, FilePreferencesRepository};
use super::keychain::KeychainRepository;
use super::traits::{AnchorRepository, ConfigRepository, KeyRepository, PreferencesRepository};
use crate::error::NotariResult;
use once_cell::sync::Lazy;
use std::path::PathBuf;
use std::sync::Arc;

/// Repository factory for creating repository instances
///
/// This factory encapsulates the logic for creating repository instances
/// with the appropriate backend. It allows easy swapping of storage backends
/// in the future (e.g., from file to database).
pub struct RepositoryFactory;

impl RepositoryFactory {
    /// Create a file-based config repository
    ///
    /// # Arguments
    /// * `store_path` - Path to the store file (e.g., "notari-store.json")
    ///
    /// # Returns
    /// A boxed trait object implementing ConfigRepository
    pub fn create_config_repository(store_path: PathBuf) -> Box<dyn ConfigRepository> {
        Box::new(FileConfigRepository::new(store_path))
    }

    /// Create a file-based preferences repository
    ///
    /// # Arguments
    /// * `store_path` - Path to the store file (e.g., "notari-store.json")
    ///
    /// # Returns
    /// A boxed trait object implementing PreferencesRepository
    pub fn create_preferences_repository(store_path: PathBuf) -> Box<dyn PreferencesRepository> {
        Box::new(FilePreferencesRepository::new(store_path))
    }

    /// Create a file-based anchor repository
    ///
    /// # Arguments
    /// * `store_path` - Path to the store file (e.g., "notari-store.json")
    ///
    /// # Returns
    /// A boxed trait object implementing AnchorRepository
    pub fn create_anchor_repository(store_path: PathBuf) -> Box<dyn AnchorRepository> {
        Box::new(FileAnchorRepository::new(store_path))
    }

    /// Create a keychain-based key repository
    ///
    /// # Returns
    /// A boxed trait object implementing KeyRepository
    pub fn create_key_repository() -> Box<dyn KeyRepository> {
        Box::new(KeychainRepository::new())
    }

    /// Create all repositories with default configuration
    ///
    /// # Returns
    /// A tuple of (config_repo, preferences_repo, anchor_repo, key_repo)
    pub fn create_all_default() -> (
        Box<dyn ConfigRepository>,
        Box<dyn PreferencesRepository>,
        Box<dyn AnchorRepository>,
        Box<dyn KeyRepository>,
    ) {
        let store_path = PathBuf::from("notari-store.json");
        (
            Self::create_config_repository(store_path.clone()),
            Self::create_preferences_repository(store_path.clone()),
            Self::create_anchor_repository(store_path),
            Self::create_key_repository(),
        )
    }
}

/// Unified repository manager that holds all repositories
///
/// This provides a single point of access to all repositories,
/// making it easy to inject into services and commands.
pub struct RepositoryManager {
    config_repo: Arc<FileConfigRepository>,
    preferences_repo: Arc<FilePreferencesRepository>,
    anchor_repo: Arc<FileAnchorRepository>,
    key_repo: Arc<KeychainRepository>,
}

impl RepositoryManager {
    /// Create a new repository manager with the given repositories
    pub fn new(
        config_repo: FileConfigRepository,
        preferences_repo: FilePreferencesRepository,
        anchor_repo: FileAnchorRepository,
        key_repo: KeychainRepository,
    ) -> Self {
        Self {
            config_repo: Arc::new(config_repo),
            preferences_repo: Arc::new(preferences_repo),
            anchor_repo: Arc::new(anchor_repo),
            key_repo: Arc::new(key_repo),
        }
    }

    /// Create a repository manager with default repositories
    pub fn default() -> Self {
        let store_path = PathBuf::from("notari-store.json");
        Self::new(
            FileConfigRepository::new(store_path.clone()),
            FilePreferencesRepository::new(store_path.clone()),
            FileAnchorRepository::new(store_path),
            KeychainRepository::new(),
        )
    }

    /// Get the config repository
    pub fn config(&self) -> &FileConfigRepository {
        &self.config_repo
    }

    /// Get the preferences repository
    pub fn preferences(&self) -> &FilePreferencesRepository {
        &self.preferences_repo
    }

    /// Get the anchor repository
    pub fn anchors(&self) -> &FileAnchorRepository {
        &self.anchor_repo
    }

    /// Get the key repository
    pub fn keys(&self) -> &KeychainRepository {
        &self.key_repo
    }

    /// Initialize file-based repositories with app handle
    ///
    /// This must be called after the Tauri app is initialized
    pub fn init_file_repos(&self, app_handle: tauri::AppHandle) -> NotariResult<()> {
        // Initialize all file-based repositories
        self.config_repo.init(app_handle.clone())?;
        self.preferences_repo.init(app_handle.clone())?;
        self.anchor_repo.init(app_handle)?;
        Ok(())
    }
}

/// Global repository manager instance
static REPOSITORY_MANAGER: Lazy<RepositoryManager> = Lazy::new(RepositoryManager::default);

/// Initialize repositories with app handle
///
/// This must be called after the Tauri app is initialized
pub fn init_repositories(app_handle: tauri::AppHandle) -> NotariResult<()> {
    REPOSITORY_MANAGER.init_file_repos(app_handle)
}

/// Get the global repository manager
pub fn get_repository_manager() -> &'static RepositoryManager {
    &REPOSITORY_MANAGER
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_factory_creates_repositories() {
        let config_repo = RepositoryFactory::create_config_repository(PathBuf::from("test.json"));
        let prefs_repo =
            RepositoryFactory::create_preferences_repository(PathBuf::from("test.json"));
        let anchor_repo = RepositoryFactory::create_anchor_repository(PathBuf::from("test.json"));
        let key_repo = RepositoryFactory::create_key_repository();

        // Just verify they were created (can't test much without initialization)
        assert!(config_repo.load_config().is_err()); // Not initialized
        assert!(prefs_repo.load_preferences().is_err()); // Not initialized
        assert!(anchor_repo.load_all_anchors().is_err()); // Not initialized

        // Key repo should work on macOS
        #[cfg(target_os = "macos")]
        assert!(key_repo.has_key("nonexistent").is_ok());

        #[cfg(not(target_os = "macos"))]
        assert!(key_repo.has_key("nonexistent").is_err());
    }

    #[test]
    fn test_factory_creates_all_default() {
        let (config_repo, prefs_repo, anchor_repo, key_repo) =
            RepositoryFactory::create_all_default();

        // Just verify they were created
        assert!(config_repo.load_config().is_err()); // Not initialized
        assert!(prefs_repo.load_preferences().is_err()); // Not initialized
        assert!(anchor_repo.load_all_anchors().is_err()); // Not initialized

        #[cfg(target_os = "macos")]
        assert!(key_repo.has_key("nonexistent").is_ok());

        #[cfg(not(target_os = "macos"))]
        assert!(key_repo.has_key("nonexistent").is_err());
    }

    #[test]
    fn test_repository_manager_creation() {
        let manager = RepositoryManager::default();

        // Verify we can get references to all repositories
        let _config = manager.config();
        let _prefs = manager.preferences();
        let _anchors = manager.anchors();
        let _keys = manager.keys();
    }

    #[test]
    fn test_repository_manager_references() {
        let manager = RepositoryManager::default();

        // Get multiple references to the same repository
        let config1 = manager.config();
        let config2 = manager.config();

        // They should point to the same underlying repository (same address)
        assert!(std::ptr::eq(config1, config2));
    }
}
