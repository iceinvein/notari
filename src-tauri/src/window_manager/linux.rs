use super::{PermissionStatus, WindowBounds, WindowInfo, WindowManager};
use crate::error::{NotariError, NotariResult};
use std::collections::HashMap;

pub struct LinuxWindowManager;

impl LinuxWindowManager {
    pub fn new() -> Self {
        Self
    }

    fn is_wayland(&self) -> bool {
        std::env::var("WAYLAND_DISPLAY").is_ok()
    }

    fn is_x11(&self) -> bool {
        std::env::var("DISPLAY").is_ok()
    }

    #[cfg(feature = "x11")]
    fn get_x11_windows(&self) -> NotariResult<Vec<WindowInfo>> {
        use x11rb::connection::Connection;
        use x11rb::protocol::xproto::*;

        let (conn, screen_num) = x11rb::connect(None).map_err(|e| {
            NotariError::WindowEnumerationFailed(format!("Failed to connect to X11: {}", e))
        })?;

        let screen = &conn.setup().roots[screen_num];
        let root = screen.root;

        // Query for all windows
        let tree_reply = conn
            .query_tree(root)
            .map_err(|e| {
                NotariError::WindowEnumerationFailed(format!("Failed to query window tree: {}", e))
            })?
            .reply()
            .map_err(|e| {
                NotariError::WindowEnumerationFailed(format!("Failed to get tree reply: {}", e))
            })?;

        let mut windows = Vec::new();

        for &window in &tree_reply.children {
            // Get window attributes
            if let Ok(attrs) = conn
                .get_window_attributes(window)
                .and_then(|cookie| cookie.reply())
            {
                // Skip unmapped windows
                if attrs.map_state != MapState::VIEWABLE {
                    continue;
                }

                // Get window geometry
                let geometry = conn
                    .get_geometry(window)
                    .and_then(|cookie| cookie.reply())
                    .unwrap_or_else(|_| GeometryReply {
                        depth: 0,
                        root: 0,
                        x: 0,
                        y: 0,
                        width: 800,
                        height: 600,
                        border_width: 0,
                    });

                // Get window title (WM_NAME property)
                let title = conn
                    .get_property(false, window, AtomEnum::WM_NAME, AtomEnum::STRING, 0, 1024)
                    .and_then(|cookie| cookie.reply())
                    .ok()
                    .and_then(|reply| String::from_utf8(reply.value).ok())
                    .unwrap_or_else(|| format!("Window {}", window));

                let window_info = WindowInfo {
                    id: format!("x11_{}", window),
                    title,
                    application: "Unknown App".to_string(), // TODO: Get WM_CLASS
                    is_minimized: false,                    // TODO: Check _NET_WM_STATE
                    bounds: WindowBounds {
                        x: geometry.x as i32,
                        y: geometry.y as i32,
                        width: geometry.width as u32,
                        height: geometry.height as u32,
                    },
                    thumbnail: None,
                };

                windows.push(window_info);
            }
        }

        Ok(windows)
    }

    #[cfg(not(feature = "x11"))]
    fn get_x11_windows(&self) -> NotariResult<Vec<WindowInfo>> {
        Err(NotariError::DisplayServerNotSupported(
            "X11 support not compiled in".to_string(),
        ))
    }

    fn get_wayland_windows(&self) -> NotariResult<Vec<WindowInfo>> {
        // Wayland doesn't allow direct window enumeration for security reasons
        // We would need to use portals, which is more complex
        // For now, return an error suggesting the user use the portal-based approach
        Err(NotariError::DisplayServerNotSupported(
            "Wayland window enumeration requires portal support (not yet implemented)".to_string(),
        ))
    }
}

impl WindowManager for LinuxWindowManager {
    fn check_permission(&self) -> PermissionStatus {
        if self.is_wayland() {
            PermissionStatus {
                granted: false,
                can_request: true,
                system_settings_required: false,
                message: "Wayland requires portal-based screen capture. Permission will be requested when recording starts.".to_string(),
            }
        } else if self.is_x11() {
            PermissionStatus {
                granted: true,
                can_request: true,
                system_settings_required: false,
                message: "X11 screen capture is available.".to_string(),
            }
        } else {
            PermissionStatus {
                granted: false,
                can_request: false,
                system_settings_required: false,
                message: "No supported display server detected.".to_string(),
            }
        }
    }

    fn request_permission(&self) -> NotariResult<bool> {
        let status = self.check_permission();
        Ok(status.granted)
    }

    fn get_windows(&self) -> NotariResult<Vec<WindowInfo>> {
        if self.is_wayland() {
            self.get_wayland_windows()
        } else if self.is_x11() {
            self.get_x11_windows()
        } else {
            Err(NotariError::DisplayServerNotSupported(
                "No supported display server detected".to_string(),
            ))
        }
    }

    fn get_window_thumbnail(&self, _window_id: &str) -> NotariResult<Option<String>> {
        // TODO: Implement thumbnail generation
        Ok(None)
    }

    fn open_system_settings(&self) -> NotariResult<()> {
        // Linux doesn't have a unified settings app, but we could try to open
        // the desktop environment's settings
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_linux_window_manager() {
        let manager = LinuxWindowManager::new();
        let permission = manager.check_permission();
        println!("Linux permission status: {:?}", permission);

        println!("Wayland: {}", manager.is_wayland());
        println!("X11: {}", manager.is_x11());
    }
}
