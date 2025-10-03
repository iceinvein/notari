use super::context::PipelineContext;
use super::core::{PipelineResult, PipelineStage, StageResult};
use crate::error::NotariResult;
use crate::events::EventEmitter;
use crate::logger::{LogLevel, LOGGER};
use std::time::Instant;
use tauri::AppHandle;

/// Pipeline executor that runs stages sequentially
///
/// # Example
/// ```
/// use notari::pipeline::{Pipeline, PipelineContext};
///
/// let pipeline = Pipeline::builder("my-pipeline")
///     .add_stage(Stage1::new())
///     .add_stage(Stage2::new())
///     .build();
///
/// let mut context = PipelineContext::new("session-123");
/// let result = pipeline.execute(&mut context)?;
/// ```
pub struct Pipeline {
    name: String,
    stages: Vec<Box<dyn PipelineStage>>,
}

impl Pipeline {
    /// Create a new pipeline builder
    pub fn builder(name: impl Into<String>) -> PipelineBuilder {
        PipelineBuilder::new(name)
    }

    /// Get the pipeline name
    pub fn name(&self) -> &str {
        &self.name
    }

    /// Get the number of stages
    pub fn stage_count(&self) -> usize {
        self.stages.len()
    }

    /// Execute the pipeline without emitting events
    ///
    /// Stages are executed sequentially. If a stage fails, the pipeline stops
    /// and returns an error. Stages can be skipped based on their `should_skip()` method.
    pub fn execute(&self, context: &mut PipelineContext) -> NotariResult<PipelineResult> {
        self.execute_internal(context, None)
    }

    /// Execute the pipeline with event emission
    ///
    /// Same as `execute()` but emits progress events to the frontend.
    pub fn execute_with_events(
        &self,
        context: &mut PipelineContext,
        app: &AppHandle,
    ) -> NotariResult<PipelineResult> {
        self.execute_internal(context, Some(app))
    }

