use chrono;
use rusqlite;
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::storage::database::Database;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemContext {
    #[serde(rename = "operatingSystem")]
    operating_system: String,
    platform: String,
    #[serde(rename = "deviceId")]
    device_id: String,
    timezone: String,
    locale: String,
    #[serde(rename = "screenResolution")]
    screen_resolution: ScreenResolution,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenResolution {
    width: u32,
    height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofPackMetadata {
    id: String,
    version: String,
    creator: String,
    created: i64,
    sessions: Vec<String>,
    #[serde(rename = "totalDuration")]
    total_duration: i64,
    title: Option<String>,
    description: Option<String>,
    tags: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TauriResponse<T> {
    success: bool,
    data: Option<T>,
    error: Option<String>,
}

impl<T> TauriResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }

    pub fn error(error: String) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(error),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProofPack {
    pub id: String,
    pub name: String,
    pub session_id: String,
    pub created_at: String,
    pub metadata: Option<ProofPackMetadata>,
}

#[tauri::command]
pub async fn get_system_context() -> Result<TauriResponse<SystemContext>, String> {
    let context = SystemContext {
        operating_system: std::env::consts::OS.to_string(),
        platform: std::env::consts::ARCH.to_string(),
        device_id: get_device_id(),
        timezone: get_timezone(),
        locale: get_locale(),
        screen_resolution: get_screen_resolution(),
    };

    Ok(TauriResponse::success(context))
}

#[tauri::command]
pub async fn store_proof_pack_metadata(
    proof_pack: serde_json::Value,
    db: State<'_, Database>,
) -> Result<TauriResponse<()>, String> {
    match store_proof_pack_metadata_impl(&proof_pack, &db).await {
        Ok(_) => Ok(TauriResponse::success(())),
        Err(e) => Ok(TauriResponse::error(e.to_string())),
    }
}

#[tauri::command]
pub async fn get_proof_pack(
    proof_pack_id: String,
    db: State<'_, Database>,
) -> Result<TauriResponse<serde_json::Value>, String> {
    match get_proof_pack_impl(&proof_pack_id, &db).await {
        Ok(Some(proof_pack)) => Ok(TauriResponse::success(proof_pack)),
        Ok(None) => Ok(TauriResponse::error("Proof Pack not found".to_string())),
        Err(e) => Ok(TauriResponse::error(e.to_string())),
    }
}

async fn store_proof_pack_metadata_impl(
    proof_pack: &serde_json::Value,
    db: &Database,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let conn = db.get_connection();

    // Extract metadata from the proof pack
    let id = proof_pack["id"].as_str().ok_or("Missing proof pack ID")?;
    let version = proof_pack["version"].as_str().ok_or("Missing version")?;
    let creator = proof_pack["metadata"]["creator"]
        .as_str()
        .ok_or("Missing creator")?;
    let created = proof_pack["metadata"]["created"]
        .as_i64()
        .ok_or("Missing created timestamp")?;
    let total_duration = proof_pack["metadata"]["totalDuration"]
        .as_i64()
        .unwrap_or(0);
    let title = proof_pack["metadata"]["title"].as_str();
    let description = proof_pack["metadata"]["description"].as_str();

    // Serialize sessions array
    let sessions_json = serde_json::to_string(&proof_pack["metadata"]["sessions"])?;

    // Store in database
    let conn = conn.lock().await;
    conn.execute(
        r#"
        INSERT OR REPLACE INTO proof_packs (
            id, version, creator, created, total_duration, title, description, 
            sessions, metadata_json, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        "#,
        rusqlite::params![
            id,
            version,
            creator,
            created,
            total_duration,
            title,
            description,
            sessions_json,
            serde_json::to_string(proof_pack)?,
            chrono::Utc::now().timestamp(),
            chrono::Utc::now().timestamp()
        ],
    )?;

    Ok(())
}

async fn get_proof_pack_impl(
    proof_pack_id: &str,
    db: &Database,
) -> Result<Option<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
    let conn = db.get_connection();

    let conn = conn.lock().await;
    let mut stmt = conn.prepare("SELECT metadata_json FROM proof_packs WHERE id = ?1")?;

    let result = stmt.query_row(rusqlite::params![proof_pack_id], |row| {
        let metadata_json: String = row.get(0)?;
        Ok(metadata_json)
    });

    match result {
        Ok(metadata_json) => {
            let proof_pack: serde_json::Value = serde_json::from_str(&metadata_json)?;
            Ok(Some(proof_pack))
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

fn get_device_id() -> String {
    // Generate a consistent device ID based on system characteristics
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};

    let mut hasher = DefaultHasher::new();

    // Hash system information to create a consistent device ID
    std::env::consts::OS.hash(&mut hasher);
    std::env::consts::ARCH.hash(&mut hasher);

    // Try to get hostname
    if let Ok(hostname) = hostname::get() {
        hostname.hash(&mut hasher);
    }

    format!("device_{:x}", hasher.finish())
}

fn get_timezone() -> String {
    // Try to get system timezone
    match iana_time_zone::get_timezone() {
        Ok(tz) => tz,
        Err(_) => "UTC".to_string(),
    }
}

fn get_locale() -> String {
    // Try to get system locale
    match sys_locale::get_locale() {
        Some(locale) => locale,
        None => "en-US".to_string(),
    }
}

fn get_screen_resolution() -> ScreenResolution {
    // This is a placeholder - actual implementation would use platform-specific APIs
    ScreenResolution {
        width: 1920,
        height: 1080,
    }
}
// Additional commands for tray integration and compatibility

#[tauri::command]
pub async fn get_all_proof_packs(
    db: State<'_, Database>,
) -> Result<Vec<ProofPack>, String> {
    match get_all_proof_packs_impl(&db).await {
        Ok(proof_packs) => Ok(proof_packs),
        Err(e) => Err(format!("Failed to get all proof packs: {}", e)),
    }
}

#[tauri::command]
pub async fn verify_proof_pack_integrity(
    proof_pack_id: String,
    db: State<'_, Database>,
) -> Result<bool, String> {
    match verify_proof_pack_integrity_impl(&proof_pack_id, &db).await {
        Ok(is_valid) => Ok(is_valid),
        Err(e) => Err(format!("Failed to verify proof pack integrity: {}", e)),
    }
}

#[tauri::command]
pub async fn flush_pending_proof_pack_data(
    db: State<'_, Database>,
) -> Result<(), String> {
    match flush_pending_proof_pack_data_impl(&db).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to flush pending proof pack data: {}", e)),
    }
}

async fn get_all_proof_packs_impl(
    db: &Database,
) -> Result<Vec<ProofPack>, Box<dyn std::error::Error + Send + Sync>> {
    let conn = db.get_connection();
    let conn = conn.lock().await;
    
    let mut stmt = conn.prepare(
        "SELECT id, title, sessions, created_at, metadata_json FROM proof_packs ORDER BY created_at DESC"
    )?;
    
    let proof_pack_iter = stmt.query_map([], |row| {
        let id: String = row.get(0)?;
        let title: Option<String> = row.get(1)?;
        let sessions_json: String = row.get(2)?;
        let created_at: i64 = row.get(3)?;
        let metadata_json: String = row.get(4)?;
        
        // Parse metadata to get session_id (use first session if available)
        let sessions: Vec<String> = serde_json::from_str(&sessions_json).unwrap_or_default();
        let session_id = sessions.first().cloned().unwrap_or_default();
        
        // Parse metadata
        let metadata: Option<ProofPackMetadata> = serde_json::from_str(&metadata_json).ok();
        
        Ok(ProofPack {
            id,
            name: title.unwrap_or_else(|| "Untitled Proof Pack".to_string()),
            session_id,
            created_at: chrono::DateTime::from_timestamp(created_at, 0)
                .unwrap_or_default()
                .to_rfc3339(),
            metadata,
        })
    })?;
    
    let mut proof_packs = Vec::new();
    for proof_pack in proof_pack_iter {
        proof_packs.push(proof_pack?);
    }
    
    Ok(proof_packs)
}

async fn verify_proof_pack_integrity_impl(
    proof_pack_id: &str,
    db: &Database,
) -> Result<bool, Box<dyn std::error::Error + Send + Sync>> {
    let conn = db.get_connection();
    let conn = conn.lock().await;
    
    // Check if proof pack exists in database
    let mut stmt = conn.prepare("SELECT COUNT(*) FROM proof_packs WHERE id = ?1")?;
    let count: i64 = stmt.query_row(rusqlite::params![proof_pack_id], |row| row.get(0))?;
    
    if count == 0 {
        return Ok(false);
    }
    
    // Additional integrity checks could be added here:
    // - Verify file existence
    // - Check cryptographic signatures
    // - Validate metadata consistency
    
    Ok(true)
}

async fn flush_pending_proof_pack_data_impl(
    db: &Database,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let conn = db.get_connection();
    let conn = conn.lock().await;
    
    // Update any pending proof pack operations
    // This is a placeholder - actual implementation would depend on specific requirements
    conn.execute("UPDATE proof_packs SET updated_at = ?1 WHERE updated_at IS NULL", 
                 rusqlite::params![chrono::Utc::now().timestamp()])?;
    
    Ok(())
}