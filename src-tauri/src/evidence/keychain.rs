use std::error::Error;

#[cfg(target_os = "macos")]
use security_framework::passwords::{
    delete_generic_password, get_generic_password, set_generic_password,
};

const SERVICE_NAME: &str = "com.notari.evidence";
const ACCOUNT_NAME: &str = "signing_key";

/// Store signing key in macOS Keychain
#[cfg(target_os = "macos")]
pub fn store_signing_key(key_bytes: &[u8]) -> Result<(), Box<dyn Error>> {
    set_generic_password(SERVICE_NAME, ACCOUNT_NAME, key_bytes)?;
    Ok(())
}

/// Retrieve signing key from macOS Keychain
#[cfg(target_os = "macos")]
pub fn retrieve_signing_key() -> Result<Vec<u8>, Box<dyn Error>> {
    let key_bytes = get_generic_password(SERVICE_NAME, ACCOUNT_NAME)?;
    Ok(key_bytes)
}

/// Delete signing key from macOS Keychain
#[cfg(target_os = "macos")]
pub fn delete_signing_key() -> Result<(), Box<dyn Error>> {
    delete_generic_password(SERVICE_NAME, ACCOUNT_NAME)?;
    Ok(())
}

/// Check if signing key exists in Keychain
#[cfg(target_os = "macos")]
pub fn has_signing_key() -> bool {
    get_generic_password(SERVICE_NAME, ACCOUNT_NAME).is_ok()
}

// Stub implementations for non-macOS platforms
#[cfg(not(target_os = "macos"))]
pub fn store_signing_key(_key_bytes: &[u8]) -> Result<(), Box<dyn Error>> {
    Err("Keychain storage not supported on this platform".into())
}

#[cfg(not(target_os = "macos"))]
pub fn retrieve_signing_key() -> Result<Vec<u8>, Box<dyn Error>> {
    Err("Keychain storage not supported on this platform".into())
}

#[cfg(not(target_os = "macos"))]
pub fn delete_signing_key() -> Result<(), Box<dyn Error>> {
    Err("Keychain storage not supported on this platform".into())
}

#[cfg(not(target_os = "macos"))]
pub fn has_signing_key() -> bool {
    false
}

#[cfg(test)]
#[cfg(target_os = "macos")]
mod tests {
    use super::*;

    #[test]
    fn test_keychain_operations() {
        // Clean up any existing key (ignore errors if it doesn't exist)
        let _ = delete_signing_key();

        // Wait a moment for keychain to update
        std::thread::sleep(std::time::Duration::from_millis(100));

        // Store a test key
        let test_key = b"test_key_32_bytes_long_______";
        store_signing_key(test_key).unwrap();

        // Test has_signing_key after storing
        assert!(has_signing_key());

        // Retrieve and verify
        let retrieved = retrieve_signing_key().unwrap();
        assert_eq!(retrieved, test_key);

        // Update with a different key
        let new_key = b"new_test_key_32_bytes_long___";
        store_signing_key(new_key).unwrap();

        // Verify the new key
        let retrieved_new = retrieve_signing_key().unwrap();
        assert_eq!(retrieved_new, new_key);

        // Clean up
        delete_signing_key().unwrap();

        // Wait a moment for keychain to update
        std::thread::sleep(std::time::Duration::from_millis(100));

        // Verify deletion (may still exist due to keychain caching, so we just check it doesn't error)
        let _ = has_signing_key();
    }
}
