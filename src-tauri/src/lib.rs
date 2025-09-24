mod crypto;
mod commands;
mod capture;
mod storage;
mod ai;
mod redaction;
mod blockchain;

use commands::crypto::{self as crypto_commands, CryptoState};
use commands::capture::{self as capture_commands, init_capture_state};
use commands::session as session_commands;
use commands::ai::{self as ai_commands, init_ai_state};
use commands::proof_pack as proof_pack_commands;
use commands::redaction as redaction_commands;
use commands::blockchain::{self as blockchain_commands, init_blockchain_state};
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

async fn init_database() -> Database {
    let db_path = "notari.db";
    Database::new(db_path).await.expect("Failed to initialize database")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let rt = tokio::runtime::Runtime::new().expect("Failed to create Tokio runtime");
    let session_store = rt.block_on(init_session_store());
    let database = rt.block_on(init_database());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(CryptoState::default())
        .manage(init_capture_state())
        .manage(session_store)
        .manage(database)
        .manage(init_ai_state())
        .manage(init_blockchain_state())
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
            session_commands::mark_session_tampered,
            ai_commands::initialize_ai_processor,
            ai_commands::analyze_session_data,
            ai_commands::get_ai_processor_status,
            ai_commands::generate_work_summary,
            proof_pack_commands::get_system_context,
            proof_pack_commands::store_proof_pack_metadata,
            proof_pack_commands::get_proof_pack,
            redaction_commands::mark_for_redaction,
            redaction_commands::apply_redactions_backend,
            redaction_commands::generate_commitment_proof,
            redaction_commands::verify_commitment_proof,
            redaction_commands::validate_redaction_integrity_backend,
            redaction_commands::verify_redacted_pack,
            redaction_commands::get_redaction_capabilities,
            redaction_commands::generate_separate_hashes,
            blockchain_commands::initialize_blockchain_anchor,
            blockchain_commands::anchor_hash,
            blockchain_commands::anchor_batch,
            blockchain_commands::verify_anchor,
            blockchain_commands::generate_merkle_proof,
            blockchain_commands::verify_merkle_proof,
            blockchain_commands::get_supported_networks,
            blockchain_commands::get_network_stats,
            blockchain_commands::create_transaction_config,
            blockchain_commands::create_anchor_metadata,
            blockchain_commands::get_blockchain_status,
            blockchain_commands::estimate_transaction_cost
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
