//! Pipeline stages for post-recording workflow
//!
//! This module contains the individual stages that make up the post-recording pipeline:
//! 1. HashStage - Calculate SHA-256 hash of video
//! 2. EncryptStage - Encrypt video with AES-256-GCM (optional)
//! 3. ManifestStage - Generate evidence manifest
//! 4. SignStage - Sign manifest with Ed25519
//! 5. PackageStage - Create .notari proof pack
//! 6. CleanupStage - Remove temporary files

pub mod cleanup;
pub mod encrypt;
pub mod hash;
pub mod manifest;
pub mod package;
pub mod sign;

// Re-export stages
pub use cleanup::CleanupStage;
pub use encrypt::EncryptStage;
pub use hash::HashStage;
pub use manifest::ManifestStage;
pub use package::PackageStage;
pub use sign::SignStage;
