use app_lib::evidence::*;
use chrono::Utc;
use std::fs::File;
use std::io::{Read, Write};
use tempfile::TempDir;
use uuid::Uuid;

/// Test the complete workflow: create recording, sign, verify
#[test]
fn test_complete_recording_workflow() {
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
    let metadata = manifest::Metadata {
        window: manifest::WindowInfo {
            title: "Test Window".to_string(),
            id: 123,
            app_name: "Test App".to_string(),
            app_bundle_id: "com.test.app".to_string(),
        },
        video: manifest::VideoInfo {
            resolution: "1920x1080".to_string(),
            frame_rate: 30,
            codec: "h264".to_string(),
        },
        custom: None,
    };

    let system = manifest::SystemInfo {
        os: "macOS".to_string(),
        os_version: "14.0".to_string(),
        device_id: "test-device-id".to_string(),
        hostname: "test-machine".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        recorder: "ScreenCaptureKit".to_string(),
    };

    let now = Utc::now();
    let timestamps = manifest::Timestamps {
        started_at: now,
        stopped_at: now,
        manifest_created_at: now,
    };

    let mut manifest = EvidenceManifest::new(
        session_id,
        video_path.clone(),
        video_hash.clone(),
        video_content.len() as u64,
        10.0,
        metadata,
        system,
        timestamps,
    );

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
    let session_id = Uuid::new_v4();
    let metadata = manifest::Metadata {
        window: manifest::WindowInfo {
            title: "Encrypted Test".to_string(),
            id: 456,
            app_name: "Test App".to_string(),
            app_bundle_id: "com.test.app".to_string(),
        },
        video: manifest::VideoInfo {
            resolution: "1920x1080".to_string(),
            frame_rate: 30,
            codec: "h264".to_string(),
        },
        custom: None,
    };

    let system = manifest::SystemInfo {
        os: "macOS".to_string(),
        os_version: "14.0".to_string(),
        device_id: "test-device-id".to_string(),
        hostname: "test-machine".to_string(),
        app_version: env!("CARGO_PKG_VERSION").to_string(),
        recorder: "ScreenCaptureKit".to_string(),
    };

    let now = Utc::now();
    let timestamps = manifest::Timestamps {
        started_at: now,
        stopped_at: now,
        manifest_created_at: now,
    };

    let mut manifest = EvidenceManifest::new(
        session_id,
        encrypted_path.clone(),
        plaintext_hash.clone(),
        video_content.len() as u64,
        10.0,
        metadata,
        system,
        timestamps,
    );

    // Set encryption info
    manifest.recording.encrypted = true;
    manifest.recording.encryption = Some(encryption_info.clone());
    manifest.recording.encrypted_hash = Some(encrypted_hash.clone());

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
fn test_verification_fails_on_tampered_file() {
    let temp_dir = TempDir::new().unwrap();
    let video_path = temp_dir.path().join("recording.mov");
    let manifest_path = temp_dir.path().join("recording.json");

    // Create original video
    let mut video_file = File::create(&video_path).unwrap();
    video_file.write_all(b"original content").unwrap();
    video_file.flush().unwrap();

    // Create and sign manifest
    let video_hash = HashInfo::from_file(&video_path).unwrap();
    let session_id = Uuid::new_v4();
    let metadata = manifest::Metadata {
        window: manifest::WindowInfo {
            title: "Test".to_string(),
            id: 789,
            app_name: "Test".to_string(),
            app_bundle_id: "com.test".to_string(),
        },
        video: manifest::VideoInfo {
            resolution: "1920x1080".to_string(),
            frame_rate: 30,
            codec: "h264".to_string(),
        },
        custom: None,
    };

    let system = manifest::SystemInfo {
        os: "macOS".to_string(),
        os_version: "14.0".to_string(),
        device_id: "test-device".to_string(),
        hostname: "test".to_string(),
        app_version: "0.1.0".to_string(),
        recorder: "ScreenCaptureKit".to_string(),
    };

    let now = Utc::now();
    let timestamps = manifest::Timestamps {
        started_at: now,
        stopped_at: now,
        manifest_created_at: now,
    };

    let mut manifest = EvidenceManifest::new(
        session_id,
        video_path.clone(),
        video_hash,
        16,
        10.0,
        metadata,
        system,
        timestamps,
    );

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
