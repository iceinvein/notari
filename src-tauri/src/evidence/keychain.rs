//! Keychain operations for signing keys
//!
//! This module provides a compatibility layer for keychain operations
//! using the repository pattern. It wraps the KeychainRepository to
//! maintain the existing API for gradual migration.

use crate::error::NotariResult;
use crate::repository::keychain::{key_ids, KeychainRepository};
use crate::repository::traits::KeyRepository;
use once_cell::sync::Lazy;

/// Global keychain repository instance
static KEYCHAIN_REPO: Lazy<KeychainRepository> = Lazy::new(KeychainRepository::new);

/// Store signing key in Keychain
pub fn store_signing_key(key_bytes: &[u8]) -> NotariResult<()> {
    KEYCHAIN_REPO.store_key(key_ids::SIGNING_KEY, key_bytes)
}

/// Retrieve signing key from Keychain
pub fn retrieve_signing_key() -> NotariResult<Vec<u8>> {
    KEYCHAIN_REPO.retrieve_key(key_ids::SIGNING_KEY)
}

/// Delete signing key from Keychain
pub fn delete_signing_key() -> NotariResult<()> {
    KEYCHAIN_REPO.delete_key(key_ids::SIGNING_KEY)
}

/// Check if signing key exists in Keychain
pub fn has_signing_key() -> bool {
    KEYCHAIN_REPO.has_key(key_ids::SIGNING_KEY).unwrap_or(false)
}

// ============================================================================
// Encryption Key Operations (X25519)
// ============================================================================

/// Store encryption key in Keychain
pub fn store_encryption_key(key_bytes: &[u8]) -> NotariResult<()> {
    KEYCHAIN_REPO.store_key(key_ids::ENCRYPTION_KEY, key_bytes)
}

/// Retrieve encryption key from Keychain
pub fn retrieve_encryption_key() -> NotariResult<Vec<u8>> {
    KEYCHAIN_REPO.retrieve_key(key_ids::ENCRYPTION_KEY)
}

/// Delete encryption key from Keychain
pub fn delete_encryption_key() -> NotariResult<()> {
    KEYCHAIN_REPO.delete_key(key_ids::ENCRYPTION_KEY)
}

/// Check if encryption key exists in Keychain
pub fn has_encryption_key() -> bool {
    KEYCHAIN_REPO
        .has_key(key_ids::ENCRYPTION_KEY)
        .unwrap_or(false)
}

// Note: No unit tests for keychain operations because:
// 1. These are thin wrappers around Apple's security_framework crate
// 2. Testing would require system keychain access (can't run in parallel)
// 3. The actual functionality is tested in integration tests:
//    - test_sign_stage_success: Tests key generation and signing
//    - test_package_stage_success: Tests key retrieval for proof packs
//    - Verification tests: Test signature verification
