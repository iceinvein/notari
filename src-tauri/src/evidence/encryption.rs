use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use pbkdf2::pbkdf2_hmac;
use rand::RngCore;
use sha2::Sha256;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

// Re-export types from manifest module
use crate::evidence::manifest::{
    ChunkInfo, ChunkedEncryptionInfo, EncryptionInfo, KeyDerivationInfo,
};
use crate::error::{NotariError, NotariResult};
use crate::logger::{LogLevel, LOGGER};

// Constants
const SALT_SIZE: usize = 32;
const NONCE_SIZE: usize = 12;
const KEY_SIZE: usize = 32;
const PBKDF2_ITERATIONS: u32 = 600_000; // OWASP recommendation for 2024
const CHUNK_SIZE: usize = 1024 * 1024; // 1MB chunks for streaming

/// Video encryption handler
pub struct VideoEncryptor;

impl VideoEncryptor {
    /// Encrypt a video file with AES-256-GCM
    pub fn encrypt_file<P: AsRef<Path>>(
        input_path: P,
        output_path: P,
        password: &str,
    ) -> NotariResult<EncryptionInfo> {
        // Generate random salt
        let mut salt = [0u8; SALT_SIZE];
        OsRng.fill_bytes(&mut salt);

        // Derive key from password using PBKDF2
        let mut key_bytes = [0u8; KEY_SIZE];
        pbkdf2_hmac::<Sha256>(
            password.as_bytes(),
            &salt,
            PBKDF2_ITERATIONS,
            &mut key_bytes,
        );
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
            .map_err(|e| NotariError::EncryptionFailed(format!("Encryption failed: {}", e)))?;

        // In AES-GCM, the authentication tag is appended to the ciphertext
        // Extract the last 16 bytes as the tag
        let tag_size = 16;
        let tag_bytes = &ciphertext[ciphertext.len() - tag_size..];

        // Write encrypted file
        let mut output_file = File::create(&output_path)?;
        output_file.write_all(&ciphertext)?;

        // Return encryption info (legacy file-level format)
        use base64::{engine::general_purpose, Engine as _};
        Ok(EncryptionInfo {
            algorithm: "AES-256-GCM".to_string(),
            key_derivation: KeyDerivationInfo {
                algorithm: "PBKDF2-HMAC-SHA256".to_string(),
                iterations: PBKDF2_ITERATIONS,
                salt: general_purpose::STANDARD.encode(&salt),
            },
            nonce: Some(general_purpose::STANDARD.encode(&nonce_bytes)),
            tag: Some(general_purpose::STANDARD.encode(tag_bytes)),
            chunked: None,
        })
    }

    /// Encrypt a video file with chunked AES-256-GCM (for streaming)
    pub fn encrypt_file_chunked<P: AsRef<Path>>(
        input_path: P,
        output_path: P,
        password: &str,
    ) -> NotariResult<EncryptionInfo> {
        use base64::{engine::general_purpose, Engine as _};

        // Generate random salt
        let mut salt = [0u8; SALT_SIZE];
        OsRng.fill_bytes(&mut salt);

        // Derive key from password using PBKDF2
        let mut key_bytes = [0u8; KEY_SIZE];
        pbkdf2_hmac::<Sha256>(
            password.as_bytes(),
            &salt,
            PBKDF2_ITERATIONS,
            &mut key_bytes,
        );
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);

        // Create cipher
        let cipher = Aes256Gcm::new(key);

        // Open input file
        let mut input_file = File::open(&input_path)?;
        let file_size = input_file.metadata()?.len();

        // Open output file
        let mut output_file = File::create(&output_path)?;

        // Calculate number of chunks
        let total_chunks = ((file_size + CHUNK_SIZE as u64 - 1) / CHUNK_SIZE as u64) as usize;
        let mut chunks = Vec::with_capacity(total_chunks);

        // Encrypt each chunk
        let mut plaintext_offset = 0u64;
        let mut ciphertext_offset = 0u64;
        let mut chunk_index = 0;

