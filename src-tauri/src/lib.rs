mod crypto;
mod commands;
mod capture;
mod storage;
mod ai;
mod redaction;
mod blockchain;
mod verification;
mod tray;
mod window;
mod hotkey;
mod notifications;

use commands::crypto::{self as crypto_commands, CryptoState};
use commands::capture::{self as capture_commands, init_capture_state};
use commands::session as session_commands;
use commands::ai::{self as ai_commands, init_ai_state};
use commands::proof_pack as proof_pack_commands;
use commands::redaction as redaction_commands;
use commands::blockchain::{self as blockchain_commands, init_blockchain_state};
use commands::verification::{self as verification_commands, init_verification_state};
use commands::tray::{self as tray_commands, init_tray_state};
use commands::popover::{self as popover_commands, init_popover_state};
use commands::hotkey::{self as hotkey_commands, init_hotkey_state};
use commands::notifications::{self as notification_commands, init_notification_state};
use commands::compatibility as compatibility_commands;
use storage::{Database, SessionStore};
use crypto::CryptoManager;
use std::sync::Arc;
use tokio::sync::Mutex;
use tauri::Manager;

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

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .manage(CryptoState::default())
        .manage(init_capture_state())
        .manage(session_store)
        .manage(database)
        .manage(init_ai_state())
        .manage(init_blockchain_state())
        .manage(init_verification_state())
        .setup(|app| {
            // Initialize tray-based UI components
            let tray_state = init_tray_state(app.handle().clone());
            app.manage(tray_state.clone());
            
            let popover_state = init_popover_state(app.handle().clone());
            app.manage(popover_state);
            
            let hotkey_state = init_hotkey_state(app.handle().clone());
            app.manage(hotkey_state);
            
            let notification_state = init_notification_state(app.handle().clone());
            app.manage(notification_state);
            
            // Initialize the tray on startup
            if let Ok(mut tray_manager) = tray_state.lock() {
                if let Err(e) = tray_manager.setup_tray() {
                    eprintln!("Failed to setup tray: {}", e);
                    // Fall back to showing main window if tray setup fails
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
            
            Ok(())
        })
        .on_menu_event(|app, event| {
            if let Some(tray_state) = app.try_state::<tray_commands::TrayManagerState>() {
                if let Ok(tray_manager) = tray_state.lock() {
                    tray_manager.handle_menu_item_click(event.id().as_ref());
                }
            }
        })
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
            session_commands::flush_pending_session_data,
            ai_commands::initialize_ai_processor,
            ai_commands::analyze_session_data,
            ai_commands::get_ai_processor_status,
            ai_commands::generate_work_summary,
            proof_pack_commands::get_system_context,
            proof_pack_commands::store_proof_pack_metadata,
            proof_pack_commands::get_proof_pack,
            proof_pack_commands::get_all_proof_packs,
            proof_pack_commands::verify_proof_pack_integrity,
            proof_pack_commands::flush_pending_proof_pack_data,
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
            blockchain_commands::estimate_transaction_cost,
            verification_commands::initialize_verification_engine,
            verification_commands::verify_proof_pack,
            verification_commands::batch_verify_proof_packs,
            verification_commands::start_async_verification,
            verification_commands::get_verification_status,
            verification_commands::generate_verification_merkle_proof,
            verification_commands::get_verification_analytics,
            verification_commands::get_proof_pack_verification_history,
            verification_commands::get_verification_stats,
            verification_commands::get_verification_audit_trail,
            verification_commands::generate_verification_report,
            verification_commands::cleanup_verification_data,
            verification_commands::get_verification_engine_status,
            tray_commands::initialize_tray,
            tray_commands::update_tray_icon,
            tray_commands::update_tray_from_session_status,
            tray_commands::get_tray_state,
            tray_commands::update_tray_menu_for_session,
            tray_commands::update_tray_tooltip,
            tray_commands::show_tray_notification,
            tray_commands::handle_tray_click,
            tray_commands::destroy_tray,
            tray_commands::show_main_window,
            tray_commands::create_fallback_window,
            tray_commands::request_tray_permissions,
            tray_commands::show_system_notification,
            popover_commands::show_popover,
            popover_commands::hide_popover,
            popover_commands::toggle_popover,
            popover_commands::get_popover_status,
            popover_commands::update_popover_config,
            popover_commands::calculate_popover_position,
            popover_commands::destroy_popover,
            hotkey_commands::register_hotkey,
            hotkey_commands::unregister_hotkey,
            hotkey_commands::update_hotkey,
            hotkey_commands::get_registered_hotkeys,
            hotkey_commands::validate_hotkey_string,
            hotkey_commands::is_hotkey_registered,
            hotkey_commands::get_default_hotkey_config,
            hotkey_commands::unregister_all_hotkeys,
            notification_commands::update_notification_preferences,
            notification_commands::get_notification_preferences,
            notification_commands::notify_session_start,
            notification_commands::notify_session_stop,
            notification_commands::notify_proof_pack_created,
            notification_commands::notify_blockchain_anchor,
            notification_commands::notify_error,
            notification_commands::notify_warning,
            notification_commands::get_notification_history,
            notification_commands::process_notification_queue,
            notification_commands::clear_notification_queue,
            notification_commands::get_notification_queue_size,
            compatibility_commands::check_tray_migration_status,
            compatibility_commands::migrate_legacy_settings_for_tray,
            compatibility_commands::migrate_legacy_session_data,
            compatibility_commands::migrate_legacy_proof_pack_data,
            compatibility_commands::mark_tray_migration_complete
        ]);

    app.run(tauri::generate_context!())
        .expect("error while running tauri application");
}
