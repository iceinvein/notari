use crate::error::NotariResult;
use crate::evidence::VideoEncryptor;
use crate::logger::{LogLevel, LOGGER};
use crate::pipeline::{PipelineContext, PipelineStage};
use std::time::Duration;

/// Stage that encrypts the video file with AES-256-GCM
///
/// This stage is optional and will be skipped if no password is provided.
///
/// # Context Requirements
/// - Input: `video_path` (PathBuf) - Path to video file
/// - Input: `password` (String, optional) - Encryption password
///
/// # Context Outputs
/// - `encrypted_path` (PathBuf) - Path to encrypted video file
/// - `encryption_info` (EncryptionInfo serialized as JSON) - Encryption metadata
/// - Updates `video_path` to point to encrypted file
///
/// # Example
/// ```
/// use notari::pipeline::{Pipeline, PipelineContext};
/// use notari::pipeline::stages::EncryptStage;
/// use std::path::PathBuf;
///
/// let pipeline = Pipeline::builder("encrypt-video")
///     .add_stage(EncryptStage::new())
///     .build();
///
/// let mut context = PipelineContext::new("session-123");
/// context.set_path("video_path", PathBuf::from("/tmp/video.mov"));
/// context.set_string("password", "SecurePass123");
///
/// let result = pipeline.execute(&mut context)?;
/// ```
pub struct EncryptStage;

impl EncryptStage {
    /// Create a new encrypt stage
    pub fn new() -> Self {
        Self
    }
}

impl Default for EncryptStage {
    fn default() -> Self {
        Self::new()
    }
}

