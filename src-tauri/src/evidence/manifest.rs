use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use uuid::Uuid;

use super::blockchain::BlockchainAnchor;
use super::{HashInfo, SignatureInfo};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvidenceManifest {
    pub version: String,
    pub recording: RecordingInfo,
    pub metadata: Metadata,
    pub system: SystemInfo,
    pub timestamps: Timestamps,
    pub signature: SignatureInfo,

    /// Blockchain anchor (optional, added in v1.1)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub blockchain_anchor: Option<BlockchainAnchor>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingInfo {
    pub session_id: String,
    pub file_path: String,
    pub encrypted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encryption: Option<EncryptionInfo>,
    pub plaintext_hash: HashInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub encrypted_hash: Option<HashInfo>,
    pub file_size_bytes: u64,
    pub duration_seconds: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EncryptionInfo {
    pub algorithm: String,
    pub key_derivation: KeyDerivationInfo,
    // For backward compatibility with file-level encryption
    #[serde(skip_serializing_if = "Option::is_none")]
    pub nonce: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag: Option<String>,
    // For chunk-based encryption
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chunked: Option<ChunkedEncryptionInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkedEncryptionInfo {
    pub chunk_size: u64,
    pub total_chunks: usize,
    pub chunks: Vec<ChunkInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkInfo {
    pub index: usize,
    pub offset: u64,
    pub size: u64,
    pub nonce: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyDerivationInfo {
    pub algorithm: String,
    pub iterations: u32,
    pub salt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub window: WindowInfo,
    pub video: VideoInfo,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom: Option<CustomMetadata>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomMetadata {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub title: String,
    pub id: u32,
    pub app_name: String,
    pub app_bundle_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoInfo {
    pub resolution: String,
    pub frame_rate: u32,
    pub codec: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemInfo {
    pub os: String,
    pub os_version: String,
    pub device_id: String,
    pub hostname: String,
    pub app_version: String,
    pub recorder: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Timestamps {
    pub started_at: DateTime<Utc>,
    pub stopped_at: DateTime<Utc>,
    pub manifest_created_at: DateTime<Utc>,
}

impl EvidenceManifest {
    /// Create a new evidence manifest
    pub fn new(
        session_id: Uuid,
        file_path: PathBuf,
        file_hash: HashInfo,
        file_size: u64,
        duration: f64,
        metadata: Metadata,
        system: SystemInfo,
        timestamps: Timestamps,
    ) -> Self {
        Self {
            version: "1.0".to_string(),
            recording: RecordingInfo {
                session_id: session_id.to_string(),
                file_path: file_path.to_string_lossy().to_string(),
                encrypted: false,
                encryption: None,
                plaintext_hash: file_hash,
                encrypted_hash: None,
                file_size_bytes: file_size,
                duration_seconds: duration,
            },
            metadata,
            system,
            timestamps,
            signature: SignatureInfo {
                algorithm: String::new(),
                public_key: String::new(),
                signature: String::new(),
                signed_data_hash: String::new(),
            },
            blockchain_anchor: None,
        }
    }

    /// Get the data to be signed (everything except the signature itself and blockchain anchor)
    pub fn signable_data(&self) -> Vec<u8> {
        // Create a copy without signature and blockchain anchor
        // The blockchain anchor is added after signing, so it should not be part of the signed data
        let mut manifest_copy = self.clone();
        manifest_copy.signature = SignatureInfo {
            algorithm: String::new(),
            public_key: String::new(),
            signature: String::new(),
            signed_data_hash: String::new(),
        };
        manifest_copy.blockchain_anchor = None;

        // Serialize to JSON (deterministic)
        serde_json::to_vec(&manifest_copy).unwrap()
    }

    /// Sign the manifest
    pub fn sign(&mut self, key_manager: &super::signature::KeyManager) {
        let data = self.signable_data();
        self.signature = key_manager.sign(&data);
    }

    /// Verify the manifest signature
    pub fn verify_signature(&self) -> Result<bool, Box<dyn std::error::Error>> {
        let data = self.signable_data();
        super::signature::KeyManager::verify(
            &self.signature.public_key,
            &self.signature.signature,
            &data,
        )
    }

    /// Save manifest to JSON file
    pub fn save<P: AsRef<std::path::Path>>(&self, path: P) -> std::io::Result<()> {
        let json = serde_json::to_string_pretty(self)?;
        std::fs::write(path, json)?;
        Ok(())
    }

    /// Load manifest from JSON file
    pub fn load<P: AsRef<std::path::Path>>(path: P) -> std::io::Result<Self> {
        let json = std::fs::read_to_string(path)?;
        let manifest: Self = serde_json::from_str(&json)?;
        Ok(manifest)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::evidence::signature::KeyManager;

    #[test]
    fn test_manifest_creation() {
        let session_id = Uuid::new_v4();
        let file_path = PathBuf::from("/tmp/test.mov");
        let file_hash = HashInfo {
            algorithm: "SHA-256".to_string(),
            value: "abc123".to_string(),
        };

        let metadata = Metadata {
            window: WindowInfo {
                title: "Test Window".to_string(),
                id: 123,
                app_name: "Test App".to_string(),
                app_bundle_id: "com.test.app".to_string(),
            },
            video: VideoInfo {
                resolution: "1920x1080".to_string(),
                frame_rate: 30,
                codec: "H.264".to_string(),
            },
            custom: None,
        };

        let system = SystemInfo {
            os: "macOS".to_string(),
            os_version: "14.0".to_string(),
            device_id: "test-device".to_string(),
            hostname: "test-host".to_string(),
            app_version: "1.0.0".to_string(),
            recorder: "notari".to_string(),
        };

        let now = Utc::now();
        let timestamps = Timestamps {
            started_at: now,
            stopped_at: now,
            manifest_created_at: now,
        };

        let manifest = EvidenceManifest::new(
            session_id, file_path, file_hash, 1024, 60.0, metadata, system, timestamps,
        );

        assert_eq!(manifest.version, "1.0");
        assert_eq!(manifest.recording.session_id, session_id.to_string());
    }

    #[test]
    fn test_manifest_sign_and_verify() {
        let session_id = Uuid::new_v4();
        let file_path = PathBuf::from("/tmp/test.mov");
        let file_hash = HashInfo {
            algorithm: "SHA-256".to_string(),
            value: "abc123".to_string(),
        };

        let metadata = Metadata {
            window: WindowInfo {
                title: "Test Window".to_string(),
                id: 123,
                app_name: "Test App".to_string(),
                app_bundle_id: "com.test.app".to_string(),
            },
            video: VideoInfo {
                resolution: "1920x1080".to_string(),
                frame_rate: 30,
                codec: "H.264".to_string(),
            },
            custom: None,
        };

        let system = SystemInfo {
            os: "macOS".to_string(),
            os_version: "14.0".to_string(),
            device_id: "test-device".to_string(),
            hostname: "test-host".to_string(),
            app_version: "1.0.0".to_string(),
            recorder: "notari".to_string(),
        };

        let now = Utc::now();
        let timestamps = Timestamps {
            started_at: now,
            stopped_at: now,
            manifest_created_at: now,
        };

        let mut manifest = EvidenceManifest::new(
            session_id, file_path, file_hash, 1024, 60.0, metadata, system, timestamps,
        );

        let key_manager = KeyManager::generate();
        manifest.sign(&key_manager);

        assert!(manifest.verify_signature().unwrap());
    }

    #[test]
    fn test_manifest_signature_with_blockchain_anchor() {
        use crate::evidence::blockchain::{AnchorProof, BlockchainAnchor};

        let session_id = Uuid::new_v4();
        let file_path = PathBuf::from("/tmp/test.mov");
        let file_hash = HashInfo {
            algorithm: "SHA-256".to_string(),
            value: "abc123".to_string(),
        };

        let metadata = Metadata {
            window: WindowInfo {
                title: "Test Window".to_string(),
                id: 123,
                app_name: "Test App".to_string(),
                app_bundle_id: "com.test.app".to_string(),
            },
            video: VideoInfo {
                resolution: "1920x1080".to_string(),
                frame_rate: 30,
                codec: "H.264".to_string(),
            },
            custom: None,
        };

        let system = SystemInfo {
            os: "macOS".to_string(),
            os_version: "14.0".to_string(),
            device_id: "test-device".to_string(),
            hostname: "test-host".to_string(),
            app_version: "1.0.0".to_string(),
            recorder: "notari".to_string(),
        };

        let now = Utc::now();
        let timestamps = Timestamps {
            started_at: now,
            stopped_at: now,
            manifest_created_at: now,
        };

        let mut manifest = EvidenceManifest::new(
            session_id, file_path, file_hash, 1024, 60.0, metadata, system, timestamps,
        );

        // Sign the manifest first
        let key_manager = KeyManager::generate();
        manifest.sign(&key_manager);

        // Verify signature before adding blockchain anchor
        assert!(manifest.verify_signature().unwrap());

        // Add blockchain anchor (simulating what happens during anchoring)
        manifest.blockchain_anchor = Some(BlockchainAnchor {
            anchored_at: Utc::now(),
            anchored_hash: "test_hash".to_string(),
            manifest_hash: "test_manifest_hash".to_string(),
            proof: AnchorProof::Mock {
                hash: "test_hash".to_string(),
                timestamp: Utc::now(),
            },
        });

        // Verify signature still works after adding blockchain anchor
        assert!(
            manifest.verify_signature().unwrap(),
            "Signature should remain valid after adding blockchain anchor"
        );
    }
}
