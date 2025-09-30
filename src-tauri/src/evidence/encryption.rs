use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;
use std::error::Error;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

// Re-export types from manifest module
use crate::evidence::manifest::{EncryptionInfo, KeyDerivationInfo};

// Constants
const SALT_SIZE: usize = 32;
const NONCE_SIZE: usize = 12;
const KEY_SIZE: usize = 32;
const PBKDF2_ITERATIONS: u32 = 600_000; // OWASP recommendation for 2024

/// Video encryption handler
pub struct VideoEncryptor;

impl VideoEncryptor {
    /// Encrypt a video file with AES-256-GCM
    pub fn encrypt_file<P: AsRef<Path>>(
        input_path: P,
        output_path: P,
        password: &str,
    ) -> Result<EncryptionInfo, Box<dyn Error>> {
        // Generate random salt
        let mut salt = [0u8; SALT_SIZE];
        OsRng.fill_bytes(&mut salt);

        // Derive key from password using PBKDF2
        let mut key_bytes = [0u8; KEY_SIZE];
        pbkdf2_hmac::<Sha256>(password.as_bytes(), &salt, PBKDF2_ITERATIONS, &mut key_bytes);
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);

        // Generate random nonce
        let mut nonce_bytes = [0u8; NONCE_SIZE];
        OsRng.fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Create cipher
        let cipher = Aes256Gcm::new(key);

        // Read input file
        let mut input_file = File::open(&input_path)?;
        let mut plaintext = Vec::new();
        input_file.read_to_end(&mut plaintext)?;

        // Encrypt
        let ciphertext = cipher
            .encrypt(nonce, plaintext.as_ref())
            .map_err(|e| format!("Encryption failed: {}", e))?;

        // In AES-GCM, the authentication tag is appended to the ciphertext
        // Extract the last 16 bytes as the tag
        let tag_size = 16;
        let tag_bytes = &ciphertext[ciphertext.len() - tag_size..];

        // Write encrypted file
        let mut output_file = File::create(&output_path)?;
        output_file.write_all(&ciphertext)?;

        // Return encryption info
        use base64::{engine::general_purpose, Engine as _};
        Ok(EncryptionInfo {
            algorithm: "AES-256-GCM".to_string(),
            key_derivation: KeyDerivationInfo {
                algorithm: "PBKDF2-HMAC-SHA256".to_string(),
                iterations: PBKDF2_ITERATIONS,
                salt: general_purpose::STANDARD.encode(&salt),
            },
            nonce: general_purpose::STANDARD.encode(&nonce_bytes),
            tag: general_purpose::STANDARD.encode(tag_bytes),
        })
    }

    /// Decrypt a video file with AES-256-GCM
    pub fn decrypt_file<P: AsRef<Path>>(
        input_path: P,
        output_path: P,
        password: &str,
        encryption_info: &EncryptionInfo,
    ) -> Result<(), Box<dyn Error>> {
        // Decode salt and nonce
        use base64::{engine::general_purpose, Engine as _};
        let salt = general_purpose::STANDARD.decode(&encryption_info.key_derivation.salt)?;
        let nonce_bytes = general_purpose::STANDARD.decode(&encryption_info.nonce)?;

        // Derive key from password using same parameters
        let mut key_bytes = [0u8; KEY_SIZE];
        pbkdf2_hmac::<Sha256>(
            password.as_bytes(),
            &salt,
            encryption_info.key_derivation.iterations,
            &mut key_bytes,
        );
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);

        // Create cipher
        let cipher = Aes256Gcm::new(key);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Read encrypted file
        let mut input_file = File::open(&input_path)?;
        let mut ciphertext = Vec::new();
        input_file.read_to_end(&mut ciphertext)?;

        // Decrypt
        let plaintext = cipher
            .decrypt(nonce, ciphertext.as_ref())
            .map_err(|_| "Decryption failed: incorrect password or corrupted file")?;

        // Write decrypted file
        let mut output_file = File::create(&output_path)?;
        output_file.write_all(&plaintext)?;

        Ok(())
    }
}

