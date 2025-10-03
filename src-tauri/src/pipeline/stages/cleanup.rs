use crate::error::NotariResult;
use crate::logger::{LogLevel, LOGGER};
use crate::pipeline::{PipelineContext, PipelineStage};
use std::time::Duration;

/// Stage that cleans up temporary files
///
/// This stage removes all files marked as temporary in the pipeline context.
/// It's typically the last stage in a pipeline.
///
/// # Context Requirements
/// - Uses temp_files from context
///
/// # Context Outputs
/// - Clears temp_files list after cleanup
///
pub struct CleanupStage;

impl CleanupStage {
    /// Create a new cleanup stage
    pub fn new() -> Self {
        Self
    }
}

impl Default for CleanupStage {
    fn default() -> Self {
        Self::new()
    }
}

impl PipelineStage for CleanupStage {
    fn execute(&self, context: &mut PipelineContext) -> NotariResult<()> {
        let temp_files = context.temp_files().to_vec();

        if temp_files.is_empty() {
            LOGGER.log(
                LogLevel::Info,
                &format!(
                    "No temporary files to clean up (session: {})",
                    context.session_id()
                ),
                "pipeline::cleanup",
            );
            return Ok(());
        }

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Cleaning up {} temporary file(s) (session: {})",
                temp_files.len(),
                context.session_id()
            ),
            "pipeline::cleanup",
        );

        let mut cleaned_count = 0;
        let mut failed_count = 0;

        for temp_file in &temp_files {
            if temp_file.exists() {
                match std::fs::remove_file(temp_file) {
                    Ok(_) => {
                        LOGGER.log(
                            LogLevel::Info,
                            &format!(
                                "Deleted temporary file: {} (session: {})",
                                temp_file.display(),
                                context.session_id()
                            ),
                            "pipeline::cleanup",
                        );
                        cleaned_count += 1;
                    }
                    Err(e) => {
                        LOGGER.log(
                            LogLevel::Warn,
                            &format!(
                                "Failed to delete temporary file {}: {} (session: {})",
                                temp_file.display(),
                                e,
                                context.session_id()
                            ),
                            "pipeline::cleanup",
                        );
                        failed_count += 1;
                    }
                }
            } else {
                LOGGER.log(
                    LogLevel::Debug,
                    &format!(
                        "Temporary file already deleted: {} (session: {})",
                        temp_file.display(),
                        context.session_id()
                    ),
                    "pipeline::cleanup",
                );
            }
        }

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Cleanup complete: {} deleted, {} failed (session: {})",
                cleaned_count,
                failed_count,
                context.session_id()
            ),
            "pipeline::cleanup",
        );

        // Clear temp files list
        context.clear_temp_files();

        Ok(())
    }

    fn name(&self) -> &str {
        "Cleanup Temporary Files"
    }

    fn estimated_duration(&self) -> Option<Duration> {
        // Cleanup is very fast
        Some(Duration::from_millis(100))
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
    fn test_cleanup_stage_success() {
        let temp_dir = TempDir::new().unwrap();

        // Create temp files
        let temp_file1 = temp_dir.path().join("temp1.tmp");
        let temp_file2 = temp_dir.path().join("temp2.tmp");
        File::create(&temp_file1)
            .unwrap()
            .write_all(b"temp1")
            .unwrap();
        File::create(&temp_file2)
            .unwrap()
            .write_all(b"temp2")
            .unwrap();

        // Create context with temp files
        let mut context = PipelineContext::new("session-123");
        context.add_temp_file(temp_file1.clone());
        context.add_temp_file(temp_file2.clone());

        assert_eq!(context.temp_files().len(), 2);
        assert!(temp_file1.exists());
        assert!(temp_file2.exists());

        // Execute cleanup
        let stage = CleanupStage::new();
        let result = stage.execute(&mut context);

        assert!(result.is_ok());
        assert_eq!(context.temp_files().len(), 0);
        assert!(!temp_file1.exists());
        assert!(!temp_file2.exists());
    }

    #[test]
    fn test_cleanup_stage_no_files() {
        let mut context = PipelineContext::new("session-123");

        let stage = CleanupStage::new();
        let result = stage.execute(&mut context);

        assert!(result.is_ok());
    }

    #[test]
    fn test_cleanup_stage_already_deleted() {
        let temp_dir = TempDir::new().unwrap();
        let temp_file = temp_dir.path().join("temp.tmp");

        // Add file to context but don't create it
        let mut context = PipelineContext::new("session-123");
        context.add_temp_file(temp_file.clone());

        let stage = CleanupStage::new();
        let result = stage.execute(&mut context);

        // Should succeed even if file doesn't exist
        assert!(result.is_ok());
        assert_eq!(context.temp_files().len(), 0);
    }

    #[test]
    fn test_cleanup_stage_partial_failure() {
        let temp_dir = TempDir::new().unwrap();

        // Create one file, leave another non-existent
        let temp_file1 = temp_dir.path().join("temp1.tmp");
        let temp_file2 = temp_dir.path().join("temp2.tmp");
        File::create(&temp_file1)
            .unwrap()
            .write_all(b"temp1")
            .unwrap();

        let mut context = PipelineContext::new("session-123");
        context.add_temp_file(temp_file1.clone());
        context.add_temp_file(temp_file2.clone());

        let stage = CleanupStage::new();
        let result = stage.execute(&mut context);

        // Should succeed even with partial failure
        assert!(result.is_ok());
        assert_eq!(context.temp_files().len(), 0);
        assert!(!temp_file1.exists());
    }

    #[test]
    fn test_cleanup_stage_name() {
        let stage = CleanupStage::new();
        assert_eq!(stage.name(), "Cleanup Temporary Files");
    }

    #[test]
    fn test_cleanup_stage_estimated_duration() {
        let stage = CleanupStage::new();
        assert!(stage.estimated_duration().is_some());
        assert_eq!(
            stage.estimated_duration().unwrap(),
            Duration::from_millis(100)
        );
    }
}
