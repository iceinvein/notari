use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{self, Read};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HashInfo {
    pub algorithm: String,
    pub value: String,
}

impl HashInfo {
    /// Calculate SHA-256 hash of a file
    pub fn from_file<P: AsRef<Path>>(path: P) -> io::Result<Self> {
        let mut file = File::open(path)?;
        let mut hasher = Sha256::new();
        let mut buffer = [0u8; 8192];

        loop {
            let bytes_read = file.read(&mut buffer)?;
            if bytes_read == 0 {
                break;
            }
            hasher.update(&buffer[..bytes_read]);
        }

        let hash = hasher.finalize();
        Ok(Self {
            algorithm: "SHA-256".to_string(),
            value: hex::encode(hash),
        })
    }

    /// Calculate SHA-256 hash of data in memory
    pub fn from_bytes(data: &[u8]) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(data);
        let hash = hasher.finalize();

        Self {
            algorithm: "SHA-256".to_string(),
            value: hex::encode(hash),
        }
    }

    /// Verify hash matches expected value
    pub fn verify<P: AsRef<Path>>(&self, path: P) -> io::Result<bool> {
        let computed = Self::from_file(path)?;
        Ok(computed.value == self.value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_hash_from_bytes() {
        let data = b"test data";
        let hash = HashInfo::from_bytes(data);
        assert_eq!(hash.algorithm, "SHA-256");
        assert!(!hash.value.is_empty());
    }

    #[test]
    fn test_hash_consistency() {
        let data = b"test data";
        let hash1 = HashInfo::from_bytes(data);
        let hash2 = HashInfo::from_bytes(data);
        assert_eq!(hash1.value, hash2.value);
    }

    #[test]
    fn test_hash_from_file() {
        use std::io::Write;
        let mut temp_file = tempfile::NamedTempFile::new().unwrap();
        temp_file.write_all(b"test file content").unwrap();

        let hash = HashInfo::from_file(temp_file.path()).unwrap();
        assert_eq!(hash.algorithm, "SHA-256");
        assert!(!hash.value.is_empty());
    }

    #[test]
    fn test_hash_verify() {
        let mut temp_file = tempfile::NamedTempFile::new().unwrap();
        temp_file.write_all(b"test file content").unwrap();

        let hash = HashInfo::from_file(temp_file.path()).unwrap();
        assert!(hash.verify(temp_file.path()).unwrap());
    }

    #[test]
    fn test_hash_verify_fails_on_modified_file() {
        let mut temp_file = tempfile::NamedTempFile::new().unwrap();
        temp_file.write_all(b"original content").unwrap();

        let hash = HashInfo::from_file(temp_file.path()).unwrap();

        // Modify the file
        temp_file.write_all(b" modified").unwrap();
        temp_file.flush().unwrap();

        // Verification should fail
        assert!(!hash.verify(temp_file.path()).unwrap());
    }

    #[test]
    fn test_hash_empty_file() {
        let temp_file = tempfile::NamedTempFile::new().unwrap();

        let hash = HashInfo::from_file(temp_file.path()).unwrap();
        assert_eq!(hash.algorithm, "SHA-256");
        assert!(!hash.value.is_empty());

        // Empty file should have a specific hash
        let expected_empty_hash =
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        assert_eq!(hash.value, expected_empty_hash);
    }

    #[test]
    fn test_hash_large_file() {
        let mut temp_file = tempfile::NamedTempFile::new().unwrap();
        // Write 10MB of data
        let data = vec![42u8; 10 * 1024 * 1024];
        temp_file.write_all(&data).unwrap();
        temp_file.flush().unwrap();

        let hash = HashInfo::from_file(temp_file.path()).unwrap();
        assert_eq!(hash.algorithm, "SHA-256");
        assert!(!hash.value.is_empty());
        assert_eq!(hash.value.len(), 64); // SHA-256 produces 64 hex characters
    }

    #[test]
    fn test_hash_different_data_produces_different_hashes() {
        let hash1 = HashInfo::from_bytes(b"data1");
        let hash2 = HashInfo::from_bytes(b"data2");
        assert_ne!(hash1.value, hash2.value);
    }

    #[test]
    fn test_hash_value_format() {
        let hash = HashInfo::from_bytes(b"test");
        // SHA-256 hash should be 64 hex characters
        assert_eq!(hash.value.len(), 64);
        // Should only contain hex characters
        assert!(hash.value.chars().all(|c| c.is_ascii_hexdigit()));
    }

    #[test]
    fn test_hash_serialization() {
        let hash = HashInfo {
            algorithm: "SHA-256".to_string(),
            value: "abc123".to_string(),
        };

        let json = serde_json::to_string(&hash).unwrap();
        let deserialized: HashInfo = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.algorithm, hash.algorithm);
        assert_eq!(deserialized.value, hash.value);
    }

    #[test]
    fn test_hash_from_file_nonexistent() {
        let result = HashInfo::from_file("/nonexistent/file.txt");
        assert!(result.is_err());
    }

    #[test]
    fn test_hash_verify_nonexistent() {
        let hash = HashInfo {
            algorithm: "SHA-256".to_string(),
            value: "test".to_string(),
        };

        let result = hash.verify("/nonexistent/file.txt");
        assert!(result.is_err());
    }
}
