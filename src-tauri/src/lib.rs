mod crypto;
mod commands;

use commands::crypto::{self as crypto_commands, CryptoState};

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
            crypto_commands::get_key_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
