use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, PhysicalPosition,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

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
                // Hide the popover when it loses focus (click outside)
                if !is_focused && window.label() == "popover" {
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
