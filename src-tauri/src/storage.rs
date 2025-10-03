//! Storage module - Re-exports repository functionality
//!
//! This module provides a clean API for storage operations using the repository pattern.
//! All storage operations are delegated to the appropriate repositories.

pub use crate::repository::{get_repository_manager, init_repositories};
