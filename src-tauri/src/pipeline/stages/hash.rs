use crate::error::NotariResult;
use crate::evidence::HashInfo;
use crate::logger::{LogLevel, LOGGER};
use crate::pipeline::{PipelineContext, PipelineStage};
use std::time::Duration;

/// Stage that calculates SHA-256 hash of the video file
///
/// # Context Requirements
/// - Input: `video_path` (PathBuf) - Path to video file
///
/// # Context Outputs
/// - `plaintext_hash` (HashInfo serialized as JSON) - SHA-256 hash of video
///
/// # Example
/// ```
/// use notari::pipeline::{Pipeline, PipelineContext};
/// use notari::pipeline::stages::HashStage;
/// use std::path::PathBuf;
///
/// let pipeline = Pipeline::builder("hash-video")
///     .add_stage(HashStage::new())
///     .build();
///
/// let mut context = PipelineContext::new("session-123");
/// context.set_path("video_path", PathBuf::from("/tmp/video.mov"));
///
/// let result = pipeline.execute(&mut context)?;
/// ```
pub struct HashStage;

impl HashStage {
    /// Create a new hash stage
    pub fn new() -> Self {
        Self
    }
}

impl Default for HashStage {
    fn default() -> Self {
        Self::new()
    }
}

impl PipelineStage for HashStage {
    fn execute(&self, context: &mut PipelineContext) -> NotariResult<()> {
        let video_path = context.get_path("video_path")?;

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Calculating SHA-256 hash of video: {} (session: {})",
                video_path.display(),
                context.session_id()
            ),
            "pipeline::hash",
        );

        // Calculate hash
        let hash = HashInfo::from_file(&video_path)?;

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Video hash calculated: {} (session: {})",
                hash.value,
                context.session_id()
            ),
            "pipeline::hash",
        );

        // Store hash in context as JSON
        let hash_json = serde_json::to_value(&hash).map_err(|e| {
            crate::error::NotariError::PipelineError(format!("Failed to serialize hash: {}", e))
        })?;
        context.set("plaintext_hash", hash_json);

        Ok(())
    }

    fn name(&self) -> &str {
        "Calculate Hash"
    }

    fn estimated_duration(&self) -> Option<Duration> {
        // Hash calculation typically takes 1-3 seconds for a video file
        Some(Duration::from_secs(2))
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
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use std::path::PathBuf;
    use tempfile::TempDir;

    #[test]
    fn test_hash_stage_success() {
        // Create temp file
        let temp_dir = TempDir::new().unwrap();
        let video_path = temp_dir.path().join("test.mov");
        let mut file = File::create(&video_path).unwrap();
        file.write_all(b"test video content").unwrap();

        // Create context
        let mut context = PipelineContext::new("session-123");
        context.set_path("video_path", video_path);

        // Execute stage
        let stage = HashStage::new();
        let result = stage.execute(&mut context);

        assert!(result.is_ok());
        assert!(context.has("plaintext_hash"));

        // Verify hash can be deserialized
        let hash_json = context.get("plaintext_hash").unwrap();
        let hash: HashInfo = serde_json::from_value(hash_json.clone()).unwrap();
        assert_eq!(hash.algorithm, "SHA-256");
        assert!(!hash.value.is_empty());
    }

    #[test]
    fn test_hash_stage_missing_video_path() {
        let mut context = PipelineContext::new("session-123");

        let stage = HashStage::new();
        let result = stage.execute(&mut context);

        assert!(result.is_err());
    }

    #[test]
    fn test_hash_stage_nonexistent_file() {
        let mut context = PipelineContext::new("session-123");
        context.set_path("video_path", PathBuf::from("/nonexistent/video.mov"));

        let stage = HashStage::new();
        let result = stage.pre_execute(&context);

        assert!(result.is_err());
    }

    #[test]
    fn test_hash_stage_name() {
        let stage = HashStage::new();
        assert_eq!(stage.name(), "Calculate Hash");
    }

    #[test]
    fn test_hash_stage_estimated_duration() {
        let stage = HashStage::new();
        assert!(stage.estimated_duration().is_some());
        assert_eq!(stage.estimated_duration().unwrap(), Duration::from_secs(2));
    }
}