        while plaintext_offset < file_size {
            // Calculate chunk size (last chunk may be smaller)
            let remaining = file_size - plaintext_offset;
            let current_chunk_size = std::cmp::min(CHUNK_SIZE as u64, remaining) as usize;

            // Read chunk
            let mut plaintext_chunk = vec![0u8; current_chunk_size];
            input_file.read_exact(&mut plaintext_chunk)?;

            // Generate unique nonce for this chunk
            let mut nonce_bytes = [0u8; NONCE_SIZE];
            OsRng.fill_bytes(&mut nonce_bytes);
            let nonce = Nonce::from_slice(&nonce_bytes);

            // Encrypt chunk
            let ciphertext = cipher
                .encrypt(nonce, plaintext_chunk.as_ref())
                .map_err(|e| NotariError::EncryptionFailed(format!("Encryption failed for chunk {}: {}", chunk_index, e)))?;

            // Write encrypted chunk
            output_file.write_all(&ciphertext)?;

            // Store chunk info with ciphertext offset (for seeking in encrypted file)
            chunks.push(ChunkInfo {
                index: chunk_index,
                offset: ciphertext_offset,
                size: ciphertext.len() as u64,
                nonce: general_purpose::STANDARD.encode(&nonce_bytes),
            });

            plaintext_offset += current_chunk_size as u64;
            ciphertext_offset += ciphertext.len() as u64;
            chunk_index += 1;
        }

