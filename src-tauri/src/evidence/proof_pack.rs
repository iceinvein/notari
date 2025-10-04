use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::FileOptions;
use zip::ZipWriter;

use super::keychain;
use super::manifest::EvidenceManifest;
use super::signature::KeyManager;
use crate::error::{NotariError, NotariResult};

/// Proof pack metadata
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProofPackMetadata {
    pub version: String,
    pub created_at: String,
    pub notari_version: String,
    pub recording_filename: String,
    pub is_encrypted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

/// Create a proof pack (ZIP archive) containing video + manifest + public key + README
pub fn create_proof_pack<P: AsRef<Path>>(
    video_path: P,
    manifest_path: P,
    output_path: P,
) -> NotariResult<PathBuf> {
    let video_path = video_path.as_ref();
    let manifest_path = manifest_path.as_ref();
    let output_path = output_path.as_ref();

    // Load manifest to get metadata
    let manifest = EvidenceManifest::load(manifest_path)?;

    // Get public key from keychain
    let public_key = if let Ok(key_bytes) = keychain::retrieve_signing_key() {
        let key_manager = KeyManager::from_bytes(&key_bytes)?;
        let public_key_bytes = key_manager.public_key();
        use base64::{engine::general_purpose, Engine as _};
        general_purpose::STANDARD.encode(public_key_bytes.as_bytes())
    } else {
        return Err(NotariError::NoSigningKey(
            "No signing key found in keychain".to_string(),
        ));
    };

    // Create ZIP file
    let file = File::create(output_path)?;
    let mut zip = ZipWriter::new(file);
    let options: FileOptions<()> = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    // Add video file
    let video_filename = video_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| {
            NotariError::ProofPackCreationFailed("Invalid video filename".to_string())
        })?;

    zip.start_file(format!("evidence/{}", video_filename), options)?;
    let mut video_file = File::open(video_path)?;
    let mut video_buffer = Vec::new();
    video_file.read_to_end(&mut video_buffer)?;
    zip.write_all(&video_buffer)?;

    // Add manifest
    let manifest_filename = manifest_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| {
            NotariError::ProofPackCreationFailed("Invalid manifest filename".to_string())
        })?;

    zip.start_file(format!("evidence/{}", manifest_filename), options)?;
    let mut manifest_file = File::open(manifest_path)?;
    let mut manifest_buffer = Vec::new();
    manifest_file.read_to_end(&mut manifest_buffer)?;
    zip.write_all(&manifest_buffer)?;

    // Add public key
    zip.start_file("evidence/public_key.txt", options)?;
    zip.write_all(public_key.as_bytes())?;

    // Add README
    let readme = generate_readme(&manifest, &public_key);
    zip.start_file("README.txt", options)?;
    zip.write_all(readme.as_bytes())?;

    // Add metadata (including custom metadata from manifest)
    let metadata = ProofPackMetadata {
        version: "1.0".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        notari_version: env!("CARGO_PKG_VERSION").to_string(),
        recording_filename: video_filename.to_string(),
        is_encrypted: manifest.recording.encrypted,
        title: manifest
            .metadata
            .custom
            .as_ref()
            .and_then(|c| c.title.clone()),
        description: manifest
            .metadata
            .custom
            .as_ref()
            .and_then(|c| c.description.clone()),
        tags: manifest
            .metadata
            .custom
            .as_ref()
            .and_then(|c| c.tags.clone()),
    };

    zip.start_file("metadata.json", options)?;
    let metadata_json = serde_json::to_string_pretty(&metadata)?;
    zip.write_all(metadata_json.as_bytes())?;

    // Finish ZIP
    zip.finish()?;

    Ok(output_path.to_path_buf())
}

