//! Pipeline pattern implementation for sequential data transformations
//!
//! This module provides a flexible pipeline system for executing sequential stages
//! of data transformation. Each stage can read from and write to a shared context,
//! and the pipeline handles error propagation, progress tracking, and logging.
//!
//! # Example
//! ```
//! use notari::pipeline::{Pipeline, PipelineContext, PipelineStage};
//! use notari::error::NotariResult;
//!
//! // Define a custom stage
//! struct MyStage;
//!
//! impl PipelineStage for MyStage {
//!     fn execute(&self, context: &mut PipelineContext) -> NotariResult<()> {
//!         // Perform transformation
//!         let input = context.get_string("input")?;
//!         let output = input.to_uppercase();
//!         context.set_string("output", output);
//!         Ok(())
//!     }
//!
//!     fn name(&self) -> &str {
//!         "My Stage"
//!     }
//! }
//!
//! // Build and execute pipeline
//! let pipeline = Pipeline::builder("my-pipeline")
//!     .add_stage(MyStage)
//!     .build();
//!
//! let mut context = PipelineContext::new("session-123");
//! context.set_string("input", "hello");
//! let result = pipeline.execute(&mut context)?;
//! ```

pub mod context;
pub mod core;
pub mod executor;
pub mod stages;

// Re-export main types
pub use context::PipelineContext;
pub use core::{PipelineResult, PipelineStage, StageResult};
pub use executor::{Pipeline, PipelineBuilder};
