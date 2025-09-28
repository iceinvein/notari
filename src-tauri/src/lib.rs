use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition,
};

mod window_manager;
mod recording_commands;
mod recording_manager;
mod dev_logger;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .manage(recording_commands::WindowManagerState::new())
        .manage(recording_commands::PopoverGuard::default())

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
            recording_commands::dev_log_add,
            recording_commands::dev_log_get,
            recording_commands::dev_log_clear,
            recording_commands::popover_guard_push,
            recording_commands::popover_guard_pop,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Initialize recording system
            let state = app.state::<recording_commands::WindowManagerState>();
            tauri::async_runtime::block_on(async {
                if let Err(e) = recording_commands::initialize_recording_system(state).await {
                    log::error!("Failed to initialize recording system: {}", e);
                }
            });

            // Start periodic health check for recordings
            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(5));

                    let state = app_handle.state::<recording_commands::WindowManagerState>();
                    tauri::async_runtime::block_on(async {
                        if let Err(e) = recording_commands::check_recording_health(state).await {
                            log::warn!("Recording health check failed: {}", e);
                        }
                    });
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
                                            } else if x + popover_width as f64 > monitor_size.width as f64 - 8.0 {
                                                x = monitor_size.width as f64 - popover_width as f64 - 8.0; // 8px margin from right edge
                                            }

                                            if y + popover_height as f64 > monitor_size.height as f64 - 8.0 {
                                                // If it would go below screen, position it above the cursor instead
                                                y = position.y - popover_height as f64 - 20.0;
                                            }

                                            let window_position = PhysicalPosition::new(x as i32, y as i32);
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
                    let guard = window.app_handle().state::<recording_commands::PopoverGuard>();
                    if guard.count() == 0 {
                        let _ = window.hide();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
