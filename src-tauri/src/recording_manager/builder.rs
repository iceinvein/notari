use super::{ActiveRecording, RecordingPreferences, WindowMetadata};
use crate::error::{NotariError, NotariResult};
use chrono::Utc;
use std::path::PathBuf;
use uuid::Uuid;

/// Builder for constructing ActiveRecording instances with a fluent API
///
/// This builder provides a type-safe way to construct `ActiveRecording` instances
/// with optional fields like encryption settings, custom metadata, and tags.
pub struct ActiveRecordingBuilder {
    window_id: String,
    output_path: Option<PathBuf>,
    preferences: Option<RecordingPreferences>,
    window_metadata: Option<WindowMetadata>,
    encryption_password: Option<String>,
    encryption_method: Option<String>,
    encryption_recipients: Option<Vec<super::EncryptionRecipient>>,
    recording_title: Option<String>,
    recording_description: Option<String>,
    recording_tags: Option<Vec<String>>,
}

impl ActiveRecordingBuilder {
    /// Create a new builder with the required window ID
    pub fn new(window_id: impl Into<String>) -> Self {
        Self {
            window_id: window_id.into(),
            output_path: None,
            preferences: None,
            window_metadata: None,
            encryption_password: None,
            encryption_method: None,
            encryption_recipients: None,
            recording_title: None,
            recording_description: None,
            recording_tags: None,
        }
    }

    /// Set the output path for the recording
    pub fn output_path(mut self, path: PathBuf) -> Self {
        self.output_path = Some(path);
        self
    }

    /// Set the recording preferences
    pub fn preferences(mut self, prefs: RecordingPreferences) -> Self {
        self.preferences = Some(prefs);
        self
    }

    /// Set the window metadata
    #[allow(dead_code)]
    pub fn window_metadata(mut self, metadata: WindowMetadata) -> Self {
        self.window_metadata = Some(metadata);
        self
    }

    /// Set the encryption password (enables encryption)
    #[allow(dead_code)]
    pub fn encryption_password(mut self, password: impl Into<String>) -> Self {
        self.encryption_password = Some(password.into());
        self
    }

    /// Set the recording title
    #[allow(dead_code)]
    pub fn title(mut self, title: impl Into<String>) -> Self {
        self.recording_title = Some(title.into());
        self
    }

    /// Set the recording description
    #[allow(dead_code)]
    pub fn description(mut self, description: impl Into<String>) -> Self {
        self.recording_description = Some(description.into());
        self
    }

    /// Set the recording tags
    #[allow(dead_code)]
    pub fn tags(mut self, tags: Vec<String>) -> Self {
        self.recording_tags = Some(tags);
        self
    }

    /// Add a single tag to the recording
    #[allow(dead_code)]
    pub fn add_tag(mut self, tag: impl Into<String>) -> Self {
        let tag = tag.into();
        match &mut self.recording_tags {
            Some(tags) => tags.push(tag),
            None => self.recording_tags = Some(vec![tag]),
        }
        self
    }

