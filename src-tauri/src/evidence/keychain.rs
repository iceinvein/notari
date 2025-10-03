use crate::error::{NotariError, NotariResult};

#[cfg(target_os = "macos")]
use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

const SERVICE_NAME: &str = "com.notari.evidence";
const ACCOUNT_NAME: &str = "signing_key";

/// Store signing key in macOS Keychain
#[cfg(target_os = "macos")]
pub fn store_signing_key(key_bytes: &[u8]) -> NotariResult<()> {
    set_generic_password(SERVICE_NAME, ACCOUNT_NAME, key_bytes).map_err(|e| {
        NotariError::KeychainStoreFailed(format!("Failed to store signing key: {}", e))
    })?;
    Ok(())
}

/// Retrieve signing key from macOS Keychain
#[cfg(target_os = "macos")]
pub fn retrieve_signing_key() -> NotariResult<Vec<u8>> {
    let key_bytes = get_generic_password(SERVICE_NAME, ACCOUNT_NAME)
        .map_err(|e| NotariError::NoSigningKey(format!("Failed to retrieve signing key: {}", e)))?;
    Ok(key_bytes)
}

/// Delete signing key from macOS Keychain
#[cfg(target_os = "macos")]
pub fn delete_signing_key() -> NotariResult<()> {
    delete_generic_password(SERVICE_NAME, ACCOUNT_NAME).map_err(|e| {
        NotariError::KeychainDeleteFailed(format!("Failed to delete signing key: {}", e))
    })?;
    Ok(())
}

/// Check if signing key exists in Keychain
#[cfg(target_os = "macos")]
pub fn has_signing_key() -> bool {
    get_generic_password(SERVICE_NAME, ACCOUNT_NAME).is_ok()
}

// Stub implementations for non-macOS platforms
#[cfg(not(target_os = "macos"))]
pub fn store_signing_key(_key_bytes: &[u8]) -> NotariResult<()> {
    Err(NotariError::PlatformNotSupported)
}

#[cfg(not(target_os = "macos"))]
pub fn retrieve_signing_key() -> NotariResult<Vec<u8>> {
    Err(NotariError::PlatformNotSupported)
}

#[cfg(not(target_os = "macos"))]
pub fn delete_signing_key() -> NotariResult<()> {
    Err(NotariError::PlatformNotSupported)
}

#[cfg(not(target_os = "macos"))]
pub fn has_signing_key() -> bool {
    false
}

// Note: No unit tests for keychain operations because:
// 1. These are thin wrappers around Apple's security_framework crate
// 2. Testing would require system keychain access (can't run in parallel)
// 3. The actual functionality is tested in integration tests:
//    - test_sign_stage_success: Tests key generation and signing
//    - test_package_stage_success: Tests key retrieval for proof packs
//    - Verification tests: Test signature verification