        // Return encryption info with chunked metadata
        Ok(EncryptionInfo {
            algorithm: "AES-256-GCM-CHUNKED".to_string(),
            key_derivation: KeyDerivationInfo {
                algorithm: "PBKDF2-HMAC-SHA256".to_string(),
                iterations: PBKDF2_ITERATIONS,
                salt: general_purpose::STANDARD.encode(&salt),
            },
            nonce: None,
            tag: None,
            chunked: Some(ChunkedEncryptionInfo {
                chunk_size: CHUNK_SIZE as u64,
                total_chunks,
                chunks,
            }),
        })
    }

    /// Decrypt a video file with AES-256-GCM (legacy file-level or chunked)
    pub fn decrypt_file<P: AsRef<Path>>(
        input_path: P,
        output_path: P,
        password: &str,
        encryption_info: &EncryptionInfo,
    ) -> NotariResult<()> {
        // Check if chunked encryption
        if let Some(chunked_info) = &encryption_info.chunked {
            return Self::decrypt_file_chunked(
                input_path,
                output_path,
                password,
                encryption_info,
                chunked_info,
            );
        }

        // Legacy file-level decryption
        use base64::{engine::general_purpose, Engine as _};
        let salt = general_purpose::STANDARD.decode(&encryption_info.key_derivation.salt)?;
        let nonce_bytes = general_purpose::STANDARD.decode(
            encryption_info
                .nonce
                .as_ref()
                .ok_or_else(|| NotariError::DecryptionFailed("Missing nonce for file-level encryption".to_string()))?,
        )?;

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
            .map_err(|_| NotariError::DecryptionFailed("Decryption failed: incorrect password or corrupted file".to_string()))?;

        // Write decrypted file
        let mut output_file = File::create(&output_path)?;
        output_file.write_all(&plaintext)?;

        Ok(())
    }

    /// Decrypt a chunked video file
    fn decrypt_file_chunked<P: AsRef<Path>>(
        input_path: P,
        output_path: P,
        password: &str,
        encryption_info: &EncryptionInfo,
        chunked_info: &ChunkedEncryptionInfo,
    ) -> NotariResult<()> {
        use base64::{engine::general_purpose, Engine as _};

        // Decode salt
        let salt = general_purpose::STANDARD.decode(&encryption_info.key_derivation.salt)?;

        // Derive key from password
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

        // Open input and output files
        let mut input_file = File::open(&input_path)?;
        let mut output_file = File::create(&output_path)?;

        // Decrypt each chunk
        for chunk_info in &chunked_info.chunks {
            // Decode nonce for this chunk
            let nonce_bytes = general_purpose::STANDARD.decode(&chunk_info.nonce)?;
            let nonce = Nonce::from_slice(&nonce_bytes);

            // Seek to chunk position
            use std::io::Seek;
            input_file.seek(std::io::SeekFrom::Start(chunk_info.offset))?;

            // Read encrypted chunk
            let mut ciphertext = vec![0u8; chunk_info.size as usize];
            input_file.read_exact(&mut ciphertext)?;

            // Decrypt chunk
            let plaintext = cipher.decrypt(nonce, ciphertext.as_ref()).map_err(|_| {
                NotariError::DecryptionFailed(format!(
                    "Decryption failed for chunk {}: incorrect password or corrupted file",
                    chunk_info.index
                ))
            })?;

            // Write decrypted chunk
            output_file.write_all(&plaintext)?;
        }

        Ok(())
    }

    /// Decrypt a specific chunk by index (for streaming)
    pub fn decrypt_chunk_by_index<P: AsRef<Path>>(
        input_path: P,
        chunk_index: usize,
        password: &str,
        encryption_info: &EncryptionInfo,
    ) -> NotariResult<Vec<u8>> {
        use base64::{engine::general_purpose, Engine as _};

        let chunked_info = encryption_info
            .chunked
            .as_ref()
            .ok_or_else(|| NotariError::DecryptionFailed("Not a chunked encryption".to_string()))?;

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Decrypting chunk {} of {} total chunks",
                chunk_index, chunked_info.total_chunks
            ),
            "encryption",
        );

        let chunk_info = chunked_info.chunks.get(chunk_index).ok_or_else(|| {
            NotariError::DecryptionFailed(format!(
                "Chunk index {} out of bounds (total chunks: {})",
                chunk_index,
                chunked_info.chunks.len()
            ))
        })?;

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Chunk {} info - offset: {}, size: {}, nonce length: {}",
                chunk_index,
                chunk_info.offset,
                chunk_info.size,
                chunk_info.nonce.len()
            ),
            "encryption",
        );

        // Decode salt
        let salt = general_purpose::STANDARD.decode(&encryption_info.key_derivation.salt)?;

        // Derive key from password
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

        // Decode nonce for this chunk
        let nonce_bytes = general_purpose::STANDARD
            .decode(&chunk_info.nonce)
            .map_err(|e| {
                LOGGER.log(
                    LogLevel::Error,
                    &format!("Failed to decode nonce for chunk {}: {}", chunk_index, e),
                    "encryption",
                );
                format!("Failed to decode nonce for chunk {}: {}", chunk_index, e)
            })?;

        if nonce_bytes.len() != NONCE_SIZE {
            let err_msg = format!(
                "Invalid nonce size for chunk {}: expected {}, got {}",
                chunk_index,
                NONCE_SIZE,
                nonce_bytes.len()
            );
            LOGGER.log(LogLevel::Error, &err_msg, "encryption");
            return Err(NotariError::DecryptionFailed(err_msg));
        }

        let nonce = Nonce::from_slice(&nonce_bytes);

        // Open input file and seek to chunk
        let mut input_file = File::open(&input_path)?;
        use std::io::Seek;
        input_file.seek(std::io::SeekFrom::Start(chunk_info.offset))?;

        // Read encrypted chunk
        let mut ciphertext = vec![0u8; chunk_info.size as usize];
        input_file.read_exact(&mut ciphertext).map_err(|e| {
            LOGGER.log(
                LogLevel::Error,
                &format!(
                    "Failed to read chunk {} at offset {}: {}",
                    chunk_index, chunk_info.offset, e
                ),
                "encryption",
            );
            NotariError::DecryptionFailed(format!(
                "Failed to read chunk {} at offset {}: {}",
                chunk_index, chunk_info.offset, e
            ))
        })?;

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Read {} bytes of ciphertext for chunk {}",
                ciphertext.len(),
                chunk_index
            ),
            "encryption",
        );

        // Decrypt chunk
        let plaintext = cipher.decrypt(nonce, ciphertext.as_ref()).map_err(|e| {
            LOGGER.log(
                LogLevel::Error,
                &format!("Decryption error for chunk {}: {:?}", chunk_index, e),
                "encryption",
            );
            NotariError::DecryptionFailed(format!(
                "Decryption failed for chunk {}: incorrect password or corrupted file",
                chunk_index
            ))
        })?;

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Successfully decrypted chunk {} - plaintext size: {}",
                chunk_index,
                plaintext.len()
            ),
            "encryption",
        );

        Ok(plaintext)
    }

    /// Decrypt a byte range (for HTTP range requests)
    pub fn decrypt_byte_range<P: AsRef<Path>>(
        input_path: P,
        start: u64,
        end: u64,
        password: &str,
        encryption_info: &EncryptionInfo,
    ) -> NotariResult<Vec<u8>> {
        LOGGER.log(
            LogLevel::Info,
            &format!(
                "decrypt_byte_range: requested bytes {}-{} (total {} bytes)",
                start,
                end,
                end - start + 1
            ),
            "encryption",
        );

        let chunked_info = encryption_info
            .chunked
            .as_ref()
            .ok_or_else(|| NotariError::DecryptionFailed("Not a chunked encryption".to_string()))?;

        // Calculate which chunks we need
        let chunk_size = chunked_info.chunk_size;
        let start_chunk = (start / chunk_size) as usize;
        let end_chunk = (end / chunk_size) as usize;

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "decrypt_byte_range: need chunks {}-{} (chunk_size={})",
                start_chunk, end_chunk, chunk_size
            ),
            "encryption",
        );

        let mut result = Vec::new();

        // Decrypt needed chunks
        for chunk_idx in start_chunk..=end_chunk {
            if chunk_idx >= chunked_info.total_chunks {
                break;
            }

            let chunk_data =
                Self::decrypt_chunk_by_index(&input_path, chunk_idx, password, encryption_info)?;

            // Calculate which bytes from this chunk we need
            let chunk_start_offset = chunk_idx as u64 * chunk_size;
            let chunk_end_offset = chunk_start_offset + chunk_data.len() as u64 - 1;

            let copy_start = if start > chunk_start_offset {
                (start - chunk_start_offset) as usize
            } else {
                0
            };

            let copy_end = if end < chunk_end_offset {
                (end - chunk_start_offset + 1) as usize
            } else {
                chunk_data.len()
            };

            LOGGER.log(
                LogLevel::Info,
                &format!("decrypt_byte_range: chunk {} - chunk_offset={}-{}, copy_range={}..{}, copying {} bytes",
                    chunk_idx, chunk_start_offset, chunk_end_offset, copy_start, copy_end, copy_end - copy_start),
                "encryption",
            );

            result.extend_from_slice(&chunk_data[copy_start..copy_end]);
        }

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "decrypt_byte_range: returning {} bytes (requested {})",
                result.len(),
                end - start + 1
            ),
            "encryption",
        );

        Ok(result)
    }
}

