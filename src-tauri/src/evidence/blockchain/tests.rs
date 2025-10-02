/// Integration tests for blockchain anchoring
#[cfg(test)]
mod integration_tests {
    use crate::evidence::{
        blockchain::{BlockchainAnchorer, MockAnchorer},
        EvidenceManifest, HashInfo, KeyManager, Metadata, SystemInfo, Timestamps, VideoInfo,
        WindowInfo,
    };
    use chrono::Utc;
    use std::io::Write;
    use std::path::PathBuf;
    use uuid::Uuid;

    #[tokio::test]
    async fn test_full_workflow_with_blockchain_anchor() {
        // 1. Create a test video file
        let mut temp_video = tempfile::NamedTempFile::new().unwrap();
        temp_video.write_all(b"test video content").unwrap();
        let video_path = temp_video.path().to_path_buf();

        // 2. Calculate hash
        let video_hash = HashInfo::from_file(&video_path).unwrap();

        // 3. Create manifest
        let session_id = Uuid::new_v4();
        let metadata = Metadata {
            window: WindowInfo {
                id: 1,
                title: "Test Window".to_string(),
                app_name: "Test App".to_string(),
                app_bundle_id: "com.test.app".to_string(),
            },
            video: VideoInfo {
                codec: "h264".to_string(),
                resolution: "1920x1080".to_string(),
                frame_rate: 30,
            },
            custom: None,
        };

        let system = SystemInfo {
            os: "macOS".to_string(),
            os_version: "14.0".to_string(),
            device_id: Uuid::new_v4().to_string(),
            hostname: "test-host".to_string(),
            app_version: "0.1.0".to_string(),
            recorder: "sck-recorder".to_string(),
        };

        let timestamps = Timestamps {
            started_at: Utc::now(),
            stopped_at: Utc::now(),
            manifest_created_at: Utc::now(),
        };

        let mut manifest = EvidenceManifest::new(
            session_id,
            video_path.clone(),
            video_hash.clone(),
            18, // file size
            1.5,
            metadata,
            system,
            timestamps,
        );

        // 4. Anchor to blockchain (mock) - do this BEFORE signing
        let anchorer = MockAnchorer::instant();
        let manifest_hash = HashInfo::from_bytes(&manifest.signable_data());
        let proof = anchorer.anchor(&manifest_hash.value).await.unwrap();

        // 5. Add blockchain anchor to manifest
        manifest.blockchain_anchor = Some(crate::evidence::blockchain::BlockchainAnchor {
            anchored_at: Utc::now(),
            anchored_hash: manifest_hash.value.clone(),
            manifest_hash: manifest_hash.value.clone(),
            proof: proof.clone(),
        });

        // 6. Sign manifest (after adding blockchain anchor)
        let key_manager = KeyManager::generate();
        manifest.sign(&key_manager);

        // 7. Save manifest
        let manifest_file = tempfile::NamedTempFile::new().unwrap();
        manifest.save(manifest_file.path()).unwrap();

        // 8. Load and verify
        let loaded_manifest = EvidenceManifest::load(manifest_file.path()).unwrap();

        // Verify signature
        assert!(loaded_manifest.verify_signature().unwrap());

        // Verify blockchain anchor exists
        assert!(loaded_manifest.blockchain_anchor.is_some());
        let anchor = loaded_manifest.blockchain_anchor.as_ref().unwrap();
        assert_eq!(anchor.manifest_hash, manifest_hash.value);

        // Verify blockchain proof
        let verified = anchorer
            .verify(&anchor.anchored_hash, &anchor.proof)
            .await
            .unwrap();
        assert!(verified);
    }

