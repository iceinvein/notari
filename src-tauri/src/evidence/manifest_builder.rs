use super::manifest::{
    CustomMetadata, EncryptionInfo, EvidenceManifest, Metadata, RecordingInfo, SystemInfo,
    Timestamps, VideoInfo, WindowInfo,
};
use super::{BlockchainAnchor, HashInfo, SignatureInfo};
use crate::error::{NotariError, NotariResult};
use chrono::{DateTime, Utc};
use std::path::PathBuf;
use uuid::Uuid;

/// Builder for constructing EvidenceManifest instances with a fluent API
///
/// # Example
/// ```
/// use notari::evidence::EvidenceManifestBuilder;
/// use std::path::PathBuf;
///
/// let manifest = EvidenceManifestBuilder::new()
///     .session_id(session_id)
///     .file_path(PathBuf::from("/tmp/recording.mov"))
///     .file_hash(hash_info)
///     .file_size(1024000)
///     .duration(60.5)
///     .window_title("Chrome - Google")
///     .window_id(123)
///     .app_name("Google Chrome")
///     .app_bundle_id("com.google.Chrome")
///     .resolution("1920x1080")
///     .frame_rate(30)
///     .codec("h264")
///     .build()?;
/// ```
pub struct EvidenceManifestBuilder {
    // Recording info
    session_id: Option<Uuid>,
    file_path: Option<PathBuf>,
    file_hash: Option<HashInfo>,
    file_size: Option<u64>,
    duration: Option<f64>,
    encrypted: bool,
    encryption_info: Option<EncryptionInfo>,
    encrypted_hash: Option<HashInfo>,

    // Window metadata
    window_title: Option<String>,
    window_id: Option<u32>,
    app_name: Option<String>,
    app_bundle_id: Option<String>,

    // Video metadata
    resolution: Option<String>,
    frame_rate: Option<u32>,
    codec: Option<String>,

    // Custom metadata
    custom_title: Option<String>,
    custom_description: Option<String>,
    custom_tags: Option<Vec<String>>,

    // System info
    system_info: Option<SystemInfo>,

    // Timestamps
    timestamps: Option<Timestamps>,

    // Optional fields
    blockchain_anchor: Option<BlockchainAnchor>,
}

impl EvidenceManifestBuilder {
    /// Create a new builder
    pub fn new() -> Self {
        Self {
            session_id: None,
            file_path: None,
            file_hash: None,
            file_size: None,
            duration: None,
            encrypted: false,
            encryption_info: None,
            encrypted_hash: None,
            window_title: None,
            window_id: None,
            app_name: None,
            app_bundle_id: None,
            resolution: None,
            frame_rate: None,
            codec: None,
            custom_title: None,
            custom_description: None,
            custom_tags: None,
            system_info: None,
            timestamps: None,
            blockchain_anchor: None,
        }
    }

    // Recording info methods
    pub fn session_id(mut self, id: Uuid) -> Self {
        self.session_id = Some(id);
        self
    }

    pub fn file_path(mut self, path: PathBuf) -> Self {
        self.file_path = Some(path);
        self
    }

    pub fn file_hash(mut self, hash: HashInfo) -> Self {
        self.file_hash = Some(hash);
        self
    }

    pub fn file_size(mut self, size: u64) -> Self {
        self.file_size = Some(size);
        self
    }

    pub fn duration(mut self, duration: f64) -> Self {
        self.duration = Some(duration);
        self
    }

    pub fn encrypted(mut self, encrypted: bool) -> Self {
        self.encrypted = encrypted;
        self
    }

    pub fn encryption_info(mut self, info: EncryptionInfo) -> Self {
        self.encryption_info = Some(info);
        self.encrypted = true;
        self
    }

    pub fn encrypted_hash(mut self, hash: HashInfo) -> Self {
        self.encrypted_hash = Some(hash);
        self
    }

    // Window metadata methods
    pub fn window_title(mut self, title: impl Into<String>) -> Self {
        self.window_title = Some(title.into());
        self
    }

    pub fn window_id(mut self, id: u32) -> Self {
        self.window_id = Some(id);
        self
    }

    pub fn app_name(mut self, name: impl Into<String>) -> Self {
        self.app_name = Some(name.into());
        self
    }

