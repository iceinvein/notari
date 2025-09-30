use std::error::Error;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use zip::write::FileOptions;
use zip::ZipWriter;

use super::keychain;
use super::manifest::EvidenceManifest;
use super::signature::KeyManager;

/// Proof pack metadata
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ProofPackMetadata {
    pub version: String,
    pub created_at: String,
    pub notari_version: String,
    pub recording_filename: String,
    pub is_encrypted: bool,
}

/// Create a proof pack (ZIP archive) containing video + manifest + public key + README
pub fn create_proof_pack<P: AsRef<Path>>(
    video_path: P,
    manifest_path: P,
    output_path: P,
) -> Result<PathBuf, Box<dyn Error>> {
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
        return Err("No signing key found in keychain".into());
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
        .ok_or("Invalid video filename")?;

    zip.start_file(format!("evidence/{}", video_filename), options)?;
    let mut video_file = File::open(video_path)?;
    let mut video_buffer = Vec::new();
    video_file.read_to_end(&mut video_buffer)?;
    zip.write_all(&video_buffer)?;

    // Add manifest
    let manifest_filename = manifest_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or("Invalid manifest filename")?;

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

    // Add metadata
    let metadata = ProofPackMetadata {
        version: "1.0".to_string(),
        created_at: chrono::Utc::now().to_rfc3339(),
        notari_version: env!("CARGO_PKG_VERSION").to_string(),
        recording_filename: video_filename.to_string(),
        is_encrypted: manifest.recording.encrypted,
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
) -> Result<(PathBuf, PathBuf), Box<dyn Error>> {
    let proof_pack_path = proof_pack_path.as_ref();
    let extract_dir = extract_dir.as_ref();

    // Create extraction directory
    fs::create_dir_all(extract_dir)?;

    // Open ZIP file
    let file = File::open(proof_pack_path)?;
    let mut archive = zip::ZipArchive::new(file)?;

    let mut video_path: Option<PathBuf> = None;
    let mut manifest_path: Option<PathBuf> = None;

    // Extract all files
    for i in 0..archive.len() {
        let mut file = archive.by_index(i)?;
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

    let video_path = video_path.ok_or("No video file found in proof pack")?;
    let manifest_path = manifest_path.ok_or("No manifest file found in proof pack")?;

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
  • Tamper-evident manifest

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
        public_key,
        env!("CARGO_PKG_VERSION"),
        chrono::Utc::now().format("%Y-%m-%d %H:%M:%S UTC"),
    )
}
