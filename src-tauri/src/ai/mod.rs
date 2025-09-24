pub mod processor;
pub mod models;
pub mod analysis;
pub mod patterns;

#[cfg(test)]
mod tests;

pub use processor::AIProcessor;
pub use analysis::{AIAnalysis, WorkPattern, AnomalyFlag, WorkSummary};