    pub fn app_bundle_id(mut self, id: impl Into<String>) -> Self {
        self.app_bundle_id = Some(id.into());
        self
    }

    // Video metadata methods
    pub fn resolution(mut self, resolution: impl Into<String>) -> Self {
        self.resolution = Some(resolution.into());
        self
    }

    pub fn frame_rate(mut self, rate: u32) -> Self {
        self.frame_rate = Some(rate);
        self
    }

    pub fn codec(mut self, codec: impl Into<String>) -> Self {
        self.codec = Some(codec.into());
        self
    }

    // Custom metadata methods
    pub fn title(mut self, title: impl Into<String>) -> Self {
        self.custom_title = Some(title.into());
        self
    }

    pub fn description(mut self, description: impl Into<String>) -> Self {
        self.custom_description = Some(description.into());
        self
    }

    pub fn tags(mut self, tags: Vec<String>) -> Self {
        self.custom_tags = Some(tags);
        self
    }

    pub fn add_tag(mut self, tag: impl Into<String>) -> Self {
        let tag = tag.into();
        match &mut self.custom_tags {
            Some(tags) => tags.push(tag),
            None => self.custom_tags = Some(vec![tag]),
        }
        self
    }

    // System info methods
    pub fn system_info(mut self, info: SystemInfo) -> Self {
        self.system_info = Some(info);
        self
    }

    pub fn system(
        mut self,
        os: impl Into<String>,
        os_version: impl Into<String>,
        device_id: impl Into<String>,
        hostname: impl Into<String>,
        app_version: impl Into<String>,
        recorder: impl Into<String>,
    ) -> Self {
        self.system_info = Some(SystemInfo {
            os: os.into(),
            os_version: os_version.into(),
            device_id: device_id.into(),
            hostname: hostname.into(),
            app_version: app_version.into(),
            recorder: recorder.into(),
        });
        self
    }

    // Timestamps methods
    pub fn timestamps(mut self, timestamps: Timestamps) -> Self {
        self.timestamps = Some(timestamps);
        self
    }

    pub fn timestamps_from_dates(
        mut self,
        started_at: DateTime<Utc>,
        stopped_at: DateTime<Utc>,
    ) -> Self {
        self.timestamps = Some(Timestamps {
            started_at,
            stopped_at,
            manifest_created_at: Utc::now(),
        });
        self
    }

    // Optional fields
    pub fn blockchain_anchor(mut self, anchor: BlockchainAnchor) -> Self {
        self.blockchain_anchor = Some(anchor);
        self
    }