/// Validate password strength
pub fn validate_password(password: &str) -> NotariResult<()> {
    if password.len() < 8 {
        return Err(NotariError::InvalidPassword("Password must be at least 8 characters long".to_string()));
    }

    let has_uppercase = password.chars().any(|c| c.is_uppercase());
    let has_lowercase = password.chars().any(|c| c.is_lowercase());
    let has_digit = password.chars().any(|c| c.is_numeric());

    if !has_uppercase || !has_lowercase || !has_digit {
        return Err(NotariError::InvalidPassword(
            "Password must contain uppercase, lowercase, and numeric characters".to_string(),
        ));
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
        let encryption_info =
            VideoEncryptor::encrypt_file(input_file.path(), encrypted_file.path(), password)
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

    #[test]
    fn test_chunked_encrypt_decrypt_roundtrip() {
        // Create test file larger than chunk size
        let mut input_file = NamedTempFile::new().unwrap();
        let test_data = vec![0u8; CHUNK_SIZE * 2 + 500]; // 2.5 chunks
        input_file.write_all(&test_data).unwrap();
        input_file.flush().unwrap();

        // Encrypt with chunked method
        let encrypted_file = NamedTempFile::new().unwrap();
        let password = "ChunkedTest123";
        let encryption_info = VideoEncryptor::encrypt_file_chunked(
            input_file.path(),
            encrypted_file.path(),
            password,
        )
        .unwrap();

        // Verify encryption info
        assert_eq!(encryption_info.algorithm, "AES-256-GCM-CHUNKED");
        assert!(encryption_info.chunked.is_some());
        let chunked_info = encryption_info.chunked.as_ref().unwrap();
        assert_eq!(chunked_info.chunk_size, CHUNK_SIZE as u64);
        assert_eq!(chunked_info.total_chunks, 3); // 2 full chunks + 1 partial

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
    fn test_chunked_decrypt_wrong_password() {
        // Create and encrypt test file
        let mut input_file = NamedTempFile::new().unwrap();
        let test_data = vec![0u8; CHUNK_SIZE + 100];
        input_file.write_all(&test_data).unwrap();
        input_file.flush().unwrap();

        let encrypted_file = NamedTempFile::new().unwrap();
        let encryption_info = VideoEncryptor::encrypt_file_chunked(
            input_file.path(),
            encrypted_file.path(),
            "Correct123",
        )
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
    }

    #[test]
    fn test_encrypt_empty_file() {
        // Create empty file
        let input_file = NamedTempFile::new().unwrap();

        // Encrypt
        let encrypted_file = NamedTempFile::new().unwrap();
        let password = "EmptyFile123";
        let encryption_info =
            VideoEncryptor::encrypt_file(input_file.path(), encrypted_file.path(), password)
                .unwrap();

        // Decrypt
        let decrypted_file = NamedTempFile::new().unwrap();
        VideoEncryptor::decrypt_file(
            encrypted_file.path(),
            decrypted_file.path(),
            password,
            &encryption_info,
        )
        .unwrap();

        // Verify decrypted file is also empty
        let metadata = std::fs::metadata(decrypted_file.path()).unwrap();
        assert_eq!(metadata.len(), 0);
    }

    #[test]
    fn test_encrypt_large_file() {
        // Create a larger test file (5MB)
        let mut input_file = NamedTempFile::new().unwrap();
        let test_data = vec![42u8; 5 * 1024 * 1024];
        input_file.write_all(&test_data).unwrap();
        input_file.flush().unwrap();

        // Encrypt with chunked method
        let encrypted_file = NamedTempFile::new().unwrap();
        let password = "LargeFile123";
        let encryption_info = VideoEncryptor::encrypt_file_chunked(
            input_file.path(),
            encrypted_file.path(),
            password,
        )
        .unwrap();

        // Verify chunked info
        let chunked_info = encryption_info.chunked.as_ref().unwrap();
        assert_eq!(chunked_info.chunk_size, CHUNK_SIZE as u64);
        assert_eq!(chunked_info.total_chunks, 5); // 5MB / 1MB = 5 chunks

        // Decrypt
        let decrypted_file = NamedTempFile::new().unwrap();
        VideoEncryptor::decrypt_file(
            encrypted_file.path(),
            decrypted_file.path(),
            password,
            &encryption_info,
        )
        .unwrap();

        // Verify size matches
        let original_size = std::fs::metadata(input_file.path()).unwrap().len();
        let decrypted_size = std::fs::metadata(decrypted_file.path()).unwrap().len();
        assert_eq!(original_size, decrypted_size);
    }

    #[test]
    fn test_password_validation_edge_cases() {
        // Exactly 8 characters (minimum)
        assert!(validate_password("Pass123A").is_ok());

        // 7 characters (too short)
        assert!(validate_password("Pas123A").is_err());

        // All requirements met with special characters
        assert!(validate_password("P@ssw0rd!").is_ok());

        // Unicode characters
        assert!(validate_password("Pässw0rd").is_ok());

        // Very long password (must have uppercase, lowercase, and digit)
        let long_password = format!("{}abc123", "A".repeat(100));
        assert!(validate_password(&long_password).is_ok());
    }

    #[test]
    fn test_encryption_info_serialization() {
        // Create encryption info
        let encryption_info = EncryptionInfo {
            algorithm: "AES-256-GCM".to_string(),
            key_derivation: KeyDerivationInfo {
                algorithm: "PBKDF2-HMAC-SHA256".to_string(),
                iterations: PBKDF2_ITERATIONS,
                salt: "test_salt_base64".to_string(),
            },
            nonce: Some("test_nonce_base64".to_string()),
            tag: Some("test_tag_base64".to_string()),
            chunked: None,
        };

        // Serialize and deserialize
        let json = serde_json::to_string(&encryption_info).unwrap();
        let deserialized: EncryptionInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.algorithm, encryption_info.algorithm);
        assert_eq!(
            deserialized.key_derivation.iterations,
            encryption_info.key_derivation.iterations
        );
        assert_eq!(deserialized.nonce, encryption_info.nonce);
    }
}
