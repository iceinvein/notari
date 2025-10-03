use crate::error::NotariResult;
use crate::evidence::{
    EvidenceManifestBuilder, HashInfo, SystemInfo, Timestamps,
};

#[cfg(test)]
use crate::evidence::EvidenceManifest;
use crate::logger::{LogLevel, LOGGER};
use crate::pipeline::{PipelineContext, PipelineStage};
use crate::recording_manager::WindowMetadata;
use chrono::Utc;
use std::time::Duration;
use uuid::Uuid;

/// Stage that generates the evidence manifest
///
/// # Context Requirements
/// - Input: `session_id` (String) - Recording session ID
/// - Input: `video_path` (PathBuf) - Path to video file (encrypted or plaintext)
/// - Input: `plaintext_hash` (HashInfo as JSON) - Hash of plaintext video
/// - Input: `start_time` (String, ISO 8601) - Recording start time
/// - Input: `file_size` (Number) - Video file size in bytes
/// - Input: `duration` (Number) - Recording duration in seconds
/// - Input: `window_metadata` (WindowMetadata as JSON, optional) - Window metadata
/// - Input: `custom_title` (String, optional) - Custom recording title
/// - Input: `custom_description` (String, optional) - Custom recording description
/// - Input: `custom_tags` (Array of strings, optional) - Custom recording tags
/// - Input: `encryption_info` (EncryptionInfo as JSON, optional) - Encryption metadata
/// - Input: `encrypted_hash` (HashInfo as JSON, optional) - Hash of encrypted video
///
/// # Context Outputs
/// - `manifest` (EvidenceManifest serialized as JSON) - Generated manifest
/// - `manifest_path` (PathBuf) - Path where manifest will be saved
///
pub struct ManifestStage {
    system_info: SystemInfo,
}

impl ManifestStage {
    /// Create a new manifest stage with system information
    pub fn new(system_info: SystemInfo) -> Self {
        Self { system_info }
    }

    /// Create a new manifest stage with auto-detected system information
    #[cfg(target_os = "macos")]
    pub fn new_auto() -> Self {
        use std::process::Command;

        // Get macOS version
        let os_version = Command::new("sw_vers")
            .arg("-productVersion")
            .output()
            .ok()
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        // Get hostname
        let hostname = Command::new("hostname")
            .output()
            .ok()
            .and_then(|output| String::from_utf8(output.stdout).ok())
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "Unknown".to_string());

        // Get device ID (use hostname as fallback)
        let device_id = hostname.clone();

        let system_info = SystemInfo {
            os: "macOS".to_string(),
            os_version,
            device_id,
            hostname,
            app_version: env!("CARGO_PKG_VERSION").to_string(),
            recorder: "notari".to_string(),
        };

        Self { system_info }
    }
}

