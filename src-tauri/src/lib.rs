mod crypto;
mod commands;
mod capture;
mod storage;

use commands::crypto::{self as crypto_commands, CryptoState};
use commands::capture::{self as capture_commands, init_capture_state};
use commands::session as session_commands;
use storage::{Database, SessionStore};
use crypto::CryptoManager;
use std::sync::Arc;
use tokio::sync::Mutex;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

async fn init_session_store() -> Arc<Mutex<SessionStore>> {
    let db_path = "notari.db";
    let database = Database::new(db_path).await.expect("Failed to initialize database");
    let crypto_manager = CryptoManager::new().expect("Failed to initialize crypto manager");
    let session_store = SessionStore::new(database, crypto_manager);
    Arc::new(Mutex::new(session_store))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
    let session_store = rt.block_on(init_session_store());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(CryptoState::default())
        .manage(init_capture_state())
        .manage(session_store)
        .invoke_handler(tauri::generate_handler![
            greet,
            crypto_commands::generate_device_key,
            crypto_commands::generate_keypair,
            crypto_commands::encrypt_data,
            crypto_commands::decrypt_data,
            crypto_commands::sign_data,
            crypto_commands::verify_signature,
            crypto_commands::hash_data,
            crypto_commands::store_key_in_keychain,
            crypto_commands::retrieve_key_from_keychain,
            crypto_commands::delete_key_from_keychain,
            crypto_commands::get_key_info,
            capture_commands::initialize_capture_engine,
            capture_commands::start_capture_session,
            capture_commands::stop_capture_session,
            capture_commands::pause_capture_session,
            capture_commands::resume_capture_session,
            capture_commands::get_session_status,
            capture_commands::check_capture_permissions,
            capture_commands::request_capture_permissions,
            session_commands::create_session,
            session_commands::get_session,
            session_commands::pause_session,
            session_commands::resume_session,
            session_commands::stop_session,
            session_commands::fail_session,
            session_commands::store_session_data,
            session_commands::verify_session_integrity,
            session_commands::get_user_sessions,
            session_commands::mark_session_tampered
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