    #[tokio::test]
    async fn test_manifest_without_blockchain_anchor() {
        // Create manifest without blockchain anchor
        let mut temp_video = tempfile::NamedTempFile::new().unwrap();
        temp_video.write_all(b"test video").unwrap();

        let video_hash = HashInfo::from_file(temp_video.path()).unwrap();
        let session_id = Uuid::new_v4();

        let metadata = Metadata {
            window: WindowInfo {
                id: 1,
                title: "Test".to_string(),
                app_name: "Test".to_string(),
                app_bundle_id: "com.test.app".to_string(),
            },
            video: VideoInfo {
                codec: "h264".to_string(),
                resolution: "1920x1080".to_string(),
                frame_rate: 30,
            },
            custom: None,
        };

        let system = SystemInfo {
            os: "macOS".to_string(),
            os_version: "14.0".to_string(),
            device_id: Uuid::new_v4().to_string(),
            hostname: "test-host".to_string(),
            app_version: "0.1.0".to_string(),
            recorder: "sck-recorder".to_string(),
        };

        let timestamps = Timestamps {
            started_at: Utc::now(),
            stopped_at: Utc::now(),
            manifest_created_at: Utc::now(),
        };

        let mut manifest = EvidenceManifest::new(
            session_id,
            PathBuf::from("test.mov"),
            video_hash,
            10,
            1.0,
            metadata,
            system,
            timestamps,
        );

        let key_manager = KeyManager::generate();
        manifest.sign(&key_manager);

        // Save and load
        let manifest_file = tempfile::NamedTempFile::new().unwrap();
        manifest.save(manifest_file.path()).unwrap();
        let loaded = EvidenceManifest::load(manifest_file.path()).unwrap();

        // Should work fine without blockchain anchor
        assert!(loaded.blockchain_anchor.is_none());
        assert!(loaded.verify_signature().unwrap());
    }

    #[tokio::test]
    async fn test_verification_report_with_blockchain_anchor() {
        use crate::evidence::Verifier;

        // Create test video
        let mut temp_video = tempfile::NamedTempFile::new().unwrap();
        temp_video.write_all(b"test video content").unwrap();
        let video_path = temp_video.path();

        // Create manifest with blockchain anchor
        let video_hash = HashInfo::from_file(video_path).unwrap();
        let session_id = Uuid::new_v4();

        let metadata = Metadata {
            window: WindowInfo {
                id: 1,
                title: "Test".to_string(),
                app_name: "Test".to_string(),
                app_bundle_id: "com.test.app".to_string(),
            },
            video: VideoInfo {
                codec: "h264".to_string(),
                resolution: "1920x1080".to_string(),
                frame_rate: 30,
            },
            custom: None,
        };

        let system = SystemInfo {
            os: "macOS".to_string(),
            os_version: "14.0".to_string(),
            device_id: Uuid::new_v4().to_string(),
            hostname: "test-host".to_string(),
            app_version: "0.1.0".to_string(),
            recorder: "sck-recorder".to_string(),
        };

        let timestamps = Timestamps {
            started_at: Utc::now(),
            stopped_at: Utc::now(),
            manifest_created_at: Utc::now(),
        };

        let mut manifest = EvidenceManifest::new(
            session_id,
            video_path.to_path_buf(),
            video_hash.clone(),
            18,
            1.0,
            metadata,
            system,
            timestamps,
        );

        let key_manager = KeyManager::generate();
        manifest.sign(&key_manager);

        // Add blockchain anchor
        let anchorer = MockAnchorer::instant();
        let manifest_hash = HashInfo::from_bytes(&manifest.signable_data());
        let proof = anchorer.anchor(&manifest_hash.value).await.unwrap();

        manifest.blockchain_anchor = Some(crate::evidence::blockchain::BlockchainAnchor {
            anchored_at: Utc::now(),
            anchored_hash: manifest_hash.value.clone(),
            manifest_hash: manifest_hash.value.clone(),
            proof,
        });

        // Save manifest
        let manifest_file = tempfile::NamedTempFile::new().unwrap();
        manifest.save(manifest_file.path()).unwrap();

        // Verify
        let report = Verifier::verify(manifest_file.path(), video_path).unwrap();

        // Check blockchain anchor in report
        assert!(report.verification.checks.blockchain_anchor.is_some());
        let anchor_check = report.verification.checks.blockchain_anchor.unwrap();
        assert!(anchor_check.present);
        assert_eq!(anchor_check.algorithm, "Mock (Development)");
    }
}
