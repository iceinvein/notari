use rusqlite::{Connection, Result as SqliteResult};
use sqlx::{SqlitePool, migrate::MigrateDatabase, Sqlite};
use std::path::Path;
use tokio::sync::Mutex;
use std::sync::Arc;
use crate::storage::migrations;

#[derive(Clone)]
pub struct Database {
    pool: SqlitePool,
    connection: Arc<Mutex<Connection>>,
}

impl Database {
    pub async fn new(db_path: &str) -> Result<Self, Box<dyn std::error::Error>> {
        // Ensure database exists
        if !Sqlite::database_exists(db_path).await.unwrap_or(false) {
            Sqlite::create_database(db_path).await?;
        }

        // Create SQLx pool for async operations
        let pool = SqlitePool::connect(db_path).await?;
        
        // Create rusqlite connection for sync operations
        let connection = Arc::new(Mutex::new(Connection::open(db_path)?));

        let db = Database { pool, connection };
        
        // Run migrations
        db.run_migrations().await?;
        
        Ok(db)
    }

    pub async fn run_migrations(&self) -> Result<(), Box<dyn std::error::Error>> {
        migrations::run_migrations(&self.pool).await
    }

    pub fn get_pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub fn get_connection(&self) -> Arc<Mutex<Connection>> {
        self.connection.clone()
    }

    pub async fn close(&self) {
        self.pool.close().await;
    }
}