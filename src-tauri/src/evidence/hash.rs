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
}