/// Extract a proof pack and return paths to extracted files
pub fn extract_proof_pack<P: AsRef<Path>>(
    proof_pack_path: P,
    extract_dir: P,
) -> NotariResult<(PathBuf, PathBuf)> {
    let proof_pack_path = proof_pack_path.as_ref();
    let extract_dir = extract_dir.as_ref();

    // Create extraction directory
    fs::create_dir_all(extract_dir)?;

    // Open ZIP file
    let file = File::open(proof_pack_path)?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| {
        NotariError::ProofPackExtractionFailed(format!("Failed to open ZIP archive: {}", e))
    })?;

    let mut video_path: Option<PathBuf> = None;
    let mut manifest_path: Option<PathBuf> = None;

    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| {
            NotariError::ProofPackExtractionFailed(format!("Failed to read ZIP entry: {}", e))
        })?;
        let outpath = extract_dir.join(file.name());

        if file.name().ends_with('/') {
            fs::create_dir_all(&outpath)?;
        } else {
            if let Some(p) = outpath.parent() {
                fs::create_dir_all(p)?;
            }
            let mut outfile = File::create(&outpath)?;
            std::io::copy(&mut file, &mut outfile)?;

            // Track video and manifest paths
            if file.name().starts_with("evidence/") {
                if file.name().ends_with(".mov") || file.name().ends_with(".mov.enc") {
                    video_path = Some(outpath.clone());
                } else if file.name().ends_with(".json") {
                    manifest_path = Some(outpath.clone());
                }
            }
        }
    }

    let video_path = video_path.ok_or_else(|| {
        NotariError::InvalidProofPack("No video file found in proof pack".to_string())
    })?;
    let manifest_path = manifest_path.ok_or_else(|| {
        NotariError::InvalidProofPack("No manifest file found in proof pack".to_string())
    })?;

    Ok((video_path, manifest_path))
}

