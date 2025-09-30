use super::{PermissionStatus, WindowBounds, WindowInfo, WindowManager};
use std::collections::HashMap;
use windows::Win32::Foundation::{BOOL, HWND, LPARAM, RECT};
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetWindowRect, GetWindowTextW, IsWindowVisible,
};

pub struct WindowsWindowManager;

impl WindowsWindowManager {
    pub fn new() -> Self {
        Self
    }

    fn enumerate_windows(&self) -> Result<Vec<WindowInfo>, String> {
        let mut windows = Vec::new();

        unsafe {
            let windows_ptr = &mut windows as *mut Vec<WindowInfo>;

            EnumWindows(Some(enum_windows_proc), LPARAM(windows_ptr as isize))
                .map_err(|e| format!("Failed to enumerate windows: {}", e))?;
        }

        Ok(windows)
    }
}

unsafe extern "system" fn enum_windows_proc(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let windows = &mut *(lparam.0 as *mut Vec<WindowInfo>);

    // Skip invisible windows
    if IsWindowVisible(hwnd).as_bool() {
        // Get window title
        let mut title_buffer = [0u16; 256];
        let title_len = GetWindowTextW(hwnd, &mut title_buffer);
        let title = if title_len > 0 {
            String::from_utf16_lossy(&title_buffer[..title_len as usize])
        } else {
            "Untitled Window".to_string()
        };

        // Skip windows with empty titles or system windows
        if !title.is_empty() && !title.starts_with("Program Manager") {
            // Get window bounds
            let mut rect = RECT::default();
            let bounds = if GetWindowRect(hwnd, &mut rect).is_ok() {
                WindowBounds {
                    x: rect.left,
                    y: rect.top,
                    width: (rect.right - rect.left) as u32,
                    height: (rect.bottom - rect.top) as u32,
                }
            } else {
                WindowBounds {
                    x: 0,
                    y: 0,
                    width: 800,
                    height: 600,
                }
            };

            let window_info = WindowInfo {
                id: format!("windows_{}", hwnd.0),
                title,
                application: "Unknown App".to_string(), // TODO: Get actual app name
                is_minimized: false,                    // TODO: Check if minimized
                bounds,
                thumbnail: None,
            };

            windows.push(window_info);
        }
    }

    BOOL::from(true) // Continue enumeration
}

impl WindowManager for WindowsWindowManager {
    fn check_permission(&self) -> PermissionStatus {
        // On Windows 10 1903+, Graphics Capture API requires user consent per session
        // For now, we'll assume permission is available but requires user consent
        PermissionStatus {
            granted: true, // Windows doesn't require upfront permission like macOS
            can_request: true,
            system_settings_required: false,
            message: "Windows will request permission when you start recording.".to_string(),
        }
    }

    fn request_permission(&self) -> Result<bool, String> {
        // On Windows, permission is requested when starting capture
        // For now, we'll return true as the actual permission request
        // happens during the Graphics Capture API initialization
        Ok(true)
    }

    fn get_windows(&self) -> Result<Vec<WindowInfo>, String> {
        self.enumerate_windows()
    }

    fn get_window_thumbnail(&self, _window_id: &str) -> Result<Option<String>, String> {
        // TODO: Implement thumbnail generation using Windows APIs
        Ok(None)
    }

    fn open_system_settings(&self) -> Result<(), String> {
        // On Windows, we might open Privacy settings for screen capture
        // For now, this is a placeholder
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_windows_window_manager() {
        let manager = WindowsWindowManager::new();
        let permission = manager.check_permission();
        println!("Windows permission status: {:?}", permission);

        match manager.get_windows() {
            Ok(windows) => println!("Found {} windows", windows.len()),
            Err(e) => println!("Error getting windows: {}", e),
        }
    }
}