    /// Build the EvidenceManifest instance
    ///
    /// # Errors
    /// Returns `NotariError::BuilderError` if required fields are missing or invalid
    pub fn build(self) -> NotariResult<EvidenceManifest> {
        // Validate required recording fields
        let session_id = self
            .session_id
            .ok_or_else(|| NotariError::BuilderError("session_id is required".to_string()))?;
        let file_path = self
            .file_path
            .ok_or_else(|| NotariError::BuilderError("file_path is required".to_string()))?;
        let file_hash = self
            .file_hash
            .ok_or_else(|| NotariError::BuilderError("file_hash is required".to_string()))?;
        let file_size = self
            .file_size
            .ok_or_else(|| NotariError::BuilderError("file_size is required".to_string()))?;
        let duration = self
            .duration
            .ok_or_else(|| NotariError::BuilderError("duration is required".to_string()))?;

        // Validate window metadata fields
        let window_title = self
            .window_title
            .ok_or_else(|| NotariError::BuilderError("window_title is required".to_string()))?;
        let window_id = self
            .window_id
            .ok_or_else(|| NotariError::BuilderError("window_id is required".to_string()))?;
        let app_name = self
            .app_name
            .ok_or_else(|| NotariError::BuilderError("app_name is required".to_string()))?;
        let app_bundle_id = self.app_bundle_id.ok_or_else(|| {
            NotariError::BuilderError("app_bundle_id is required".to_string())
        })?;

        // Validate video metadata fields
        let resolution = self
            .resolution
            .ok_or_else(|| NotariError::BuilderError("resolution is required".to_string()))?;
        let frame_rate = self
            .frame_rate
            .ok_or_else(|| NotariError::BuilderError("frame_rate is required".to_string()))?;
        let codec = self
            .codec
            .ok_or_else(|| NotariError::BuilderError("codec is required".to_string()))?;

        // System info is required
        let system = self
            .system_info
            .ok_or_else(|| NotariError::BuilderError("system_info is required".to_string()))?;

        // Timestamps is required
        let timestamps = self
            .timestamps
            .ok_or_else(|| NotariError::BuilderError("timestamps is required".to_string()))?;

        // Validate encryption consistency
        if self.encrypted && self.encryption_info.is_none() {
            return Err(NotariError::BuilderError(
                "encryption_info is required when encrypted is true".to_string(),
            ));
        }

        // Build custom metadata if any custom fields are set
        let custom = if self.custom_title.is_some()
            || self.custom_description.is_some()
            || self.custom_tags.is_some()
        {
            Some(CustomMetadata {
                title: self.custom_title,
                description: self.custom_description,
                tags: self.custom_tags,
            })
        } else {
            None
        };

        Ok(EvidenceManifest {
            version: "1.0".to_string(),
            recording: RecordingInfo {
                session_id: session_id.to_string(),
                file_path: file_path.to_string_lossy().to_string(),
                encrypted: self.encrypted,
                encryption: self.encryption_info,
                plaintext_hash: file_hash,
                encrypted_hash: self.encrypted_hash,
                file_size_bytes: file_size,
                duration_seconds: duration,
            },
            metadata: Metadata {
                window: WindowInfo {
                    title: window_title,
                    id: window_id,
                    app_name,
                    app_bundle_id,
                },
                video: VideoInfo {
                    resolution,
                    frame_rate,
                    codec,
                },
                custom,
            },
            system,
            timestamps,
            signature: SignatureInfo {
                algorithm: String::new(),
                public_key: String::new(),
                signature: String::new(),
                signed_data_hash: String::new(),
            },
            blockchain_anchor: self.blockchain_anchor,
        })
    }
}