    /// Internal execution method that optionally emits events
    fn execute_internal(
        &self,
        context: &mut PipelineContext,
        app: Option<&AppHandle>,
    ) -> NotariResult<PipelineResult> {
        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Starting pipeline '{}' with {} stages (session: {})",
                self.name,
                self.stages.len(),
                context.session_id()
            ),
            "pipeline",
        );

        // Emit pipeline started event
        if let Some(app) = app {
            if let Ok(session_id) = uuid::Uuid::parse_str(context.session_id()) {
                let _ =
                    EventEmitter::pipeline_started(app, session_id, &self.name, self.stages.len());
            }
        }

        let pipeline_start = Instant::now();
        let mut stage_results = Vec::new();

        // Store pipeline name in context metadata
        context.set_metadata("pipeline_name", &self.name);

        for (index, stage) in self.stages.iter().enumerate() {
            let stage_name = stage.name();

            // Check if stage should be skipped
            if stage.should_skip(context) {
                LOGGER.log(
                    LogLevel::Info,
                    &format!(
                        "Skipping stage {}/{}: {} (session: {})",
                        index + 1,
                        self.stages.len(),
                        stage_name,
                        context.session_id()
                    ),
                    "pipeline",
                );

                // Emit stage skipped event
                if let Some(app) = app {
                    if let Ok(session_id) = uuid::Uuid::parse_str(context.session_id()) {
                        let _ = EventEmitter::pipeline_stage_skipped(
                            app,
                            session_id,
                            &self.name,
                            stage_name,
                            index,
                            self.stages.len(),
                        );
                    }
                }

                stage_results.push(StageResult::skipped(stage_name));
                continue;
            }

            LOGGER.log(
                LogLevel::Info,
                &format!(
                    "Executing stage {}/{}: {} (session: {})",
                    index + 1,
                    self.stages.len(),
                    stage_name,
                    context.session_id()
                ),
                "pipeline",
            );

            // Emit stage started event
            if let Some(app) = app {
                if let Ok(session_id) = uuid::Uuid::parse_str(context.session_id()) {
                    let _ = EventEmitter::pipeline_stage_started(
                        app,
                        session_id,
                        &self.name,
                        stage_name,
                        index,
                        self.stages.len(),
                    );
                }
            }

            let stage_start = Instant::now();

            // Pre-execute hook
            if let Err(e) = stage.pre_execute(context) {
                let duration = stage_start.elapsed();
                let error_msg = format!("Pre-execute failed: {}", e);
                LOGGER.log(
                    LogLevel::Error,
                    &format!(
                        "Stage '{}' pre-execute failed: {} (session: {})",
                        stage_name,
                        e,
                        context.session_id()
                    ),
                    "pipeline",
                );

                // Emit pipeline failed event
                if let Some(app) = app {
                    if let Ok(session_id) = uuid::Uuid::parse_str(context.session_id()) {
                        let _ = EventEmitter::pipeline_failed(
                            app, session_id, &self.name, stage_name, &error_msg,
                        );
                    }
                }

                stage_results.push(StageResult::failure(
                    stage_name,
                    error_msg.clone(),
                    duration,
                ));
                return Ok(PipelineResult::failure(
                    &self.name,
                    stage_results,
                    error_msg,
                    pipeline_start.elapsed(),
                ));
            }

            // Execute stage
            let execute_result = stage.execute(context);
            let duration = stage_start.elapsed();

            match execute_result {
                Ok(_) => {
                    LOGGER.log(
                        LogLevel::Info,
                        &format!(
                            "Stage '{}' completed successfully in {:.2}s (session: {})",
                            stage_name,
                            duration.as_secs_f64(),
                            context.session_id()
                        ),
                        "pipeline",
                    );

                    // Emit stage completed event
                    if let Some(app) = app {
                        if let Ok(session_id) = uuid::Uuid::parse_str(context.session_id()) {
                            let _ = EventEmitter::pipeline_stage_completed(
                                app,
                                session_id,
                                &self.name,
                                stage_name,
                                index,
                                self.stages.len(),
                                duration.as_millis() as u64,
                            );
                        }
                    }

                    // Post-execute hook
                    if let Err(e) = stage.post_execute(context) {
                        let error_msg = format!("Post-execute failed: {}", e);
                        LOGGER.log(
                            LogLevel::Error,
                            &format!(
                                "Stage '{}' post-execute failed: {} (session: {})",
                                stage_name,
                                e,
                                context.session_id()
                            ),
                            "pipeline",
                        );

                        // Emit pipeline failed event
                        if let Some(app) = app {
                            if let Ok(session_id) = uuid::Uuid::parse_str(context.session_id()) {
                                let _ = EventEmitter::pipeline_failed(
                                    app, session_id, &self.name, stage_name, &error_msg,
                                );
                            }
                        }

                        stage_results.push(StageResult::failure(
                            stage_name,
                            error_msg.clone(),
                            duration,
                        ));
                        return Ok(PipelineResult::failure(
                            &self.name,
                            stage_results,
                            error_msg,
                            pipeline_start.elapsed(),
                        ));
                    }

                    stage_results.push(StageResult::success(stage_name, duration));
                }
                Err(e) => {
                    let error_msg = e.to_string();
                    LOGGER.log(
                        LogLevel::Error,
                        &format!(
                            "Stage '{}' failed: {} (session: {})",
                            stage_name,
                            error_msg,
                            context.session_id()
                        ),
                        "pipeline",
                    );

                    // Emit pipeline failed event
                    if let Some(app) = app {
                        if let Ok(session_id) = uuid::Uuid::parse_str(context.session_id()) {
                            let _ = EventEmitter::pipeline_failed(
                                app, session_id, &self.name, stage_name, &error_msg,
                            );
                        }
                    }

                    stage_results.push(StageResult::failure(
                        stage_name,
                        error_msg.clone(),
                        duration,
                    ));
                    return Ok(PipelineResult::failure(
                        &self.name,
                        stage_results,
                        error_msg,
                        pipeline_start.elapsed(),
                    ));
                }
            }
        }

        let total_duration = pipeline_start.elapsed();
        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Pipeline '{}' completed successfully in {:.2}s (session: {})",
                self.name,
                total_duration.as_secs_f64(),
                context.session_id()
            ),
            "pipeline",
        );

        // Count completed and skipped stages
        let stages_completed = stage_results
            .iter()
            .filter(|r| r.success && !r.skipped)
            .count();
        let stages_skipped = stage_results.iter().filter(|r| r.skipped).count();

        // Emit pipeline completed event
        if let Some(app) = app {
            if let Ok(session_id) = uuid::Uuid::parse_str(context.session_id()) {
                let _ = EventEmitter::pipeline_completed(
                    app,
                    session_id,
                    &self.name,
                    total_duration.as_millis() as u64,
                    stages_completed,
                    stages_skipped,
                );
            }
        }

        Ok(PipelineResult::success(
            &self.name,
            stage_results,
            total_duration,
        ))
    }
}