/// Validate password strength
pub fn validate_password(password: &str) -> Result<(), String> {
    if password.len() < 8 {
        return Err("Password must be at least 8 characters long".to_string());
    }

    let has_uppercase = password.chars().any(|c| c.is_uppercase());
    let has_lowercase = password.chars().any(|c| c.is_lowercase());
    let has_digit = password.chars().any(|c| c.is_numeric());

    if !has_uppercase || !has_lowercase || !has_digit {
        return Err(
            "Password must contain uppercase, lowercase, and numeric characters".to_string(),
        );
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        // Create test file
        let mut input_file = NamedTempFile::new().unwrap();
        let test_data = b"This is a test video file content";
        input_file.write_all(test_data).unwrap();
        input_file.flush().unwrap();

        // Encrypt
        let encrypted_file = NamedTempFile::new().unwrap();
        let password = "TestPassword123";
        let encryption_info = VideoEncryptor::encrypt_file(
            input_file.path(),
            encrypted_file.path(),
            password,
        )
        .unwrap();

        // Verify encryption info
        assert_eq!(encryption_info.algorithm, "AES-256-GCM");
        assert_eq!(
            encryption_info.key_derivation.algorithm,
            "PBKDF2-HMAC-SHA256"
        );
        assert_eq!(encryption_info.key_derivation.iterations, PBKDF2_ITERATIONS);

        // Decrypt
        let decrypted_file = NamedTempFile::new().unwrap();
        VideoEncryptor::decrypt_file(
            encrypted_file.path(),
            decrypted_file.path(),
            password,
            &encryption_info,
        )
        .unwrap();

        // Verify decrypted content matches original
        let mut decrypted_content = Vec::new();
        File::open(decrypted_file.path())
            .unwrap()
            .read_to_end(&mut decrypted_content)
            .unwrap();
        assert_eq!(decrypted_content, test_data);
    }

    #[test]
    fn test_decrypt_wrong_password() {
        // Create and encrypt test file
        let mut input_file = NamedTempFile::new().unwrap();
        input_file.write_all(b"Secret content").unwrap();
        input_file.flush().unwrap();

        let encrypted_file = NamedTempFile::new().unwrap();
        let encryption_info =
            VideoEncryptor::encrypt_file(input_file.path(), encrypted_file.path(), "Correct123")
                .unwrap();

        // Try to decrypt with wrong password
        let decrypted_file = NamedTempFile::new().unwrap();
        let result = VideoEncryptor::decrypt_file(
            encrypted_file.path(),
            decrypted_file.path(),
            "Wrong123",
            &encryption_info,
        );

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Decryption failed"));
    }

    #[test]
    fn test_validate_password() {
        // Valid passwords
        assert!(validate_password("Password123").is_ok());
        assert!(validate_password("MySecure1Pass").is_ok());

        // Invalid passwords
        assert!(validate_password("short1A").is_err()); // Too short
        assert!(validate_password("nouppercase123").is_err()); // No uppercase
        assert!(validate_password("NOLOWERCASE123").is_err()); // No lowercase
        assert!(validate_password("NoDigitsHere").is_err()); // No digits
    }

    #[test]
    fn test_encryption_produces_different_output() {
        // Create test file
        let mut input_file = NamedTempFile::new().unwrap();
        input_file.write_all(b"Test content").unwrap();
        input_file.flush().unwrap();

        // Encrypt twice with same password
        let encrypted1 = NamedTempFile::new().unwrap();
        let encrypted2 = NamedTempFile::new().unwrap();
        let password = "SamePassword123";

        VideoEncryptor::encrypt_file(input_file.path(), encrypted1.path(), password).unwrap();
        VideoEncryptor::encrypt_file(input_file.path(), encrypted2.path(), password).unwrap();

        // Read encrypted files
        let mut content1 = Vec::new();
        let mut content2 = Vec::new();
        File::open(encrypted1.path())
            .unwrap()
            .read_to_end(&mut content1)
            .unwrap();
        File::open(encrypted2.path())
            .unwrap()
            .read_to_end(&mut content2)
            .unwrap();

        // Encrypted outputs should be different (due to random salt and nonce)
        assert_ne!(content1, content2);
    }
}