    /// Build the ActiveRecording instance
    ///
    /// # Errors
    /// Returns `NotariError::BuilderError` if required fields are missing or invalid
    pub fn build(self) -> NotariResult<ActiveRecording> {
        // Validate required fields
        let output_path = self
            .output_path
            .ok_or_else(|| NotariError::BuilderError("output_path is required".to_string()))?;

        // Validate output path parent directory exists
        if let Some(parent) = output_path.parent() {
            if !parent.exists() {
                return Err(NotariError::BuilderError(format!(
                    "Output directory does not exist: {}",
                    parent.display()
                )));
            }
        }

        // Use default preferences if not provided
        let preferences = self.preferences.unwrap_or_default();

        // Validate tags if provided
        if let Some(ref tags) = self.recording_tags {
            if tags.is_empty() {
                return Err(NotariError::BuilderError(
                    "Tags array cannot be empty (use None instead)".to_string(),
                ));
            }
            for tag in tags {
                if tag.trim().is_empty() {
                    return Err(NotariError::BuilderError(
                        "Tags cannot be empty strings".to_string(),
                    ));
                }
            }
        }

        Ok(ActiveRecording {
            session_id: Uuid::new_v4().to_string(),
            window_id: self.window_id,
            start_time: Utc::now(),
            output_path,
            preferences,
            window_metadata: self.window_metadata,
            encryption_password: self.encryption_password,
            encryption_method: self.encryption_method,
            encryption_recipients: self.encryption_recipients,
            recording_title: self.recording_title,
            recording_description: self.recording_description,
            recording_tags: self.recording_tags,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_builder_with_required_fields_only() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.mov");

        let recording = ActiveRecordingBuilder::new("window-123")
            .output_path(output_path.clone())
            .build()
            .unwrap();

        assert_eq!(recording.window_id, "window-123");
        assert_eq!(recording.output_path, output_path);
        assert!(recording.recording_title.is_none());
        assert!(recording.recording_description.is_none());
        assert!(recording.recording_tags.is_none());
    }

    #[test]
    fn test_builder_with_all_fields() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.mov");

        let metadata = WindowMetadata {
            title: "Test Window".to_string(),
            app_name: "Test App".to_string(),
            app_bundle_id: "com.test.app".to_string(),
            width: 1920,
            height: 1080,
        };

        let recording = ActiveRecordingBuilder::new("window-123")
            .output_path(output_path.clone())
            .window_metadata(metadata.clone())
            .title("My Recording")
            .description("Test description")
            .tags(vec!["test".to_string(), "demo".to_string()])
            .build()
            .unwrap();

        assert_eq!(recording.window_id, "window-123");
        assert_eq!(recording.output_path, output_path);
        assert_eq!(recording.recording_title, Some("My Recording".to_string()));
        assert_eq!(
            recording.recording_description,
            Some("Test description".to_string())
        );
        assert_eq!(
            recording.recording_tags,
            Some(vec!["test".to_string(), "demo".to_string()])
        );
        assert!(recording.window_metadata.is_some());
    }

    #[test]
    fn test_builder_add_tag() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.mov");

        let recording = ActiveRecordingBuilder::new("window-123")
            .output_path(output_path)
            .add_tag("tag1")
            .add_tag("tag2")
            .add_tag("tag3")
            .build()
            .unwrap();

        assert_eq!(
            recording.recording_tags,
            Some(vec![
                "tag1".to_string(),
                "tag2".to_string(),
                "tag3".to_string()
            ])
        );
    }

    #[test]
    fn test_builder_missing_output_path() {
        let result = ActiveRecordingBuilder::new("window-123").build();

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), NotariError::BuilderError(_)));
    }

    #[test]
    fn test_builder_invalid_output_directory() {
        let output_path = PathBuf::from("/nonexistent/directory/test.mov");

        let result = ActiveRecordingBuilder::new("window-123")
            .output_path(output_path)
            .build();

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), NotariError::BuilderError(_)));
    }

    #[test]
    fn test_builder_empty_tags_array() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.mov");

        let result = ActiveRecordingBuilder::new("window-123")
            .output_path(output_path)
            .tags(vec![])
            .build();

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), NotariError::BuilderError(_)));
    }

    #[test]
    fn test_builder_empty_tag_string() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.mov");

        let result = ActiveRecordingBuilder::new("window-123")
            .output_path(output_path)
            .tags(vec!["valid".to_string(), "".to_string()])
            .build();

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), NotariError::BuilderError(_)));
    }

    #[test]
    fn test_builder_with_encryption_password() {
        let temp_dir = TempDir::new().unwrap();
        let output_path = temp_dir.path().join("test.mov");

        let recording = ActiveRecordingBuilder::new("window-123")
            .output_path(output_path)
            .encryption_password("SecurePass123")
            .build()
            .unwrap();

        assert_eq!(
            recording.encryption_password,
            Some("SecurePass123".to_string())
        );
    }
}
