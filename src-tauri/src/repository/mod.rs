//! Repository Pattern Implementation
//!
//! This module provides abstract interfaces for data access, allowing easy
//! swapping of storage backends (file system, database, cloud, etc.).
//!
//! # Architecture
//!
//! ```text
//! ┌─────────────────────────────────────────┐
//! │         Repository Traits               │
//! │  (Abstract interface for data access)   │
//! └──────────────┬──────────────────────────┘
//!                │
//!        ┌───────┴────────┬─────────────────┐
//!        │                │                 │
//! ┌──────▼──────┐  ┌─────▼──────┐  ┌──────▼────────┐
//! │FileRepository│  │KeychainRepo│  │DatabaseRepo   │
//! │             │  │            │  │(future)       │
//! │- JSON store │  │- macOS     │  │- SQLite       │
//! │- Fast       │  │- Secure    │  │- Relational   │
//! └─────────────┘  └────────────┘  └───────────────┘
//! ```

pub mod factory;
pub mod file;
pub mod keychain;
pub mod traits;

// Re-export main types
pub use factory::{
    get_repository_manager, init_repositories, RepositoryFactory, RepositoryManager,
};
pub use file::{FileAnchorRepository, FileConfigRepository, FilePreferencesRepository};
pub use keychain::KeychainRepository;
pub use traits::{AnchorRepository, ConfigRepository, KeyRepository, PreferencesRepository};
