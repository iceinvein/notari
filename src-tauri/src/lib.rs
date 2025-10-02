use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition,
};

mod blockchain_commands;
pub mod error;
pub mod evidence;
mod logger;
mod recording_commands;
mod recording_manager;
mod storage;
mod video_server;
mod window_manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .register_asynchronous_uri_scheme_protocol("stream", video_server::handle_stream_protocol)
        .manage(recording_commands::WindowManagerState::new())
        .manage(recording_commands::PopoverGuard::default())
        .manage(blockchain_commands::BlockchainState::new())
        .invoke_handler(tauri::generate_handler![
            recording_commands::check_recording_permission,
            recording_commands::request_recording_permission,
            recording_commands::get_available_windows,
            recording_commands::get_window_thumbnail,
            recording_commands::open_system_settings,
            recording_commands::start_window_recording,
            recording_commands::stop_recording,
            recording_commands::get_recording_status,
            recording_commands::get_recording_info,
            recording_commands::get_recording_preferences,
            recording_commands::update_recording_preferences,
            recording_commands::get_default_save_directory,
            recording_commands::validate_save_directory,
            recording_commands::select_save_directory,
            recording_commands::check_recording_health,
            recording_commands::cleanup_orphaned_recordings,
            recording_commands::pause_recording,
            recording_commands::resume_recording,
            recording_commands::get_active_recording_session,
            recording_commands::has_active_recording,
            recording_commands::clear_active_recording,
            recording_commands::initialize_recording_system,
            recording_commands::shutdown_recording_system,
            recording_commands::validate_recording_window,
            recording_commands::get_recording_system_status,
            recording_commands::log_add,
            recording_commands::log_get,
            recording_commands::log_clear,
            recording_commands::log_set_min_level,
            recording_commands::log_get_min_level,
            recording_commands::verify_recording,
            recording_commands::verify_recording_deep,
            recording_commands::get_evidence_manifest,
            recording_commands::export_public_key,
            recording_commands::has_signing_key,
            recording_commands::generate_signing_key,
            recording_commands::encrypt_video,
            recording_commands::decrypt_video,
            recording_commands::validate_encryption_password,
            recording_commands::read_file,
            recording_commands::delete_file,
            recording_commands::list_recordings,
            recording_commands::update_recording_metadata,
            recording_commands::open_file_in_default_app,
            recording_commands::decrypt_and_play_video,
            recording_commands::create_proof_pack,
            recording_commands::extract_proof_pack,
            recording_commands::popover_guard_push,
            recording_commands::popover_guard_pop,
            recording_commands::start_video_playback,
            recording_commands::stop_video_playback,
            recording_commands::get_video_chunk,
            recording_commands::get_video_metadata,
            recording_commands::test_video_server,
            blockchain_commands::get_blockchain_config,
            blockchain_commands::set_blockchain_config,
            blockchain_commands::get_available_chains,
            blockchain_commands::validate_private_key,
            blockchain_commands::derive_address,
            blockchain_commands::store_private_key,
            blockchain_commands::get_stored_address,
            blockchain_commands::delete_private_key,
            blockchain_commands::has_private_key,
            blockchain_commands::get_balance,
            blockchain_commands::estimate_anchor_cost,
            blockchain_commands::test_connection,
            blockchain_commands::anchor_recording,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize storage
            storage::init_storage(app.handle().clone());

            // Load blockchain config from storage
            let blockchain_state = app.state::<blockchain_commands::BlockchainState>();
            if let Ok(config) = storage::get_storage().load_blockchain_config() {
                if let Some(loaded_config) = config {
                    if let Ok(mut config_lock) = blockchain_state.config.lock() {
                        *config_lock = Some(loaded_config);
                        app_log!(logger::LogLevel::Info, "Loaded blockchain configuration from storage");
                    }
                }
            }

            // Load mock anchors from storage
            evidence::blockchain::MockAnchorer::load_from_storage();

            // Load recording preferences from storage
            let recording_state = app.state::<recording_commands::WindowManagerState>();
            if let Ok(prefs) = storage::get_storage().load_recording_preferences() {
                if let Some(loaded_prefs) = prefs {
                    if let Ok(mut state_lock) = recording_state.recording_state.lock() {
                        state_lock.preferences = loaded_prefs;
                        app_log!(logger::LogLevel::Info, "Loaded recording preferences from storage");
                    }
                }
            }

            // Initialize recording system
            tauri::async_runtime::block_on(async {
                if let Err(e) = recording_commands::initialize_recording_system(recording_state).await {
                    app_log!(logger::LogLevel::Error, "Failed to initialize recording system: {}", e);
                }
            });

            // Start periodic health check for recordings using async task
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));
                loop {
                    interval.tick().await;

                    let state = app_handle.state::<recording_commands::WindowManagerState>();
                    if let Err(e) = recording_commands::check_recording_health(state).await {
                        app_log!(logger::LogLevel::Warn, "Recording health check failed: {}", e);
                    }
                }
            });

            // Create the tray menu
            let quit_item = MenuItem::with_id(app, "quit", "Quit Notari", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_item])?;

            // Create the tray icon
            let _tray = TrayIconBuilder::with_id("main-tray")
                .tooltip("Notari")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_tray_icon_event(|tray, event| {
                    match event {
                        TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            position,
                            ..
                        } => {
                            // Left click - show/hide popover
                            let app = tray.app_handle();
                            if let Some(popover_window) = app.get_webview_window("popover") {
                                if popover_window.is_visible().unwrap_or(false) {
                                    let _ = popover_window.hide();
                                } else {
                                    // Position the popover window near the cursor (where the tray was clicked)
                                    if let Ok(current_monitor) = popover_window.current_monitor() {
                                        if let Some(monitor) = current_monitor {
                                            let monitor_size = monitor.size();
                                            let popover_width = 360;
                                            let popover_height = 500;

                                            // Position the popover below and to the left of the cursor position
                                            let mut x = position.x - (popover_width as f64 / 2.0);
                                            let mut y = position.y + 20.0; // 20px below cursor

                                            // Ensure the popover doesn't go off-screen
                                            if x < 8.0 {
                                                x = 8.0; // 8px margin from left edge
                                            } else if x + popover_width as f64
                                                > monitor_size.width as f64 - 8.0
                                            {
                                                x = monitor_size.width as f64
                                                    - popover_width as f64
                                                    - 8.0; // 8px margin from right edge
                                            }

                                            if y + popover_height as f64
                                                > monitor_size.height as f64 - 8.0
                                            {
                                                // If it would go below screen, position it above the cursor instead
                                                y = position.y - popover_height as f64 - 20.0;
                                            }

                                            let window_position =
                                                PhysicalPosition::new(x as i32, y as i32);
                                            let _ = popover_window.set_position(window_position);
                                        }
                                    }
                                    let _ = popover_window.show();
                                    let _ = popover_window.set_focus();
                                }
                            }
                        }
                        _ => {
                            // Handle other events (right-click will show menu automatically)
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id() == "quit" {
                app.exit(0);
            }
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Focused(is_focused) = event {
                if !is_focused && window.label() == "popover" {
                    // Auto-hide popover on blur only when no dialogs are active
                    let guard = window
                        .app_handle()
                        .state::<recording_commands::PopoverGuard>();
                    if guard.count() == 0 {
                        let _ = window.hide();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
