use app_lib::evidence::*;
use chrono::Utc;
use std::fs::File;
use std::io::{Read, Write};
use tempfile::TempDir;
use uuid::Uuid;

/// Test the complete workflow: create recording, sign, verify
#[test]
fn test_complete_recording_workflow() {
    use app_lib::evidence::EvidenceManifestBuilder;

    // Setup: Create temporary directory
    let temp_dir = TempDir::new().unwrap();
    let video_path = temp_dir.path().join("recording.mov");
    let manifest_path = temp_dir.path().join("recording.json");

    // Step 1: Create a fake video file
    let mut video_file = File::create(&video_path).unwrap();
    let video_content = b"fake video content for testing";
    video_file.write_all(video_content).unwrap();
    video_file.flush().unwrap();

    // Step 2: Calculate hash
    let video_hash = HashInfo::from_file(&video_path).unwrap();
    assert_eq!(video_hash.algorithm, "SHA-256");

    // Step 3: Create manifest
    let session_id = Uuid::new_v4();
    let now = Utc::now();

    let mut manifest = EvidenceManifestBuilder::new()
        .session_id(session_id)
        .file_path(video_path.clone())
        .file_hash(video_hash.clone())
        .file_size(video_content.len() as u64)
        .duration(10.0)
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

    // Step 4: Sign manifest
    let key_manager = KeyManager::generate();
    manifest.sign(&key_manager);

    // Step 5: Save manifest
    manifest.save(&manifest_path).unwrap();

    // Step 6: Verify signature
    assert!(manifest.verify_signature().unwrap());

    // Step 7: Full verification
    let report = Verifier::verify(&manifest_path, &video_path).unwrap();
    assert_eq!(report.verification.status, VerificationStatus::Verified);
    assert_eq!(
        report.verification.checks.manifest_structure,
        CheckResult::Pass
    );
    assert_eq!(
        report.verification.checks.signature_valid,
        CheckResult::Pass
    );
    assert_eq!(report.verification.checks.hash_match, CheckResult::Pass);
}

/// Test encrypted recording workflow
#[test]
#[allow(deprecated)]
fn test_encrypted_recording_workflow() {
    let temp_dir = TempDir::new().unwrap();
    let plaintext_path = temp_dir.path().join("plaintext.mov");
    let encrypted_path = temp_dir.path().join("encrypted.mov.enc");
    let manifest_path = temp_dir.path().join("manifest.json");

    // Create plaintext video
    let mut plaintext_file = File::create(&plaintext_path).unwrap();
    let video_content = b"secret video content";
    plaintext_file.write_all(video_content).unwrap();
    plaintext_file.flush().unwrap();

    // Calculate plaintext hash
    let plaintext_hash = HashInfo::from_file(&plaintext_path).unwrap();

    // Encrypt video
    let password = "SecurePass123";
    let encryption_info =
        VideoEncryptor::encrypt_file(&plaintext_path, &encrypted_path, password).unwrap();

    // Calculate encrypted hash
    let encrypted_hash = HashInfo::from_file(&encrypted_path).unwrap();

    // Create manifest with encryption info
    use app_lib::evidence::EvidenceManifestBuilder;

    let session_id = Uuid::new_v4();
    let now = Utc::now();

    let mut manifest = EvidenceManifestBuilder::new()
        .session_id(session_id)
        .file_path(encrypted_path.clone())
        .file_hash(plaintext_hash.clone())
        .file_size(video_content.len() as u64)
        .duration(10.0)
        .window_title("Encrypted Test")
        .window_id(456)
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
        .encryption_info(encryption_info.clone())
        .encrypted_hash(encrypted_hash.clone())
        .build()
        .unwrap();

    // Sign manifest
    let key_manager = KeyManager::generate();
    manifest.sign(&key_manager);
    manifest.save(&manifest_path).unwrap();

    // Verify encrypted file
    let report = Verifier::verify(&manifest_path, &encrypted_path).unwrap();
    assert_eq!(report.verification.status, VerificationStatus::Verified);
    assert_eq!(report.verification.checks.hash_match, CheckResult::Pass);

    // Decrypt and verify
    let decrypted_path = temp_dir.path().join("decrypted.mov");
    VideoEncryptor::decrypt_file(&encrypted_path, &decrypted_path, password, &encryption_info)
        .unwrap();

    let mut decrypted_content = Vec::new();
    File::open(&decrypted_path)
        .unwrap()
        .read_to_end(&mut decrypted_content)
        .unwrap();
    assert_eq!(decrypted_content, video_content);
}

/// Test verification failure when file is tampered
#[test]
#[allow(deprecated)]
fn test_verification_fails_on_tampered_file() {
    let temp_dir = TempDir::new().unwrap();
    let video_path = temp_dir.path().join("recording.mov");
    let manifest_path = temp_dir.path().join("recording.json");

    // Create original video
    let mut video_file = File::create(&video_path).unwrap();
    video_file.write_all(b"original content").unwrap();
    video_file.flush().unwrap();

    // Create and sign manifest
    use app_lib::evidence::EvidenceManifestBuilder;

    let video_hash = HashInfo::from_file(&video_path).unwrap();
    let session_id = Uuid::new_v4();
    let now = Utc::now();

    let mut manifest = EvidenceManifestBuilder::new()
        .session_id(session_id)
        .file_path(video_path.clone())
        .file_hash(video_hash)
        .file_size(16)
        .duration(10.0)
        .window_title("Test")
        .window_id(789)
        .app_name("Test")
        .app_bundle_id("com.test")
        .resolution("1920x1080")
        .frame_rate(30)
        .codec("h264")
        .system("macOS", "14.0", "test-device", "test", "0.1.0", "ScreenCaptureKit")
        .timestamps_from_dates(now, now)
        .build()
        .unwrap();

    let key_manager = KeyManager::generate();
    manifest.sign(&key_manager);
    manifest.save(&manifest_path).unwrap();

    // Tamper with video file
    let mut video_file = File::create(&video_path).unwrap();
    video_file.write_all(b"tampered content").unwrap();
    video_file.flush().unwrap();

    // Verification should fail
    let report = Verifier::verify(&manifest_path, &video_path).unwrap();
    assert_eq!(report.verification.status, VerificationStatus::Failed);
    assert_eq!(report.verification.checks.hash_match, CheckResult::Fail);
}
