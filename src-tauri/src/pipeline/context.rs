use crate::error::{NotariError, NotariResult};
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;

/// Pipeline context that holds data passed between stages
///
/// The context acts as a shared state container that stages can read from and write to.
/// It supports storing various types of data including strings, paths, and JSON values.
///
/// # Example
/// ```
/// use app_lib::pipeline::PipelineContext;
/// use std::path::PathBuf;
///
/// let mut context = PipelineContext::new("session-123");
/// context.set_path("video_path", PathBuf::from("/tmp/video.mov"));
/// context.set_string("status", "processing");
///
/// let video_path = context.get_path("video_path").unwrap();
/// let status = context.get_string("status").unwrap();
/// ```
#[derive(Debug, Clone)]
pub struct PipelineContext {
    /// Session ID for this pipeline execution
    session_id: String,

    /// Key-value store for pipeline data
    data: HashMap<String, Value>,

    /// Temporary files to clean up after pipeline completes
    temp_files: Vec<PathBuf>,

    /// Metadata about the pipeline execution
    metadata: HashMap<String, String>,
}

impl PipelineContext {
    /// Create a new pipeline context
    pub fn new(session_id: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            data: HashMap::new(),
            temp_files: Vec::new(),
            metadata: HashMap::new(),
        }
    }

    /// Get the session ID
    pub fn session_id(&self) -> &str {
        &self.session_id
    }

    /// Set a value in the context
    pub fn set(&mut self, key: impl Into<String>, value: Value) {
        self.data.insert(key.into(), value);
    }

    /// Get a value from the context
    pub fn get(&self, key: &str) -> Option<&Value> {
        self.data.get(key)
    }

    /// Get a value from the context or return an error if not found
    pub fn get_required(&self, key: &str) -> NotariResult<&Value> {
        self.data.get(key).ok_or_else(|| {
            NotariError::PipelineError(format!("Required context key not found: {}", key))
        })
    }

    /// Set a string value
    pub fn set_string(&mut self, key: impl Into<String>, value: impl Into<String>) {
        self.data.insert(key.into(), Value::String(value.into()));
    }

    /// Get a string value
    pub fn get_string(&self, key: &str) -> NotariResult<String> {
        match self.get_required(key)? {
            Value::String(s) => Ok(s.clone()),
            _ => Err(NotariError::PipelineError(format!(
                "Context key '{}' is not a string",
                key
            ))),
        }
    }

    /// Set a path value
    pub fn set_path(&mut self, key: impl Into<String>, path: PathBuf) {
        self.data.insert(
            key.into(),
            Value::String(path.to_string_lossy().to_string()),
        );
    }

    /// Get a path value
    pub fn get_path(&self, key: &str) -> NotariResult<PathBuf> {
        let path_str = self.get_string(key)?;
        Ok(PathBuf::from(path_str))
    }

    /// Set a boolean value
    pub fn set_bool(&mut self, key: impl Into<String>, value: bool) {
        self.data.insert(key.into(), Value::Bool(value));
    }

    /// Get a boolean value
    pub fn get_bool(&self, key: &str) -> NotariResult<bool> {
        match self.get_required(key)? {
            Value::Bool(b) => Ok(*b),
            _ => Err(NotariError::PipelineError(format!(
                "Context key '{}' is not a boolean",
                key
            ))),
        }
    }

    /// Set a number value
    pub fn set_number(&mut self, key: impl Into<String>, value: f64) {
        self.data.insert(
            key.into(),
            Value::Number(serde_json::Number::from_f64(value).unwrap()),
        );
    }

    /// Get a number value
    pub fn get_number(&self, key: &str) -> NotariResult<f64> {
        match self.get_required(key)? {
            Value::Number(n) => n.as_f64().ok_or_else(|| {
                NotariError::PipelineError(format!("Context key '{}' is not a valid number", key))
            }),
            _ => Err(NotariError::PipelineError(format!(
                "Context key '{}' is not a number",
                key
            ))),
        }
    }

    /// Check if a key exists in the context
    pub fn has(&self, key: &str) -> bool {
        self.data.contains_key(key)
    }

    /// Remove a value from the context
    pub fn remove(&mut self, key: &str) -> Option<Value> {
        self.data.remove(key)
    }

    /// Add a temporary file to be cleaned up later
    pub fn add_temp_file(&mut self, path: PathBuf) {
        self.temp_files.push(path);
    }

    /// Get all temporary files
    pub fn temp_files(&self) -> &[PathBuf] {
        &self.temp_files
    }

    /// Clear all temporary files from the list
    pub fn clear_temp_files(&mut self) {
        self.temp_files.clear();
    }

    /// Set metadata
    pub fn set_metadata(&mut self, key: impl Into<String>, value: impl Into<String>) {
        self.metadata.insert(key.into(), value.into());
    }

    /// Get metadata
    pub fn get_metadata(&self, key: &str) -> Option<&str> {
        self.metadata.get(key).map(|s| s.as_str())
    }

    /// Get all metadata
    pub fn metadata(&self) -> &HashMap<String, String> {
        &self.metadata
    }

    /// Get all data keys
    pub fn keys(&self) -> Vec<&String> {
        self.data.keys().collect()
    }

    /// Clear all data (but keep session_id and metadata)
    pub fn clear_data(&mut self) {
        self.data.clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_context_creation() {
        let context = PipelineContext::new("session-123");
        assert_eq!(context.session_id(), "session-123");
        assert!(context.keys().is_empty());
    }

    #[test]
    fn test_string_operations() {
        let mut context = PipelineContext::new("session-123");
        context.set_string("key1", "value1");

        assert!(context.has("key1"));
        assert_eq!(context.get_string("key1").unwrap(), "value1");
    }

    #[test]
    fn test_path_operations() {
        let mut context = PipelineContext::new("session-123");
        let path = PathBuf::from("/tmp/test.mov");
        context.set_path("video_path", path.clone());

        assert_eq!(context.get_path("video_path").unwrap(), path);
    }

    #[test]
    fn test_bool_operations() {
        let mut context = PipelineContext::new("session-123");
        context.set_bool("encrypted", true);

        assert_eq!(context.get_bool("encrypted").unwrap(), true);
    }

    #[test]
    fn test_number_operations() {
        let mut context = PipelineContext::new("session-123");
        context.set_number("duration", 60.5);

        assert_eq!(context.get_number("duration").unwrap(), 60.5);
    }

    #[test]
    fn test_missing_key() {
        let context = PipelineContext::new("session-123");
        let result = context.get_string("missing");

        assert!(result.is_err());
    }

    #[test]
    fn test_wrong_type() {
        let mut context = PipelineContext::new("session-123");
        context.set_string("key1", "value1");

        let result = context.get_bool("key1");
        assert!(result.is_err());
    }

    #[test]
    fn test_temp_files() {
        let mut context = PipelineContext::new("session-123");
        context.add_temp_file(PathBuf::from("/tmp/file1.tmp"));
        context.add_temp_file(PathBuf::from("/tmp/file2.tmp"));

        assert_eq!(context.temp_files().len(), 2);

        context.clear_temp_files();
        assert_eq!(context.temp_files().len(), 0);
    }

    #[test]
    fn test_metadata() {
        let mut context = PipelineContext::new("session-123");
        context.set_metadata("pipeline_name", "test-pipeline");
        context.set_metadata("version", "1.0");

        assert_eq!(context.get_metadata("pipeline_name"), Some("test-pipeline"));
        assert_eq!(context.metadata().len(), 2);
    }

    #[test]
    fn test_remove() {
        let mut context = PipelineContext::new("session-123");
        context.set_string("key1", "value1");

        assert!(context.has("key1"));
        context.remove("key1");
        assert!(!context.has("key1"));
    }

    #[test]
    fn test_clear_data() {
        let mut context = PipelineContext::new("session-123");
        context.set_string("key1", "value1");
        context.set_string("key2", "value2");
        context.set_metadata("meta1", "value1");

        context.clear_data();

        assert!(!context.has("key1"));
        assert!(!context.has("key2"));
        assert_eq!(context.session_id(), "session-123");
        assert_eq!(context.get_metadata("meta1"), Some("value1"));
    }
}