/// Generate README content for proof pack
fn generate_readme(manifest: &EvidenceManifest, public_key: &str) -> String {
    format!(
        r#"╔══════════════════════════════════════════════════════════════════════════════╗
║                         NOTARI EVIDENCE PROOF PACK                           ║
╚══════════════════════════════════════════════════════════════════════════════╝

This .notari file contains cryptographically signed video evidence recorded with
Notari, a tamper-evident screen recording system.

═══════════════════════════════════════════════════════════════════════════════
📦 PACKAGE CONTENTS
═══════════════════════════════════════════════════════════════════════════════

evidence/
  ├── {}          (Video recording)
  ├── {}          (Evidence manifest with signature)
  └── public_key.txt                (Public key for signature verification)

metadata.json                       (Proof pack metadata)
README.txt                          (This file)

═══════════════════════════════════════════════════════════════════════════════
📋 RECORDING INFORMATION
═══════════════════════════════════════════════════════════════════════════════

Session ID:       {}
Window:           {}
Application:      {}
Duration:         {:.1} seconds
Recorded:         {}
Encrypted:        {}

═══════════════════════════════════════════════════════════════════════════════
🔐 CRYPTOGRAPHIC VERIFICATION
═══════════════════════════════════════════════════════════════════════════════

This evidence is protected by:
  • Ed25519 digital signature
  • SHA-256 cryptographic hash
  • Tamper-evident manifest{}

Public Key (Ed25519):
{}

═══════════════════════════════════════════════════════════════════════════════
✅ HOW TO VERIFY & VIEW
═══════════════════════════════════════════════════════════════════════════════

1. Download Notari from: https://notari.app
2. Open Notari app
3. Drag & drop this .notari file into the app
   OR
   Click "Import Proof Pack" in the Verify tab
4. View verification results and play the video

The Notari app will:
  ✓ Verify the digital signature
  ✓ Verify the file hash
  ✓ Display all evidence metadata
  ✓ Allow you to play the video (with decryption if needed)

═══════════════════════════════════════════════════════════════════════════════
🛡️ SECURITY NOTES
═══════════════════════════════════════════════════════════════════════════════

• The digital signature proves this recording was created by the holder of the
  private key corresponding to the public key above.

• The SHA-256 hash proves the video file has not been modified since recording.

• The manifest contains metadata about the recording session, system info, and
  cryptographic proofs.

• If verification fails, the evidence may have been tampered with or corrupted.

• For encrypted videos, you'll need the decryption password to view the content.

═══════════════════════════════════════════════════════════════════════════════
📞 SUPPORT
═══════════════════════════════════════════════════════════════════════════════

For questions about this evidence or verification:
  • Website: https://notari.app
  • Documentation: https://docs.notari.app
  • Support: support@notari.app

═══════════════════════════════════════════════════════════════════════════════

Generated by Notari v{} on {}
"#,
        manifest
            .recording
            .file_path
            .split('/')
            .last()
            .unwrap_or("unknown"),
        manifest
            .recording
            .file_path
            .replace(".mov", ".json")
            .replace(".enc", "")
            .split('/')
            .last()
            .unwrap_or("unknown"),
        manifest.recording.session_id,
        manifest.metadata.window.title,
        manifest.metadata.window.app_name,
        manifest.recording.duration_seconds,
        manifest
            .timestamps
            .started_at
            .format("%Y-%m-%d %H:%M:%S UTC"),
        if manifest.recording.encrypted {
            "Yes"
        } else {
            "No"
        },
        // Blockchain anchor info
        if let Some(anchor) = &manifest.blockchain_anchor {
            format!("\n  • Blockchain anchor: {}", anchor.proof.description())
        } else {
            String::new()
        },
        public_key,
        env!("CARGO_PKG_VERSION"),
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::evidence::{signature::KeyManager, HashInfo};
    use std::io::Write;
    use tempfile::TempDir;
    use uuid::Uuid;

    fn create_test_manifest() -> EvidenceManifest {
        use crate::evidence::EvidenceManifestBuilder;

        let session_id = Uuid::new_v4();
        let file_path = PathBuf::from("/tmp/test.mov");
        let file_hash = HashInfo::from_bytes(b"test data");
        let now = chrono::Utc::now();

        let mut manifest = EvidenceManifestBuilder::new()
            .session_id(session_id)
            .file_path(file_path)
            .file_hash(file_hash)
            .file_size(1024)
            .duration(60.0)
            .window_title("Test Window")
            .window_id(123)
            .app_name("Test App")
            .app_bundle_id("com.test.app")
            .resolution("1920x1080")
            .frame_rate(30)
            .codec("h264")
            .system(
                "macOS",
                "14.0",
                "test-device-id",
                "test-machine",
                env!("CARGO_PKG_VERSION"),
                "ScreenCaptureKit",
            )
            .timestamps_from_dates(now, now)
            .build()
            .unwrap();

        // Sign the manifest
        let key_manager = KeyManager::generate();
        manifest.sign(&key_manager);

        manifest
    }

    #[test]
    fn test_proof_pack_metadata_serialization() {
        let metadata = ProofPackMetadata {
            version: "1.0".to_string(),
            created_at: "2024-01-01T00:00:00Z".to_string(),
            notari_version: "0.1.0".to_string(),
            recording_filename: "test.mov".to_string(),
            is_encrypted: false,
            title: Some("Test Recording".to_string()),
            description: Some("Test description".to_string()),
            tags: Some(vec!["test".to_string(), "demo".to_string()]),
        };

        let json = serde_json::to_string(&metadata).unwrap();
        let deserialized: ProofPackMetadata = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.version, metadata.version);
        assert_eq!(deserialized.recording_filename, metadata.recording_filename);
        assert_eq!(deserialized.is_encrypted, metadata.is_encrypted);
        assert_eq!(deserialized.title, metadata.title);
    }

    #[test]
    fn test_generate_readme() {
        let manifest = create_test_manifest();
        let public_key = "test_public_key_base64";

        let readme = generate_readme(&manifest, public_key);

        // Verify README contains key information
        assert!(readme.contains("NOTARI EVIDENCE PROOF PACK"));
        assert!(readme.contains(&manifest.recording.session_id));
        assert!(readme.contains(&manifest.metadata.window.title));
        assert!(readme.contains(&manifest.metadata.window.app_name));
        assert!(readme.contains(public_key));
        assert!(readme.contains("Ed25519"));
        assert!(readme.contains("SHA-256"));
    }

    #[test]
    fn test_readme_encrypted_flag() {
        let mut manifest = create_test_manifest();
        manifest.recording.encrypted = true;

        let readme = generate_readme(&manifest, "test_key");
        assert!(readme.contains("Encrypted:        Yes"));

        manifest.recording.encrypted = false;
        let readme = generate_readme(&manifest, "test_key");
        assert!(readme.contains("Encrypted:        No"));
    }

    #[test]
    fn test_create_and_extract_proof_pack() {
        // Setup: Create temporary directory and files
        let temp_dir = TempDir::new().unwrap();
        let video_path = temp_dir.path().join("test.mov");
        let manifest_path = temp_dir.path().join("test.json");
        let output_path = temp_dir.path().join("test.notari");
        let extract_dir = temp_dir.path().join("extracted");

        // Create test video file
        let mut video_file = std::fs::File::create(&video_path).unwrap();
        video_file.write_all(b"fake video content").unwrap();

        // Create and save test manifest
        let manifest = create_test_manifest();
        manifest.save(&manifest_path).unwrap();

        // Store signing key in memory (mock keychain)
        let _key_manager = KeyManager::generate();

        // Note: This test will fail if keychain is not available
        // In a real test environment, we'd mock the keychain
        // For now, we'll test the extraction part separately

        // Test extraction with a manually created ZIP
        let file = std::fs::File::create(&output_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let options: zip::write::FileOptions<()> =
            zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        // Add video
        zip.start_file("evidence/test.mov", options).unwrap();
        zip.write_all(b"fake video content").unwrap();

        // Add manifest
        zip.start_file("evidence/test.json", options).unwrap();
        let manifest_json = serde_json::to_string_pretty(&manifest).unwrap();
        zip.write_all(manifest_json.as_bytes()).unwrap();

        // Add public key
        zip.start_file("evidence/public_key.txt", options).unwrap();
        zip.write_all(b"test_public_key").unwrap();

        // Add README
        zip.start_file("README.txt", options).unwrap();
        zip.write_all(b"Test README").unwrap();

        // Add metadata
        let metadata = ProofPackMetadata {
            version: "1.0".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            notari_version: env!("CARGO_PKG_VERSION").to_string(),
            recording_filename: "test.mov".to_string(),
            is_encrypted: false,
            title: None,
            description: None,
            tags: None,
        };
        zip.start_file("metadata.json", options).unwrap();
        let metadata_json = serde_json::to_string_pretty(&metadata).unwrap();
        zip.write_all(metadata_json.as_bytes()).unwrap();

        zip.finish().unwrap();

        // Test extraction
        let (extracted_video, extracted_manifest) =
            extract_proof_pack(&output_path, &extract_dir).unwrap();

        // Verify extracted files exist
        assert!(extracted_video.exists());
        assert!(extracted_manifest.exists());

        // Verify extracted video content
        let mut extracted_video_content = Vec::new();
        std::fs::File::open(&extracted_video)
            .unwrap()
            .read_to_end(&mut extracted_video_content)
            .unwrap();
        assert_eq!(extracted_video_content, b"fake video content");

        // Verify extracted manifest can be loaded
        let loaded_manifest = EvidenceManifest::load(&extracted_manifest).unwrap();
        assert_eq!(
            loaded_manifest.recording.session_id,
            manifest.recording.session_id
        );
    }

    #[test]
    fn test_extract_proof_pack_missing_files() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("incomplete.notari");
        let extract_dir = temp_dir.path().join("extracted");

        // Create ZIP without required files
        let file = std::fs::File::create(&output_path).unwrap();
        let mut zip = zip::ZipWriter::new(file);
        let options: zip::write::FileOptions<()> = zip::write::FileOptions::default();

        zip.start_file("README.txt", options).unwrap();
        zip.write_all(b"Test README").unwrap();
        zip.finish().unwrap();

        // Extraction should fail
        let result = extract_proof_pack(&output_path, &extract_dir);
        assert!(result.is_err());
        let error_msg = result.unwrap_err().to_string();
        assert!(
            error_msg.contains("No video file found")
                || error_msg.contains("No manifest file found")
        );
    }
}
