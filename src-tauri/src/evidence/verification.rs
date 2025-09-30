use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::path::Path;

use super::{EvidenceManifest, HashInfo};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationReport {
    pub verification: VerificationInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationInfo {
    pub timestamp: DateTime<Utc>,
    pub status: VerificationStatus,
    pub checks: VerificationChecks,
    pub recording_info: RecordingInfoSummary,
    pub signature_info: SignatureInfoSummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum VerificationStatus {
    Verified,
    Failed,
    Warning,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationChecks {
    pub manifest_structure: CheckResult,
    pub signature_valid: CheckResult,
    pub hash_match: CheckResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum CheckResult {
    Pass,
    Fail,
    Skip,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingInfoSummary {
    pub session_id: String,
    pub created_at: DateTime<Utc>,
    pub duration_seconds: f64,
    pub window_title: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignatureInfoSummary {
    pub algorithm: String,
    pub public_key: String,
    pub verified_by: String,
}

pub struct Verifier;

impl Verifier {
    /// Verify a recording and generate a report
    pub fn verify<P: AsRef<Path>>(
        manifest_path: P,
        video_path: P,
    ) -> Result<VerificationReport, Box<dyn Error>> {
        // Load manifest
        let manifest = EvidenceManifest::load(&manifest_path)?;

        // Check 1: Manifest structure
        let manifest_check = CheckResult::Pass;

        // Check 2: Verify signature
        let signature_valid = manifest.verify_signature()?;
        let signature_check = if signature_valid {
            CheckResult::Pass
        } else {
            CheckResult::Fail
        };

        // Check 3: Verify hash
        let computed_hash = HashInfo::from_file(&video_path)?;
        let hash_match = computed_hash.value == manifest.recording.plaintext_hash.value;
        let hash_check = if hash_match {
            CheckResult::Pass
        } else {
            CheckResult::Fail
        };

        // Determine overall status
        let status = if signature_valid && hash_match {
            VerificationStatus::Verified
        } else {
            VerificationStatus::Failed
        };

        Ok(VerificationReport {
            verification: VerificationInfo {
                timestamp: Utc::now(),
                status,
                checks: VerificationChecks {
                    manifest_structure: manifest_check,
                    signature_valid: signature_check,
                    hash_match: hash_check,
                },
                recording_info: RecordingInfoSummary {
                    session_id: manifest.recording.session_id.clone(),
                    created_at: manifest.timestamps.started_at,
                    duration_seconds: manifest.recording.duration_seconds,
                    window_title: manifest.metadata.window.title.clone(),
                },
                signature_info: SignatureInfoSummary {
                    algorithm: manifest.signature.algorithm.clone(),
                    public_key: manifest.signature.public_key.clone(),
                    verified_by: format!("notari-verifier v{}", env!("CARGO_PKG_VERSION")),
                },
            },
        })
    }

    /// Quick verification (just signature, no hash)
    pub fn verify_signature_only<P: AsRef<Path>>(manifest_path: P) -> Result<bool, Box<dyn Error>> {
        let manifest = EvidenceManifest::load(&manifest_path)?;
        manifest.verify_signature()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::evidence::{
        manifest::{Metadata, SystemInfo, Timestamps, VideoInfo, WindowInfo},
        signature::KeyManager,
    };
    use std::io::Write;
    use uuid::Uuid;

    #[test]
    fn test_verification_success() {
        // Create a test video file
        let mut video_file = tempfile::NamedTempFile::new().unwrap();
        video_file.write_all(b"test video content").unwrap();
        let video_path = video_file.path();

        // Calculate hash
        let file_hash = HashInfo::from_file(video_path).unwrap();

        // Create manifest
        let session_id = Uuid::new_v4();
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
            session_id,
            video_path.to_path_buf(),
            file_hash,
            18,
            60.0,
            metadata,
            system,
            timestamps,
        );

        // Sign manifest
        let key_manager = KeyManager::generate();
        manifest.sign(&key_manager);

        // Save manifest
        let manifest_file = tempfile::NamedTempFile::new().unwrap();
        manifest.save(manifest_file.path()).unwrap();

        // Verify
        let report = Verifier::verify(manifest_file.path(), video_path).unwrap();

        match report.verification.status {
            VerificationStatus::Verified => (),
            _ => panic!("Verification should have succeeded"),
        }
    }

    #[test]
    fn test_verification_fails_with_tampered_video() {
        // Create a test video file
        let mut video_file = tempfile::NamedTempFile::new().unwrap();
        video_file.write_all(b"test video content").unwrap();
        let video_path = video_file.path().to_path_buf();

        // Calculate hash
        let file_hash = HashInfo::from_file(&video_path).unwrap();

        // Create and sign manifest
        let session_id = Uuid::new_v4();
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
            session_id,
            video_path.clone(),
            file_hash,
            18,
            60.0,
            metadata,
            system,
            timestamps,
        );

        let key_manager = KeyManager::generate();
        manifest.sign(&key_manager);

        let manifest_file = tempfile::NamedTempFile::new().unwrap();
        manifest.save(manifest_file.path()).unwrap();

        // Tamper with video
        video_file.write_all(b"tampered content").unwrap();

        // Verify should fail
        let report = Verifier::verify(manifest_file.path(), &video_path).unwrap();

        match report.verification.status {
            VerificationStatus::Failed => (),
            _ => panic!("Verification should have failed"),
        }
    }
}
