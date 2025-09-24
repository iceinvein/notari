mod crypto;
mod commands;
mod capture;

use commands::crypto::{self as crypto_commands, CryptoState};
use commands::capture::{self as capture_commands, init_capture_state};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(CryptoState::default())
        .manage(init_capture_state())
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
            capture_commands::request_capture_permissions
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
