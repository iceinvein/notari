use serde::{Deserialize, Serialize};
use tauri::State;
use crate::storage::Database;

#[derive(Debug, Serialize, Deserialize)]
pub struct MigrationStatus {
    pub is_required: bool,
    pub version: String,
}

#[tauri::command]
pub async fn check_tray_migration_status(
    db: State<'_, Database>,
) -> Result<MigrationStatus, String> {
    match check_migration_status_impl(&db).await {
        Ok(status) => Ok(status),
        Err(e) => Err(format!("Failed to check migration status: {}", e)),
    }
}

#[tauri::command]
pub async fn migrate_legacy_settings_for_tray(
    db: State<'_, Database>,
) -> Result<(), String> {
    match migrate_legacy_settings_impl(&db).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to migrate legacy settings: {}", e)),
    }
}

#[tauri::command]
pub async fn migrate_legacy_session_data(
    db: State<'_, Database>,
) -> Result<(), String> {
    match migrate_session_data_impl(&db).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to migrate legacy session data: {}", e)),
    }
}

#[tauri::command]
pub async fn migrate_legacy_proof_pack_data(
    db: State<'_, Database>,
) -> Result<(), String> {
    match migrate_proof_pack_data_impl(&db).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to migrate legacy proof pack data: {}", e)),
    }
}

#[tauri::command]
pub async fn mark_tray_migration_complete(
    db: State<'_, Database>,
) -> Result<(), String> {
    match mark_migration_complete_impl(&db).await {
        Ok(_) => Ok(()),
        Err(e) => Err(format!("Failed to mark migration complete: {}", e)),
    }
}

async fn check_migration_status_impl(
    db: &Database,
) -> Result<MigrationStatus, Box<dyn std::error::Error + Send + Sync>> {
    let conn = db.get_connection();
    let conn = conn.lock().await;
    
    // Check if migration table exists
    let table_exists: bool = conn.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'")
        .and_then(|mut stmt| {
            stmt.query_row([], |_| Ok(true))
        })
        .unwrap_or(false);
    
    if !table_exists {
        // Create migrations table
        conn.execute(
            "CREATE TABLE IF NOT EXISTS migrations (
                id INTEGER PRIMARY KEY,
                version TEXT NOT NULL,
                applied_at INTEGER NOT NULL,
                description TEXT
            )",
            [],
        )?;
        
        return Ok(MigrationStatus {
            is_required: true,
            version: "1.0.0".to_string(),
        });
    }
    
    // Check if tray migration has been applied
    let migration_exists: bool = conn.prepare("SELECT COUNT(*) FROM migrations WHERE version = 'tray-integration-1.0'")
        .and_then(|mut stmt| {
            stmt.query_row([], |row| {
                let count: i64 = row.get(0)?;
                Ok(count > 0)
            })
        })
        .unwrap_or(false);
    
    Ok(MigrationStatus {
        is_required: !migration_exists,
        version: "tray-integration-1.0".to_string(),
    })
}

async fn migrate_legacy_settings_impl(
    db: &Database,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let conn = db.get_connection();
    let conn = conn.lock().await;
    
    // Create settings table if it doesn't exist
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;
    
    // Add default tray settings
    let now = chrono::Utc::now().timestamp();
    
    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "tray.enabled",
            "true",
            now,
            now
        ],
    )?;
    
    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "tray.hotkey",
            "CmdOrCtrl+Shift+N",
            now,
            now
        ],
    )?;
    
    conn.execute(
        "INSERT OR IGNORE INTO settings (key, value, created_at, updated_at) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "tray.notifications",
            "true",
            now,
            now
        ],
    )?;
    
    Ok(())
}

async fn migrate_session_data_impl(
    db: &Database,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let conn = db.get_connection();
    let conn = conn.lock().await;
    
    // Add any missing columns to sessions table for tray compatibility
    let _ = conn.execute(
        "ALTER TABLE sessions ADD COLUMN tray_compatible INTEGER DEFAULT 1",
        [],
    );
    
    // Update existing sessions to be tray compatible
    conn.execute(
        "UPDATE sessions SET tray_compatible = 1 WHERE tray_compatible IS NULL",
        [],
    )?;
    
    Ok(())
}

async fn migrate_proof_pack_data_impl(
    db: &Database,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let conn = db.get_connection();
    let conn = conn.lock().await;
    
    // Add any missing columns to proof_packs table for tray compatibility
    let _ = conn.execute(
        "ALTER TABLE proof_packs ADD COLUMN tray_compatible INTEGER DEFAULT 1",
        [],
    );
    
    // Update existing proof packs to be tray compatible
    conn.execute(
        "UPDATE proof_packs SET tray_compatible = 1 WHERE tray_compatible IS NULL",
        [],
    )?;
    
    Ok(())
}

async fn mark_migration_complete_impl(
    db: &Database,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let conn = db.get_connection();
    let conn = conn.lock().await;
    
    let now = chrono::Utc::now().timestamp();
    
    conn.execute(
        "INSERT OR REPLACE INTO migrations (version, applied_at, description) VALUES (?1, ?2, ?3)",
        rusqlite::params![
            "tray-integration-1.0",
            now,
            "Migration to support tray-based UI integration"
        ],
    )?;
    
    Ok(())
}