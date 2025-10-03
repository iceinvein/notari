use crate::error::NotariResult;
use crate::evidence::proof_pack;
use crate::logger::{LogLevel, LOGGER};
use crate::pipeline::{PipelineContext, PipelineStage};
use std::time::Duration;

/// Stage that packages video and manifest into a .notari proof pack
///
/// # Context Requirements
/// - Input: `video_path` (PathBuf) - Path to video file (encrypted or plaintext)
/// - Input: `manifest_path` (PathBuf) - Path to manifest file
///
/// # Context Outputs
/// - `proof_pack_path` (PathBuf) - Path to created .notari proof pack
/// - Marks video and manifest as temp files for cleanup
///
pub struct PackageStage;

impl PackageStage {
    /// Create a new package stage
    pub fn new() -> Self {
        Self
    }
}

impl Default for PackageStage {
    fn default() -> Self {
        Self::new()
    }
}

impl PipelineStage for PackageStage {
    fn execute(&self, context: &mut PipelineContext) -> NotariResult<()> {
        let video_path = context.get_path("video_path")?;
        let manifest_path = context.get_path("manifest_path")?;

        // Generate proof pack path
        let proof_pack_path = video_path.with_extension("notari");

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Packaging recording into proof pack: {} (session: {})",
                proof_pack_path.display(),
                context.session_id()
            ),
            "pipeline::package",
        );

        // Create proof pack
        proof_pack::create_proof_pack(&video_path, &manifest_path, &proof_pack_path)?;

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Proof pack created successfully: {} (session: {})",
                proof_pack_path.display(),
                context.session_id()
            ),
            "pipeline::package",
        );

        // Store proof pack path
        context.set_path("proof_pack_path", proof_pack_path);

        // Mark video and manifest as temp files for cleanup
        context.add_temp_file(video_path);
        context.add_temp_file(manifest_path);

        Ok(())
    }

    fn name(&self) -> &str {
        "Package Proof Pack"
    }

    fn estimated_duration(&self) -> Option<Duration> {
        // Packaging typically takes 2-5 seconds depending on file size
        Some(Duration::from_secs(3))
    }

    fn pre_execute(&self, context: &PipelineContext) -> NotariResult<()> {
        // Validate required fields exist
        if !context.has("video_path") {
            return Err(crate::error::NotariError::PipelineError(
                "video_path is required".to_string(),
            ));
        }
        if !context.has("manifest_path") {
            return Err(crate::error::NotariError::PipelineError(
                "manifest_path is required".to_string(),
            ));
        }

        // Validate files exist
        let video_path = context.get_path("video_path")?;
        if !video_path.exists() {
            return Err(crate::error::NotariError::PipelineError(format!(
                "Video file does not exist: {}",
                video_path.display()
            )));
        }

        let manifest_path = context.get_path("manifest_path")?;
        if !manifest_path.exists() {
            return Err(crate::error::NotariError::PipelineError(format!(
                "Manifest file does not exist: {}",
                manifest_path.display()
            )));
        }

        Ok(())
    }

    fn post_execute(&self, context: &PipelineContext) -> NotariResult<()> {
        // Verify proof pack was created
        let proof_pack_path = context.get_path("proof_pack_path")?;
        if !proof_pack_path.exists() {
            return Err(crate::error::NotariError::PipelineError(format!(
                "Proof pack was not created: {}",
                proof_pack_path.display()
            )));
        }

        // Verify proof pack has content
        let metadata = std::fs::metadata(&proof_pack_path).map_err(|e| {
            crate::error::NotariError::PipelineError(format!(
                "Failed to read proof pack metadata: {}",
                e
            ))
        })?;

        if metadata.len() == 0 {
            return Err(crate::error::NotariError::PipelineError(
                "Proof pack is empty".to_string(),
            ));
        }

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Proof pack verified: {} ({} bytes) (session: {})",
                proof_pack_path.display(),
                metadata.len(),
                context.session_id()
            ),
            "pipeline::package",
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::evidence::{EvidenceManifestBuilder, HashInfo, KeyManager, SystemInfo};
    use chrono::Utc;
    use std::fs::File;
    use std::io::Write;
    use std::path::PathBuf;
    use tempfile::TempDir;
    use uuid::Uuid;

    #[test]
    fn test_package_stage_success() {
        // Clean up any existing key from previous test runs
        let _ = crate::evidence::keychain::delete_signing_key();

        let temp_dir = TempDir::new().unwrap();

        // Create test video file
        let video_path = temp_dir.path().join("test.mov");
        let mut video_file = File::create(&video_path).unwrap();
        video_file.write_all(b"test video content").unwrap();

        // Create test manifest
        let now = Utc::now();
        let system_info = SystemInfo {
            os: "macOS".to_string(),
            os_version: "14.0".to_string(),
            device_id: "test-device".to_string(),
            hostname: "test-machine".to_string(),
            app_version: "0.1.0".to_string(),
            recorder: "notari".to_string(),
        };

        let mut manifest = EvidenceManifestBuilder::new()
            .session_id(Uuid::new_v4())
            .file_path(video_path.clone())
            .file_hash(HashInfo::from_bytes(b"test data"))
            .file_size(1024)
            .duration(60.0)
            .window_title("Test Window")
            .window_id(123)
            .app_name("Test App")
            .app_bundle_id("com.test.app")
            .resolution("1920x1080")
            .frame_rate(30)
            .codec("h264")
            .system_info(system_info)
            .timestamps_from_dates(now, now)
            .build()
            .unwrap();

        // Sign and save manifest
        let key_manager = KeyManager::generate();
        manifest.sign(&key_manager);
        let manifest_path = temp_dir.path().join("test.json");
        manifest.save(&manifest_path).unwrap();

        // Store key in keychain for proof pack creation
        crate::evidence::keychain::store_signing_key(&key_manager.to_bytes()).unwrap();

        // Create context
        let mut context = PipelineContext::new("session-123");
        context.set_path("video_path", video_path.clone());
        context.set_path("manifest_path", manifest_path.clone());

        // Execute stage
        let stage = PackageStage::new();
        let result = stage.execute(&mut context);

        assert!(result.is_ok());
        assert!(context.has("proof_pack_path"));

        // Verify proof pack was created
        let proof_pack_path = context.get_path("proof_pack_path").unwrap();
        assert!(proof_pack_path.exists());
        assert_eq!(proof_pack_path.extension().unwrap(), "notari");

        // Verify temp files were marked
        assert!(context.temp_files().contains(&video_path));
        assert!(context.temp_files().contains(&manifest_path));

        // Clean up
        let _ = crate::evidence::keychain::delete_signing_key();
    }

    #[test]
    fn test_package_stage_missing_video() {
        let mut context = PipelineContext::new("session-123");
        context.set_path("video_path", PathBuf::from("/nonexistent/video.mov"));
        context.set_path("manifest_path", PathBuf::from("/tmp/manifest.json"));

        let stage = PackageStage::new();
        let result = stage.pre_execute(&context);

        assert!(result.is_err());
    }

    #[test]
    fn test_package_stage_name() {
        let stage = PackageStage::new();
        assert_eq!(stage.name(), "Package Proof Pack");
    }

    #[test]
    fn test_package_stage_estimated_duration() {
        let stage = PackageStage::new();
        assert!(stage.estimated_duration().is_some());
        assert_eq!(stage.estimated_duration().unwrap(), Duration::from_secs(3));
    }
}