/// Builder for constructing pipelines
pub struct PipelineBuilder {
    name: String,
    stages: Vec<Box<dyn PipelineStage>>,
}

impl PipelineBuilder {
    /// Create a new pipeline builder
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            stages: Vec::new(),
        }
    }

    /// Add a stage to the pipeline
    pub fn add_stage<S: PipelineStage + 'static>(mut self, stage: S) -> Self {
        self.stages.push(Box::new(stage));
        self
    }

    /// Add a boxed stage to the pipeline
    pub fn add_boxed_stage(mut self, stage: Box<dyn PipelineStage>) -> Self {
        self.stages.push(stage);
        self
    }

    /// Build the pipeline
    pub fn build(self) -> Pipeline {
        Pipeline {
            name: self.name,
            stages: self.stages,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::error::NotariError;

    // Test stage that succeeds
    struct SuccessStage {
        name: String,
    }

    impl SuccessStage {
        fn new(name: impl Into<String>) -> Self {
            Self { name: name.into() }
        }
    }

    impl PipelineStage for SuccessStage {
        fn execute(&self, context: &mut PipelineContext) -> NotariResult<()> {
            context.set_string(&self.name, "executed");
            Ok(())
        }

        fn name(&self) -> &str {
            &self.name
        }
    }

    // Test stage that fails
    struct FailStage {
        name: String,
    }

    impl FailStage {
        fn new(name: impl Into<String>) -> Self {
            Self { name: name.into() }
        }
    }

    impl PipelineStage for FailStage {
        fn execute(&self, _context: &mut PipelineContext) -> NotariResult<()> {
            Err(NotariError::PipelineError("Stage failed".to_string()))
        }

        fn name(&self) -> &str {
            &self.name
        }
    }

    // Test stage that can be skipped
    struct SkippableStage {
        name: String,
    }

    impl SkippableStage {
        fn new(name: impl Into<String>) -> Self {
            Self { name: name.into() }
        }
    }

    impl PipelineStage for SkippableStage {
        fn execute(&self, context: &mut PipelineContext) -> NotariResult<()> {
            context.set_string(&self.name, "executed");
            Ok(())
        }

        fn name(&self) -> &str {
            &self.name
        }

        fn should_skip(&self, context: &PipelineContext) -> bool {
            context.get_bool("skip_optional").unwrap_or(false)
        }
    }

    #[test]
    fn test_pipeline_success() {
        let pipeline = Pipeline::builder("test-pipeline")
            .add_stage(SuccessStage::new("stage1"))
            .add_stage(SuccessStage::new("stage2"))
            .build();

        let mut context = PipelineContext::new("session-123");
        let result = pipeline.execute(&mut context).unwrap();

        assert!(result.success);
        assert_eq!(result.stage_results.len(), 2);
        assert_eq!(result.executed_stages(), 2);
        assert!(context.has("stage1"));
        assert!(context.has("stage2"));
    }

    #[test]
    fn test_pipeline_failure() {
        let pipeline = Pipeline::builder("test-pipeline")
            .add_stage(SuccessStage::new("stage1"))
            .add_stage(FailStage::new("stage2"))
            .add_stage(SuccessStage::new("stage3"))
            .build();

        let mut context = PipelineContext::new("session-123");
        let result = pipeline.execute(&mut context).unwrap();

        assert!(!result.success);
        assert_eq!(result.stage_results.len(), 2); // Only 2 stages executed
        assert!(context.has("stage1"));
        assert!(!context.has("stage3")); // Stage 3 never executed
    }

    #[test]
    fn test_pipeline_with_skipped_stage() {
        let pipeline = Pipeline::builder("test-pipeline")
            .add_stage(SuccessStage::new("stage1"))
            .add_stage(SkippableStage::new("stage2"))
            .add_stage(SuccessStage::new("stage3"))
            .build();

        let mut context = PipelineContext::new("session-123");
        context.set_bool("skip_optional", true);
        let result = pipeline.execute(&mut context).unwrap();

        assert!(result.success);
        assert_eq!(result.stage_results.len(), 3);
        assert_eq!(result.executed_stages(), 2);
        assert_eq!(result.skipped_stages(), 1);
        assert!(context.has("stage1"));
        assert!(!context.has("stage2")); // Skipped
        assert!(context.has("stage3"));
    }
}