impl PipelineStage for EncryptStage {
    fn execute(&self, context: &mut PipelineContext) -> NotariResult<()> {
        let video_path = context.get_path("video_path")?;
        let password = context.get_string("password")?;

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Encrypting video: {} (session: {})",
                video_path.display(),
                context.session_id()
            ),
            "pipeline::encrypt",
        );

        // Generate encrypted file path
        let encrypted_path = video_path.with_extension("mov.enc");

        // Encrypt the video file with chunked encryption (for streaming)
        let encryption_info =
            VideoEncryptor::encrypt_file_chunked(&video_path, &encrypted_path, &password)?;

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Video encrypted successfully: {} (session: {})",
                encrypted_path.display(),
                context.session_id()
            ),
            "pipeline::encrypt",
        );

        // Calculate hash of encrypted file
        let encrypted_hash = crate::evidence::HashInfo::from_file(&encrypted_path)?;

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Encrypted video hash calculated: {} (session: {})",
                encrypted_hash.value,
                context.session_id()
            ),
            "pipeline::encrypt",
        );

        // Store encryption info in context as JSON
        let encryption_json = serde_json::to_value(&encryption_info).map_err(|e| {
            crate::error::NotariError::PipelineError(format!(
                "Failed to serialize encryption info: {}",
                e
            ))
        })?;
        context.set("encryption_info", encryption_json);

        // Store encrypted hash in context as JSON
        let encrypted_hash_json = serde_json::to_value(&encrypted_hash).map_err(|e| {
            crate::error::NotariError::PipelineError(format!(
                "Failed to serialize encrypted hash: {}",
                e
            ))
        })?;
        context.set("encrypted_hash", encrypted_hash_json);

        // Store encrypted path
        context.set_path("encrypted_path", encrypted_path.clone());

        // Mark the original video as a temp file for cleanup
        context.add_temp_file(video_path.clone());

        // Update video_path to point to encrypted file
        context.set_path("video_path", encrypted_path);

        Ok(())
    }

    fn name(&self) -> &str {
        "Encrypt Video"
    }

    fn estimated_duration(&self) -> Option<Duration> {
        // Encryption typically takes 3-10 seconds depending on file size
        Some(Duration::from_secs(5))
    }

    fn should_skip(&self, context: &PipelineContext) -> bool {
        // Skip if no password provided
        !context.has("password")
    }

    fn pre_execute(&self, context: &PipelineContext) -> NotariResult<()> {
        // Validate that video_path exists
        let video_path = context.get_path("video_path")?;
        if !video_path.exists() {
            return Err(crate::error::NotariError::PipelineError(format!(
                "Video file does not exist: {}",
                video_path.display()
            )));
        }

        // Validate password is not empty
        let password = context.get_string("password")?;
        if password.trim().is_empty() {
            return Err(crate::error::NotariError::PipelineError(
                "Password cannot be empty".to_string(),
            ));
        }

        Ok(())
    }

    fn post_execute(&self, context: &PipelineContext) -> NotariResult<()> {
        // Verify encrypted file was created
        let encrypted_path = context.get_path("encrypted_path")?;
        if !encrypted_path.exists() {
            return Err(crate::error::NotariError::PipelineError(format!(
                "Encrypted file was not created: {}",
                encrypted_path.display()
            )));
        }

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Encryption verified, encrypted file exists: {} (session: {})",
                encrypted_path.display(),
                context.session_id()
            ),
            "pipeline::encrypt",
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::TempDir;

    #[test]
    fn test_encrypt_stage_skipped_without_password() {
        let temp_dir = TempDir::new().unwrap();
        let video_path = temp_dir.path().join("test.mov");
        let mut file = File::create(&video_path).unwrap();
        file.write_all(b"test video content").unwrap();

        let mut context = PipelineContext::new("session-123");
        context.set_path("video_path", video_path);

        let stage = EncryptStage::new();
        assert!(stage.should_skip(&context));
    }

    #[test]
    fn test_encrypt_stage_not_skipped_with_password() {
        let temp_dir = TempDir::new().unwrap();
        let video_path = temp_dir.path().join("test.mov");
        let mut file = File::create(&video_path).unwrap();
        file.write_all(b"test video content").unwrap();

        let mut context = PipelineContext::new("session-123");
        context.set_path("video_path", video_path);
        context.set_string("password", "SecurePass123");

        let stage = EncryptStage::new();
        assert!(!stage.should_skip(&context));
    }

    #[test]
    fn test_encrypt_stage_success() {
        let temp_dir = TempDir::new().unwrap();
        let video_path = temp_dir.path().join("test.mov");
        let mut file = File::create(&video_path).unwrap();
        file.write_all(b"test video content for encryption")
            .unwrap();

        let mut context = PipelineContext::new("session-123");
        context.set_path("video_path", video_path.clone());
        context.set_string("password", "SecurePass123");

        let stage = EncryptStage::new();
        let result = stage.execute(&mut context);

        assert!(result.is_ok());
        assert!(context.has("encryption_info"));
        assert!(context.has("encrypted_path"));
        assert!(
            context.has("encrypted_hash"),
            "encrypted_hash should be present in context"
        );

        // Verify encrypted file was created
        let encrypted_path = context.get_path("encrypted_path").unwrap();
        assert!(encrypted_path.exists());
        assert_eq!(encrypted_path.extension().unwrap(), "enc");

        // Verify encrypted_hash is valid
        let encrypted_hash_json = context.get_required("encrypted_hash").unwrap();
        let encrypted_hash: crate::evidence::HashInfo =
            serde_json::from_value(encrypted_hash_json.clone()).unwrap();
        assert_eq!(encrypted_hash.algorithm, "SHA-256");
        assert!(!encrypted_hash.value.is_empty());
        assert_eq!(encrypted_hash.value.len(), 64); // SHA-256 hex is 64 chars

        // Verify original file is marked for cleanup
        assert!(context.temp_files().contains(&video_path));

        // Verify video_path was updated
        let updated_video_path = context.get_path("video_path").unwrap();
        assert_eq!(updated_video_path, encrypted_path);
    }

    #[test]
    fn test_encrypt_stage_empty_password() {
        let temp_dir = TempDir::new().unwrap();
        let video_path = temp_dir.path().join("test.mov");
        let mut file = File::create(&video_path).unwrap();
        file.write_all(b"test video content").unwrap();

        let mut context = PipelineContext::new("session-123");
        context.set_path("video_path", video_path);
        context.set_string("password", "   ");

        let stage = EncryptStage::new();
        let result = stage.pre_execute(&context);

        assert!(result.is_err());
    }

    #[test]
    fn test_encrypt_stage_name() {
        let stage = EncryptStage::new();
        assert_eq!(stage.name(), "Encrypt Video");
    }

    #[test]
    fn test_encrypt_stage_estimated_duration() {
        let stage = EncryptStage::new();
        assert!(stage.estimated_duration().is_some());
        assert_eq!(stage.estimated_duration().unwrap(), Duration::from_secs(5));
    }
}
