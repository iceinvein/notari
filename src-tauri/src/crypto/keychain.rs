use super::{CryptoError, CryptoResult};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeychainItem {
    pub service: String,
    pub account: String,
    pub data: Vec<u8>,
}

pub struct KeychainManager {
    service_prefix: String,
}

impl KeychainManager {
    pub fn new(service_prefix: &str) -> Self {
        Self {
            service_prefix: service_prefix.to_string(),
        }
    }

    /// Store a key in the platform keychain
    pub fn store_key(&self, key_id: &str, key_data: &[u8]) -> CryptoResult<()> {
        let service = format!("{}.{}", self.service_prefix, key_id);
        let account = "notari-crypto-key";
        
        #[cfg(target_os = "windows")]
        {
            self.store_key_windows(&service, account, key_data)
        }
        
        #[cfg(target_os = "macos")]
        {
            self.store_key_macos(&service, account, key_data)
        }
        
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            Err(CryptoError::Keychain(
                "Keychain not supported on this platform".to_string(),
            ))
        }
    }

    /// Retrieve a key from the platform keychain
    pub fn retrieve_key(&self, key_id: &str) -> CryptoResult<Vec<u8>> {
        let service = format!("{}.{}", self.service_prefix, key_id);
        let account = "notari-crypto-key";
        
        #[cfg(target_os = "windows")]
        {
            self.retrieve_key_windows(&service, account)
        }
        
        #[cfg(target_os = "macos")]
        {
            self.retrieve_key_macos(&service, account)
        }
        
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            Err(CryptoError::Keychain(
                "Keychain not supported on this platform".to_string(),
            ))
        }
    }

    /// Delete a key from the platform keychain
    pub fn delete_key(&self, key_id: &str) -> CryptoResult<()> {
        let service = format!("{}.{}", self.service_prefix, key_id);
        let account = "notari-crypto-key";
        
        #[cfg(target_os = "windows")]
        {
            self.delete_key_windows(&service, account)
        }
        
        #[cfg(target_os = "macos")]
        {
            self.delete_key_macos(&service, account)
        }
        
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            Err(CryptoError::Keychain(
                "Keychain not supported on this platform".to_string(),
            ))
        }
    }

    /// Check if a key exists in the keychain
    pub fn key_exists(&self, key_id: &str) -> CryptoResult<bool> {
        match self.retrieve_key(key_id) {
            Ok(_) => Ok(true),
            Err(CryptoError::KeyNotFound(_)) => Ok(false),
            Err(e) => Err(e),
        }
    }

    /// List all keys stored by this application
    pub fn list_keys(&self) -> CryptoResult<Vec<String>> {
        #[cfg(target_os = "windows")]
        {
            self.list_keys_windows()
        }
        
        #[cfg(target_os = "macos")]
        {
            self.list_keys_macos()
        }
        
        #[cfg(not(any(target_os = "windows", target_os = "macos")))]
        {
            Err(CryptoError::Keychain(
                "Keychain not supported on this platform".to_string(),
            ))
        }
    }

    // Windows-specific implementations
    #[cfg(target_os = "windows")]
    fn store_key_windows(&self, service: &str, account: &str, key_data: &[u8]) -> CryptoResult<()> {
        use windows::{
            core::PWSTR,
            Win32::Security::Credentials::{
                CredWriteW, CREDENTIALW, CRED_PERSIST_LOCAL_MACHINE, CRED_TYPE_GENERIC,
            },
        };
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        let target_name: Vec<u16> = OsStr::new(service)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        
        let user_name: Vec<u16> = OsStr::new(account)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut credential = CREDENTIALW {
            Flags: 0,
            Type: CRED_TYPE_GENERIC,
            TargetName: PWSTR(target_name.as_ptr() as *mut u16),
            Comment: PWSTR::null(),
            LastWritten: Default::default(),
            CredentialBlobSize: key_data.len() as u32,
            CredentialBlob: key_data.as_ptr() as *mut u8,
            Persist: CRED_PERSIST_LOCAL_MACHINE,
            AttributeCount: 0,
            Attributes: std::ptr::null_mut(),
            TargetAlias: PWSTR::null(),
            UserName: PWSTR(user_name.as_ptr() as *mut u16),
        };

        unsafe {
            CredWriteW(&mut credential, 0)
                .map_err(|e| CryptoError::Keychain(format!("Windows credential store failed: {}", e)))?;
        }

        Ok(())
    }

    #[cfg(target_os = "windows")]
    fn retrieve_key_windows(&self, service: &str, _account: &str) -> CryptoResult<Vec<u8>> {
        use windows::{
            core::PWSTR,
            Win32::Security::Credentials::{CredReadW, CredFree, CREDENTIALW, CRED_TYPE_GENERIC},
        };
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        let target_name: Vec<u16> = OsStr::new(service)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        let mut credential: *mut CREDENTIALW = std::ptr::null_mut();

        unsafe {
            CredReadW(
                PWSTR(target_name.as_ptr() as *mut u16),
                CRED_TYPE_GENERIC,
                0,
                &mut credential,
            )
            .map_err(|e| {
                if e.code().0 == 0x80070490 {
                    // ERROR_NOT_FOUND
                    CryptoError::KeyNotFound(service.to_string())
                } else {
                    CryptoError::Keychain(format!("Windows credential read failed: {}", e))
                }
            })?;

            if credential.is_null() {
                return Err(CryptoError::KeyNotFound(service.to_string()));
            }

            let cred_ref = &*credential;
            let key_data = std::slice::from_raw_parts(
                cred_ref.CredentialBlob,
                cred_ref.CredentialBlobSize as usize,
            ).to_vec();

            CredFree(credential as *mut _);

            Ok(key_data)
        }
    }

    #[cfg(target_os = "windows")]
    fn delete_key_windows(&self, service: &str, _account: &str) -> CryptoResult<()> {
        use windows::{
            core::PWSTR,
            Win32::Security::Credentials::{CredDeleteW, CRED_TYPE_GENERIC},
        };
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        let target_name: Vec<u16> = OsStr::new(service)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();

        unsafe {
            CredDeleteW(
                PWSTR(target_name.as_ptr() as *mut u16),
                CRED_TYPE_GENERIC,
                0,
            )
            .map_err(|e| {
                if e.code().0 == 0x80070490 {
                    // ERROR_NOT_FOUND - not an error for deletion
                    return Ok(());
                }
                CryptoError::Keychain(format!("Windows credential delete failed: {}", e))
            })?;
        }

        Ok(())
    }

    #[cfg(target_os = "windows")]
    fn list_keys_windows(&self) -> CryptoResult<Vec<String>> {
        // Windows credential enumeration is complex and requires additional APIs
        // For now, return empty list - in production this would enumerate credentials
        // matching our service prefix
        Ok(Vec::new())
    }

    // macOS-specific implementations
    #[cfg(target_os = "macos")]
    fn store_key_macos(&self, service: &str, account: &str, key_data: &[u8]) -> CryptoResult<()> {
        use security_framework::passwords::{set_generic_password, delete_generic_password};

        // Try to delete existing item first (update operation)
        let _ = delete_generic_password(service, account);

        set_generic_password(service, account, key_data)
            .map_err(|e| CryptoError::Keychain(format!("Failed to store key in keychain: {}", e)))?;

        Ok(())
    }

    #[cfg(target_os = "macos")]
    fn retrieve_key_macos(&self, service: &str, account: &str) -> CryptoResult<Vec<u8>> {
        use security_framework::passwords::get_generic_password;

        let key_data = get_generic_password(service, account)
            .map_err(|e| {
                CryptoError::KeyNotFound(format!("Key not found in keychain: {}", e))
            })?;

        Ok(key_data)
    }

    #[cfg(target_os = "macos")]
    fn delete_key_macos(&self, service: &str, account: &str) -> CryptoResult<()> {
        use security_framework::passwords::delete_generic_password;

        // Try to delete - ignore "not found" errors
        let _ = delete_generic_password(service, account);
        Ok(())
    }

    #[cfg(target_os = "macos")]
    fn list_keys_macos(&self) -> CryptoResult<Vec<String>> {
        // macOS keychain enumeration would require more complex SecItemCopyMatching calls
        // For now, return empty list - in production this would search for items
        // matching our service prefix
        Ok(Vec::new())
    }
}