impl Default for EvidenceManifestBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_system_info() -> SystemInfo {
        SystemInfo {
            os: "macOS".to_string(),
            os_version: "14.0".to_string(),
            device_id: "test-device".to_string(),
            hostname: "test-machine".to_string(),
            app_version: "0.1.0".to_string(),
            recorder: "ScreenCaptureKit".to_string(),
        }
    }

    fn create_test_timestamps() -> Timestamps {
        let now = Utc::now();
        Timestamps {
            started_at: now,
            stopped_at: now,
            manifest_created_at: now,
        }
    }

    #[test]
    fn test_builder_with_required_fields() {
        let session_id = Uuid::new_v4();
        let file_path = PathBuf::from("/tmp/test.mov");
        let file_hash = HashInfo::from_bytes(b"test data");

        let manifest = EvidenceManifestBuilder::new()
            .session_id(session_id)
            .file_path(file_path.clone())
            .file_hash(file_hash.clone())
            .file_size(1024)
            .duration(60.0)
            .window_title("Test Window")
            .window_id(123)
            .app_name("Test App")
            .app_bundle_id("com.test.app")
            .resolution("1920x1080")
            .frame_rate(30)
            .codec("h264")
            .system_info(create_test_system_info())
            .timestamps(create_test_timestamps())
            .build()
            .unwrap();

        assert_eq!(manifest.recording.session_id, session_id.to_string());
        assert_eq!(manifest.recording.file_size_bytes, 1024);
        assert_eq!(manifest.recording.duration_seconds, 60.0);
        assert_eq!(manifest.metadata.window.title, "Test Window");
        assert_eq!(manifest.metadata.video.resolution, "1920x1080");
        assert!(!manifest.recording.encrypted);
        assert!(manifest.metadata.custom.is_none());
    }

    #[test]
    fn test_builder_with_custom_metadata() {
        let session_id = Uuid::new_v4();
        let file_path = PathBuf::from("/tmp/test.mov");
        let file_hash = HashInfo::from_bytes(b"test data");

        let manifest = EvidenceManifestBuilder::new()
            .session_id(session_id)
            .file_path(file_path)
            .file_hash(file_hash)
            .file_size(1024)
            .duration(60.0)
            .window_title("Test Window")
            .window_id(123)
            .app_name("Test App")
            .app_bundle_id("com.test.app")
            .resolution("1920x1080")
            .frame_rate(30)
            .codec("h264")
            .system_info(create_test_system_info())
            .timestamps(create_test_timestamps())
            .title("My Recording")
            .description("Test description")
            .tags(vec!["test".to_string(), "demo".to_string()])
            .build()
            .unwrap();

        let custom = manifest.metadata.custom.unwrap();
        assert_eq!(custom.title, Some("My Recording".to_string()));
        assert_eq!(custom.description, Some("Test description".to_string()));
        assert_eq!(
            custom.tags,
            Some(vec!["test".to_string(), "demo".to_string()])
        );
    }

    #[test]
    fn test_builder_add_tag() {
        let session_id = Uuid::new_v4();
        let file_path = PathBuf::from("/tmp/test.mov");
        let file_hash = HashInfo::from_bytes(b"test data");

        let manifest = EvidenceManifestBuilder::new()
            .session_id(session_id)
            .file_path(file_path)
            .file_hash(file_hash)
            .file_size(1024)
            .duration(60.0)
            .window_title("Test Window")
            .window_id(123)
            .app_name("Test App")
            .app_bundle_id("com.test.app")
            .resolution("1920x1080")
            .frame_rate(30)
            .codec("h264")
            .system_info(create_test_system_info())
            .timestamps(create_test_timestamps())
            .add_tag("tag1")
            .add_tag("tag2")
            .add_tag("tag3")
            .build()
            .unwrap();

        let custom = manifest.metadata.custom.unwrap();
        assert_eq!(
            custom.tags,
            Some(vec![
                "tag1".to_string(),
                "tag2".to_string(),
                "tag3".to_string()
            ])
        );
    }

    #[test]
    fn test_builder_missing_session_id() {
        let result = EvidenceManifestBuilder::new()
            .file_path(PathBuf::from("/tmp/test.mov"))
            .file_hash(HashInfo::from_bytes(b"test"))
            .file_size(1024)
            .duration(60.0)
            .window_title("Test")
            .window_id(123)
            .app_name("Test")
            .app_bundle_id("com.test")
            .resolution("1920x1080")
            .frame_rate(30)
            .codec("h264")
            .system_info(create_test_system_info())
            .timestamps(create_test_timestamps())
            .build();

        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), NotariError::BuilderError(_)));
    }

    #[test]
    fn test_builder_system_helper() {
        let session_id = Uuid::new_v4();
        let file_path = PathBuf::from("/tmp/test.mov");
        let file_hash = HashInfo::from_bytes(b"test data");

        let manifest = EvidenceManifestBuilder::new()
            .session_id(session_id)
            .file_path(file_path)
            .file_hash(file_hash)
            .file_size(1024)
            .duration(60.0)
            .window_title("Test Window")
            .window_id(123)
            .app_name("Test App")
            .app_bundle_id("com.test.app")
            .resolution("1920x1080")
            .frame_rate(30)
            .codec("h264")
            .system("macOS", "14.0", "device-123", "hostname", "0.1.0", "ScreenCaptureKit")
            .timestamps(create_test_timestamps())
            .build()
            .unwrap();

        assert_eq!(manifest.system.os, "macOS");
        assert_eq!(manifest.system.os_version, "14.0");
        assert_eq!(manifest.system.device_id, "device-123");
    }

    #[test]
    fn test_builder_timestamps_helper() {
        let session_id = Uuid::new_v4();
        let file_path = PathBuf::from("/tmp/test.mov");
        let file_hash = HashInfo::from_bytes(b"test data");
        let started = Utc::now();
        let stopped = Utc::now();

        let manifest = EvidenceManifestBuilder::new()
            .session_id(session_id)
            .file_path(file_path)
            .file_hash(file_hash)
            .file_size(1024)
            .duration(60.0)
            .window_title("Test Window")
            .window_id(123)
            .app_name("Test App")
            .app_bundle_id("com.test.app")
            .resolution("1920x1080")
            .frame_rate(30)
            .codec("h264")
            .system_info(create_test_system_info())
            .timestamps_from_dates(started, stopped)
            .build()
            .unwrap();

        assert_eq!(manifest.timestamps.started_at, started);
        assert_eq!(manifest.timestamps.stopped_at, stopped);
    }
}

