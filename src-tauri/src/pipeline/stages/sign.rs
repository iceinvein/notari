use crate::error::NotariResult;
use crate::evidence::{keychain, EvidenceManifest, KeyManager};
use crate::logger::{LogLevel, LOGGER};
use crate::pipeline::{PipelineContext, PipelineStage};
use std::time::Duration;

/// Stage that signs the evidence manifest with Ed25519
///
/// This stage generates a signing key if one doesn't exist, then signs the manifest.
///
/// # Context Requirements
/// - Input: `manifest` (EvidenceManifest as JSON) - Manifest to sign
/// - Input: `manifest_path` (PathBuf) - Path where manifest will be saved
///
/// # Context Outputs
/// - Updates `manifest` with signature
/// - Saves signed manifest to `manifest_path`
///
pub struct SignStage;

impl SignStage {
    /// Create a new sign stage
    pub fn new() -> Self {
        Self
    }
}

impl Default for SignStage {
    fn default() -> Self {
        Self::new()
    }
}

impl PipelineStage for SignStage {
    fn execute(&self, context: &mut PipelineContext) -> NotariResult<()> {
        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Signing evidence manifest (session: {})",
                context.session_id()
            ),
            "pipeline::sign",
        );

        // Check if signing key exists, generate if not
        if !keychain::has_signing_key() {
            LOGGER.log(
                LogLevel::Info,
                "No signing key found, generating new key",
                "pipeline::sign",
            );
            let key_manager = KeyManager::generate();
            keychain::store_signing_key(&key_manager.to_bytes())?;
            LOGGER.log(
                LogLevel::Info,
                "New signing key generated and stored in keychain",
                "pipeline::sign",
            );
        } else {
            LOGGER.log(
                LogLevel::Info,
                "Using existing signing key from keychain",
                "pipeline::sign",
            );
        }

        // Load signing key
        let key_bytes = keychain::retrieve_signing_key()?;
        let key_manager = KeyManager::from_bytes(&key_bytes)?;

        // Log public key for verification
        use base64::{engine::general_purpose, Engine as _};
        let public_key = key_manager.public_key();
        let public_key_b64 = general_purpose::STANDARD.encode(public_key.as_bytes());
        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Signing with public key: {}...",
                &public_key_b64[..16.min(public_key_b64.len())]
            ),
            "pipeline::sign",
        );

        // Get manifest from context
        let manifest_json = context.get_required("manifest")?;
        let mut manifest: EvidenceManifest = serde_json::from_value(manifest_json.clone())
            .map_err(|e| {
                crate::error::NotariError::PipelineError(format!(
                    "Failed to deserialize manifest: {}",
                    e
                ))
            })?;

        // Sign manifest
        manifest.sign(&key_manager);

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Manifest signed successfully (session: {})",
                context.session_id()
            ),
            "pipeline::sign",
        );

        // Save signed manifest
        let manifest_path = context.get_path("manifest_path")?;
        manifest.save(&manifest_path)?;

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Signed manifest saved: {} (session: {})",
                manifest_path.display(),
                context.session_id()
            ),
            "pipeline::sign",
        );

        // Update manifest in context
        let manifest_json = serde_json::to_value(&manifest).map_err(|e| {
            crate::error::NotariError::PipelineError(format!("Failed to serialize manifest: {}", e))
        })?;
        context.set("manifest", manifest_json);

        Ok(())
    }

    fn name(&self) -> &str {
        "Sign Manifest"
    }

    fn estimated_duration(&self) -> Option<Duration> {
        // Signing is very fast
        Some(Duration::from_millis(100))
    }

    fn pre_execute(&self, context: &PipelineContext) -> NotariResult<()> {
        // Validate required fields exist
        if !context.has("manifest") {
            return Err(crate::error::NotariError::PipelineError(
                "manifest is required".to_string(),
            ));
        }
        if !context.has("manifest_path") {
            return Err(crate::error::NotariError::PipelineError(
                "manifest_path is required".to_string(),
            ));
        }
        Ok(())
    }

    fn post_execute(&self, context: &PipelineContext) -> NotariResult<()> {
        // Verify manifest file was created
        let manifest_path = context.get_path("manifest_path")?;
        if !manifest_path.exists() {
            return Err(crate::error::NotariError::PipelineError(format!(
                "Manifest file was not created: {}",
                manifest_path.display()
            )));
        }

        // Verify signature is valid
        let manifest_json = context.get_required("manifest")?;
        let manifest: EvidenceManifest =
            serde_json::from_value(manifest_json.clone()).map_err(|e| {
                crate::error::NotariError::PipelineError(format!(
                    "Failed to deserialize manifest: {}",
                    e
                ))
            })?;

        if manifest.signature.signature.is_empty() {
            return Err(crate::error::NotariError::PipelineError(
                "Manifest signature is empty".to_string(),
            ));
        }

        // Verify signature
        if !manifest.verify_signature()? {
            return Err(crate::error::NotariError::PipelineError(
                "Manifest signature verification failed".to_string(),
            ));
        }

        LOGGER.log(
            LogLevel::Info,
            &format!(
                "Manifest signature verified successfully (session: {})",
                context.session_id()
            ),
            "pipeline::sign",
        );

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::evidence::{EvidenceManifestBuilder, HashInfo, SystemInfo};
    use chrono::Utc;
    use std::path::PathBuf;
    use tempfile::TempDir;
    use uuid::Uuid;

    fn create_test_manifest() -> EvidenceManifest {
        let now = Utc::now();
        let system_info = SystemInfo {
            os: "macOS".to_string(),
            os_version: "14.0".to_string(),
            device_id: "test-device".to_string(),
            hostname: "test-machine".to_string(),
            app_version: "0.1.0".to_string(),
            recorder: "notari".to_string(),
        };

        EvidenceManifestBuilder::new()
            .session_id(Uuid::new_v4())
            .file_path(PathBuf::from("/tmp/test.mov"))
            .file_hash(HashInfo::from_bytes(b"test data"))
            .file_size(1024)
            .duration(60.0)
            .window_title("Test Window")
            .window_id(123)
            .app_name("Test App")
            .app_bundle_id("com.test.app")
            .resolution("1920x1080")
            .frame_rate(30)
            .codec("h264")
            .system_info(system_info)
            .timestamps_from_dates(now, now)
            .build()
            .unwrap()
    }

    #[test]
    fn test_sign_stage_success() {
        // Clean up any existing key from previous test runs
        let _ = crate::evidence::keychain::delete_signing_key();

        let temp_dir = TempDir::new().unwrap();
        let manifest_path = temp_dir.path().join("manifest.json");

        let manifest = create_test_manifest();
        let manifest_json = serde_json::to_value(&manifest).unwrap();

        let mut context = PipelineContext::new("session-123");
        context.set("manifest", manifest_json);
        context.set_path("manifest_path", manifest_path.clone());

        let stage = SignStage::new();
        let result = stage.execute(&mut context);

        assert!(result.is_ok());
        assert!(manifest_path.exists());

        // Verify manifest has signature
        let manifest_json = context.get("manifest").unwrap();
        let signed_manifest: EvidenceManifest =
            serde_json::from_value(manifest_json.clone()).unwrap();
        assert!(!signed_manifest.signature.signature.is_empty());

        // Clean up
        let _ = crate::evidence::keychain::delete_signing_key();
    }

    #[test]
    fn test_sign_stage_missing_manifest() {
        let mut context = PipelineContext::new("session-123");
        context.set_path("manifest_path", PathBuf::from("/tmp/manifest.json"));

        let stage = SignStage::new();
        let result = stage.pre_execute(&context);

        assert!(result.is_err());
    }

    #[test]
    fn test_sign_stage_name() {
        let stage = SignStage::new();
        assert_eq!(stage.name(), "Sign Manifest");
    }

    #[test]
    fn test_sign_stage_estimated_duration() {
        let stage = SignStage::new();
        assert!(stage.estimated_duration().is_some());
        assert_eq!(
            stage.estimated_duration().unwrap(),
            Duration::from_millis(100)
        );
    }
}
