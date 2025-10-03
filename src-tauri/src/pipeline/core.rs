use crate::error::NotariResult;
use std::time::Duration;

use super::context::PipelineContext;

/// A single stage in a pipeline
///
/// Each stage performs a specific transformation or operation on the pipeline context.
/// Stages are executed sequentially by the pipeline executor.
///
/// # Example
/// ```
/// use notari::pipeline::{PipelineStage, PipelineContext};
///
/// struct MyStage;
///
/// impl PipelineStage for MyStage {
///     fn execute(&self, context: &mut PipelineContext) -> NotariResult<()> {
///         // Perform transformation
///         let input = context.get_string("input")?;
///         let output = input.to_uppercase();
///         context.set_string("output", output);
///         Ok(())
///     }
///
///     fn name(&self) -> &str {
///         "My Stage"
///     }
/// }
/// ```
pub trait PipelineStage: Send + Sync {
    /// Execute this stage
    ///
    /// The stage can read from and write to the pipeline context.
    /// If the stage fails, it should return an error which will stop the pipeline.
    fn execute(&self, context: &mut PipelineContext) -> NotariResult<()>;

    /// Get stage name for logging and progress tracking
    fn name(&self) -> &str;

    /// Get estimated duration for progress tracking
    ///
    /// Returns `None` if duration cannot be estimated.
    fn estimated_duration(&self) -> Option<Duration> {
        None
    }

    /// Check if this stage should be skipped based on context
    ///
    /// Useful for optional stages (e.g., encryption only if password provided)
    fn should_skip(&self, _context: &PipelineContext) -> bool {
        false
    }

    /// Called before execute() - useful for validation
    fn pre_execute(&self, _context: &PipelineContext) -> NotariResult<()> {
        Ok(())
    }

    /// Called after execute() - useful for cleanup
    fn post_execute(&self, _context: &PipelineContext) -> NotariResult<()> {
        Ok(())
    }
}

/// Result of a pipeline stage execution
#[derive(Debug, Clone)]
pub struct StageResult {
    /// Stage name
    pub stage_name: String,

    /// Whether the stage succeeded
    pub success: bool,

    /// Error message if failed
    pub error: Option<String>,

    /// Duration of execution
    pub duration: Duration,

    /// Whether the stage was skipped
    pub skipped: bool,
}

impl StageResult {
    /// Create a successful stage result
    pub fn success(stage_name: impl Into<String>, duration: Duration) -> Self {
        Self {
            stage_name: stage_name.into(),
            success: true,
            error: None,
            duration,
            skipped: false,
        }
    }

    /// Create a failed stage result
    pub fn failure(
        stage_name: impl Into<String>,
        error: impl Into<String>,
        duration: Duration,
    ) -> Self {
        Self {
            stage_name: stage_name.into(),
            success: false,
            error: Some(error.into()),
            duration,
            skipped: false,
        }
    }

    /// Create a skipped stage result
    pub fn skipped(stage_name: impl Into<String>) -> Self {
        Self {
            stage_name: stage_name.into(),
            success: true,
            error: None,
            duration: Duration::from_secs(0),
            skipped: true,
        }
    }
}

/// Result of a complete pipeline execution
#[derive(Debug, Clone)]
pub struct PipelineResult {
    /// Pipeline name
    pub pipeline_name: String,

    /// Whether the pipeline succeeded
    pub success: bool,

    /// Results from each stage
    pub stage_results: Vec<StageResult>,

    /// Total duration
    pub total_duration: Duration,

    /// Error message if failed
    pub error: Option<String>,
}

impl PipelineResult {
    /// Create a successful pipeline result
    pub fn success(
        pipeline_name: impl Into<String>,
        stage_results: Vec<StageResult>,
        total_duration: Duration,
    ) -> Self {
        Self {
            pipeline_name: pipeline_name.into(),
            success: true,
            stage_results,
            total_duration,
            error: None,
        }
    }

    /// Create a failed pipeline result
    pub fn failure(
        pipeline_name: impl Into<String>,
        stage_results: Vec<StageResult>,
        error: impl Into<String>,
        total_duration: Duration,
    ) -> Self {
        Self {
            pipeline_name: pipeline_name.into(),
            success: false,
            stage_results,
            total_duration,
            error: Some(error.into()),
        }
    }

    /// Get the number of stages that were executed (not skipped)
    pub fn executed_stages(&self) -> usize {
        self.stage_results.iter().filter(|r| !r.skipped).count()
    }

    /// Get the number of stages that were skipped
    pub fn skipped_stages(&self) -> usize {
        self.stage_results.iter().filter(|r| r.skipped).count()
    }

    /// Get the stage that failed (if any)
    pub fn failed_stage(&self) -> Option<&StageResult> {
        self.stage_results.iter().find(|r| !r.success)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stage_result_success() {
        let result = StageResult::success("Test Stage", Duration::from_secs(1));
        assert!(result.success);
        assert!(result.error.is_none());
        assert!(!result.skipped);
        assert_eq!(result.stage_name, "Test Stage");
    }

    #[test]
    fn test_stage_result_failure() {
        let result =
            StageResult::failure("Test Stage", "Something went wrong", Duration::from_secs(1));
        assert!(!result.success);
        assert_eq!(result.error, Some("Something went wrong".to_string()));
        assert!(!result.skipped);
    }

    #[test]
    fn test_stage_result_skipped() {
        let result = StageResult::skipped("Test Stage");
        assert!(result.success);
        assert!(result.error.is_none());
        assert!(result.skipped);
        assert_eq!(result.duration, Duration::from_secs(0));
    }

    #[test]
    fn test_pipeline_result_success() {
        let stage_results = vec![
            StageResult::success("Stage 1", Duration::from_secs(1)),
            StageResult::success("Stage 2", Duration::from_secs(2)),
        ];
        let result =
            PipelineResult::success("Test Pipeline", stage_results, Duration::from_secs(3));

        assert!(result.success);
        assert!(result.error.is_none());
        assert_eq!(result.executed_stages(), 2);
        assert_eq!(result.skipped_stages(), 0);
        assert!(result.failed_stage().is_none());
    }

    #[test]
    fn test_pipeline_result_with_skipped() {
        let stage_results = vec![
            StageResult::success("Stage 1", Duration::from_secs(1)),
            StageResult::skipped("Stage 2"),
            StageResult::success("Stage 3", Duration::from_secs(2)),
        ];
        let result =
            PipelineResult::success("Test Pipeline", stage_results, Duration::from_secs(3));

        assert_eq!(result.executed_stages(), 2);
        assert_eq!(result.skipped_stages(), 1);
    }

    #[test]
    fn test_pipeline_result_failure() {
        let stage_results = vec![
            StageResult::success("Stage 1", Duration::from_secs(1)),
            StageResult::failure("Stage 2", "Failed", Duration::from_secs(1)),
        ];
        let result = PipelineResult::failure(
            "Test Pipeline",
            stage_results,
            "Pipeline failed at Stage 2",
            Duration::from_secs(2),
        );

        assert!(!result.success);
        assert!(result.error.is_some());
        assert!(result.failed_stage().is_some());
        assert_eq!(result.failed_stage().unwrap().stage_name, "Stage 2");
    }
}