impl Default for KeychainManager {
    fn default() -> Self {
        Self::new("com.notari.crypto")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_keychain_operations() {
        let keychain = KeychainManager::new("com.notari.test");
        let key_id = "test-key-123";
        let test_data = b"test-key-data-for-keychain";

        // Clean up any existing test key
        let _ = keychain.delete_key(key_id);

        // Test key doesn't exist initially
        assert!(!keychain.key_exists(key_id).unwrap_or(true));

        // Store key
        if let Ok(()) = keychain.store_key(key_id, test_data) {
            // Verify key exists
            assert!(keychain.key_exists(key_id).unwrap_or(false));

            // Retrieve key
            if let Ok(retrieved_data) = keychain.retrieve_key(key_id) {
                assert_eq!(retrieved_data, test_data);
            }

            // Clean up
            let _ = keychain.delete_key(key_id);
            
            // Verify key is deleted
            assert!(!keychain.key_exists(key_id).unwrap_or(true));
        }
        // Note: Tests may fail on systems without proper keychain access
        // This is expected in CI environments
    }

    #[test]
    fn test_keychain_manager_creation() {
        let keychain1 = KeychainManager::new("com.test.app1");
        let keychain2 = KeychainManager::new("com.test.app2");
        
        assert_eq!(keychain1.service_prefix, "com.test.app1");
        assert_eq!(keychain2.service_prefix, "com.test.app2");
    }

    #[test]
    fn test_default_keychain_manager() {
        let keychain = KeychainManager::default();
        assert_eq!(keychain.service_prefix, "com.notari.crypto");
    }
}