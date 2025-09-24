use sqlx::{SqlitePool, Row};

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    // Create migrations table if it doesn't exist
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY,
            version TEXT UNIQUE NOT NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Check current version
    let current_version = get_current_version(pool).await?;
    
    // Apply migrations in order
    if current_version < 1 {
        apply_migration_001(pool).await?;
        record_migration(pool, "001_initial_schema").await?;
    }

    Ok(())
}

async fn get_current_version(pool: &SqlitePool) -> Result<i32, Box<dyn std::error::Error>> {
    let row = sqlx::query("SELECT COUNT(*) as count FROM migrations")
        .fetch_one(pool)
        .await?;
    
    Ok(row.get::<i32, _>("count"))
}

async fn record_migration(pool: &SqlitePool, version: &str) -> Result<(), Box<dyn std::error::Error>> {
    sqlx::query("INSERT INTO migrations (version) VALUES (?)")
        .bind(version)
        .execute(pool)
        .await?;
    Ok(())
}

async fn apply_migration_001(pool: &SqlitePool) -> Result<(), Box<dyn std::error::Error>> {
    // Sessions table
    sqlx::query(
        r#"
        CREATE TABLE sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed', 'failed')),
            capture_config TEXT NOT NULL,
            encrypted_data_path TEXT,
            integrity_hash TEXT,
            tamper_evidence TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Proof packs table
    sqlx::query(
        r#"
        CREATE TABLE proof_packs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            version TEXT NOT NULL,
            metadata TEXT NOT NULL,
            evidence_hash TEXT NOT NULL,
            blockchain_anchor_id TEXT,
            redaction_data TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Proof pack sessions junction table
    sqlx::query(
        r#"
        CREATE TABLE proof_pack_sessions (
            proof_pack_id TEXT NOT NULL,
            session_id TEXT NOT NULL,
            PRIMARY KEY (proof_pack_id, session_id),
            FOREIGN KEY (proof_pack_id) REFERENCES proof_packs(id) ON DELETE CASCADE,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Blockchain anchors table
    sqlx::query(
        r#"
        CREATE TABLE blockchain_anchors (
            id TEXT PRIMARY KEY,
            network TEXT NOT NULL,
            transaction_id TEXT NOT NULL,
            block_number INTEGER,
            merkle_root TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            cost REAL,
            status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // User preferences table
    sqlx::query(
        r#"
        CREATE TABLE user_preferences (
            user_id TEXT PRIMARY KEY,
            preferences TEXT NOT NULL,
            device_keys TEXT,
            subscription_tier TEXT,
            organization_id TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Session integrity logs table
    sqlx::query(
        r#"
        CREATE TABLE session_integrity_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            event_data TEXT,
            timestamp INTEGER NOT NULL,
            signature TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create indexes for better performance
    sqlx::query("CREATE INDEX idx_sessions_user_id ON sessions(user_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX idx_sessions_status ON sessions(status)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX idx_proof_packs_user_id ON proof_packs(user_id)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX idx_blockchain_anchors_status ON blockchain_anchors(status)")
        .execute(pool)
        .await?;
    
    sqlx::query("CREATE INDEX idx_integrity_logs_session_id ON session_integrity_logs(session_id)")
        .execute(pool)
        .await?;

    Ok(())
}