impl PipelineStage for ManifestStage {
    fn execute(&self, context: &mut PipelineContext) -> NotariResult<()> {
        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Generating evidence manifest (session: {})",
                context.session_id()
            ),
            "pipeline::manifest",
        );

        // Parse session ID
        let session_id = Uuid::parse_str(context.session_id()).map_err(|e| {
            crate::error::NotariError::PipelineError(format!("Invalid session ID: {}", e))
        })?;

        // Get required fields
        let video_path = context.get_path("video_path")?;
        let file_size = context.get_number("file_size")? as u64;
        let duration = context.get_number("duration")?;

        // Get plaintext hash
        let plaintext_hash_json = context.get_required("plaintext_hash")?;
        let plaintext_hash: HashInfo = serde_json::from_value(plaintext_hash_json.clone())
            .map_err(|e| {
                crate::error::NotariError::PipelineError(format!(
                    "Failed to deserialize plaintext hash: {}",
                    e
                ))
            })?;

        // Parse start time
        let start_time_str = context.get_string("start_time")?;
        let start_time = chrono::DateTime::parse_from_rfc3339(&start_time_str)
            .map_err(|e| {
                crate::error::NotariError::PipelineError(format!("Invalid start time: {}", e))
            })?
            .with_timezone(&Utc);

        // Get window metadata (optional)
        let (window_title, app_name, app_bundle_id, resolution) = if context.has("window_metadata")
        {
            let window_meta_json = context.get_required("window_metadata")?;
            let window_meta: WindowMetadata = serde_json::from_value(window_meta_json.clone())
                .map_err(|e| {
                    crate::error::NotariError::PipelineError(format!(
                        "Failed to deserialize window metadata: {}",
                        e
                    ))
                })?;

            (
                window_meta.title.clone(),
                window_meta.app_name.clone(),
                window_meta.app_bundle_id.clone(),
                format!("{}x{}", window_meta.width, window_meta.height),
            )
        } else {
            (
                "Unknown Window".to_string(),
                "Unknown".to_string(),
                "unknown".to_string(),
                "unknown".to_string(),
            )
        };

        // Get window ID (optional, separate from metadata)
        let window_id = if context.has("window_id") {
            context.get_number("window_id")? as u32
        } else {
            0
        };

        // Build timestamps
        let now = Utc::now();
        let timestamps = Timestamps {
            started_at: start_time,
            stopped_at: now,
            manifest_created_at: now,
        };

        // Build manifest using builder
        let mut builder = EvidenceManifestBuilder::new()
            .session_id(session_id)
            .file_path(video_path.clone())
            .file_hash(plaintext_hash)
            .file_size(file_size)
            .duration(duration)
            .window_title(window_title)
            .window_id(window_id)
            .app_name(app_name)
            .app_bundle_id(app_bundle_id)
            .resolution(resolution)
            .frame_rate(30) // Default frame rate
            .codec("H.264")
            .system_info(self.system_info.clone())
            .timestamps(timestamps);

        // Add custom metadata if provided
        if context.has("custom_title") {
            builder = builder.title(context.get_string("custom_title")?);
        }
        if context.has("custom_description") {
            builder = builder.description(context.get_string("custom_description")?);
        }
        if context.has("custom_tags") {
            let tags_json = context.get_required("custom_tags")?;
            let tags: Vec<String> = serde_json::from_value(tags_json.clone()).map_err(|e| {
                crate::error::NotariError::PipelineError(format!(
                    "Failed to deserialize tags: {}",
                    e
                ))
            })?;
            builder = builder.tags(tags);
        }

        // Add encryption info if provided
        if context.has("encryption_info") {
            let encryption_json = context.get_required("encryption_info")?;
            let encryption_info = serde_json::from_value(encryption_json.clone()).map_err(|e| {
                crate::error::NotariError::PipelineError(format!(
                    "Failed to deserialize encryption info: {}",
                    e
                ))
            })?;
            builder = builder.encryption_info(encryption_info);
        }

        // Add encrypted hash if provided
        if context.has("encrypted_hash") {
            let encrypted_hash_json = context.get_required("encrypted_hash")?;
            let encrypted_hash: HashInfo = serde_json::from_value(encrypted_hash_json.clone())
                .map_err(|e| {
                    crate::error::NotariError::PipelineError(format!(
                        "Failed to deserialize encrypted hash: {}",
                        e
                    ))
                })?;
            builder = builder.encrypted_hash(encrypted_hash);
        }

        // Build manifest
        let manifest = builder.build()?;

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Evidence manifest generated successfully (session: {})",
                context.session_id()
            ),
            "pipeline::manifest",
        );

        // Store manifest in context as JSON
        let manifest_json = serde_json::to_value(&manifest).map_err(|e| {
            crate::error::NotariError::PipelineError(format!("Failed to serialize manifest: {}", e))
        })?;
        context.set("manifest", manifest_json);

        // Store manifest path
        let manifest_path = video_path.with_extension("json");
        context.set_path("manifest_path", manifest_path);

        Ok(())
    }

    fn name(&self) -> &str {
        "Generate Manifest"
    }

    fn estimated_duration(&self) -> Option<Duration> {
        // Manifest generation is fast
        Some(Duration::from_millis(500))
    }

    fn pre_execute(&self, context: &PipelineContext) -> NotariResult<()> {
        // Validate required fields exist
        // Note: session_id is stored internally in PipelineContext, not in data HashMap
        // So we don't check for it here - it's always available via context.session_id()

        if !context.has("video_path") {
            return Err(crate::error::NotariError::PipelineError(
                "video_path is required".to_string(),
            ));
        }
        if !context.has("plaintext_hash") {
            return Err(crate::error::NotariError::PipelineError(
                "plaintext_hash is required".to_string(),
            ));
        }
        if !context.has("start_time") {
            return Err(crate::error::NotariError::PipelineError(
                "start_time is required".to_string(),
            ));
        }
        if !context.has("file_size") {
            return Err(crate::error::NotariError::PipelineError(
                "file_size is required".to_string(),
            ));
        }
        if !context.has("duration") {
            return Err(crate::error::NotariError::PipelineError(
                "duration is required".to_string(),
            ));
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn create_test_system_info() -> SystemInfo {
        SystemInfo {
            os: "macOS".to_string(),
            os_version: "14.0".to_string(),
            device_id: "test-device".to_string(),
            hostname: "test-machine".to_string(),
            app_version: "0.1.0".to_string(),
            recorder: "notari".to_string(),
        }
    }

    #[test]
    fn test_manifest_stage_success() {
        let mut context = PipelineContext::new("550e8400-e29b-41d4-a716-446655440000");

        // Set required fields
        context.set_path("video_path", PathBuf::from("/tmp/test.mov"));
        context.set_number("file_size", 1024000.0);
        context.set_number("duration", 60.5);
        context.set_string("start_time", "2024-01-01T12:00:00Z");

        // Set plaintext hash
        let hash = HashInfo::from_bytes(b"test data");
        let hash_json = serde_json::to_value(&hash).unwrap();
        context.set("plaintext_hash", hash_json);

        let stage = ManifestStage::new(create_test_system_info());
        let result = stage.execute(&mut context);

        assert!(result.is_ok());
        assert!(context.has("manifest"));
        assert!(context.has("manifest_path"));

        // Verify manifest can be deserialized
        let manifest_json = context.get("manifest").unwrap();
        let manifest: EvidenceManifest = serde_json::from_value(manifest_json.clone()).unwrap();
        assert_eq!(
            manifest.recording.session_id,
            "550e8400-e29b-41d4-a716-446655440000"
        );
    }

    #[test]
    fn test_manifest_stage_missing_required_field() {
        let mut context = PipelineContext::new("550e8400-e29b-41d4-a716-446655440000");
        // Missing video_path

        let stage = ManifestStage::new(create_test_system_info());
        let result = stage.pre_execute(&context);

        assert!(result.is_err());
    }

    #[test]
    fn test_manifest_stage_name() {
        let stage = ManifestStage::new(create_test_system_info());
        assert_eq!(stage.name(), "Generate Manifest");
    }

    #[test]
    fn test_manifest_stage_with_encryption() {
        let mut context = PipelineContext::new("550e8400-e29b-41d4-a716-446655440000");

        // Set required fields
        context.set_path("video_path", PathBuf::from("/tmp/test.mov.enc"));
        context.set_number("file_size", 1024000.0);
        context.set_number("duration", 60.5);
        context.set_string("start_time", "2024-01-01T12:00:00Z");

        // Set plaintext hash
        let plaintext_hash = HashInfo::from_bytes(b"plaintext data");
        let plaintext_hash_json = serde_json::to_value(&plaintext_hash).unwrap();
        context.set("plaintext_hash", plaintext_hash_json);

        // Set encrypted hash
        let encrypted_hash = HashInfo::from_bytes(b"encrypted data");
        let encrypted_hash_json = serde_json::to_value(&encrypted_hash).unwrap();
        context.set("encrypted_hash", encrypted_hash_json);

        // Set encryption info
        let encryption_info = crate::evidence::manifest::EncryptionInfo {
            algorithm: "AES-256-GCM-CHUNKED".to_string(),
            key_derivation: crate::evidence::manifest::KeyDerivationInfo {
                algorithm: "PBKDF2-HMAC-SHA256".to_string(),
                iterations: 600000,
                salt: "test_salt".to_string(),
            },
            nonce: None,
            tag: None,
            chunked: Some(crate::evidence::manifest::ChunkedEncryptionInfo {
                chunk_size: 1048576,
                total_chunks: 1,
                chunks: vec![crate::evidence::manifest::ChunkInfo {
                    index: 0,
                    offset: 0,
                    size: 1024000,
                    nonce: "test_nonce".to_string(),
                }],
            }),
        };
        let encryption_json = serde_json::to_value(&encryption_info).unwrap();
        context.set("encryption_info", encryption_json);

        let stage = ManifestStage::new(create_test_system_info());
        let result = stage.execute(&mut context);

        assert!(result.is_ok());
        assert!(context.has("manifest"));

        // Verify manifest includes encrypted_hash
        let manifest_json = context.get("manifest").unwrap();
        let manifest: EvidenceManifest = serde_json::from_value(manifest_json.clone()).unwrap();

        assert!(
            manifest.recording.encrypted,
            "Recording should be marked as encrypted"
        );
        assert!(
            manifest.recording.encrypted_hash.is_some(),
            "Manifest should include encrypted_hash"
        );

        let encrypted_hash_in_manifest = manifest.recording.encrypted_hash.unwrap();
        assert_eq!(encrypted_hash_in_manifest.algorithm, "SHA-256");
        assert!(!encrypted_hash_in_manifest.value.is_empty());
    }
}
