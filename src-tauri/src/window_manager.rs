use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub id: String,
    pub title: String,
    pub application: String,
    pub is_minimized: bool,
    pub bounds: WindowBounds,
    pub thumbnail: Option<String>, // Base64 encoded thumbnail
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PermissionStatus {
    pub granted: bool,
    pub can_request: bool,
    pub system_settings_required: bool,
    pub message: String,
}

pub trait WindowManager: Send {
    /// Check if screen recording permission is granted
    fn check_permission(&self) -> PermissionStatus;
    
    /// Request screen recording permission
    fn request_permission(&self) -> Result<bool, String>;
    
    /// Get list of available windows
    fn get_windows(&self) -> Result<Vec<WindowInfo>, String>;
    
    /// Get thumbnail for a specific window
    fn get_window_thumbnail(&self, window_id: &str) -> Result<Option<String>, String>;
    
    /// Open system settings for permission management
    fn open_system_settings(&self) -> Result<(), String>;
}

// Platform-specific implementations
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::MacOSWindowManager as PlatformWindowManager;

#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "windows")]
pub use windows::WindowsWindowManager as PlatformWindowManager;

#[cfg(target_os = "linux")]
mod linux;
#[cfg(target_os = "linux")]
pub use linux::LinuxWindowManager as PlatformWindowManager;

/// Create a platform-specific window manager instance
pub fn create_window_manager() -> Box<dyn WindowManager> {
    Box::new(PlatformWindowManager::new())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_window_manager_creation() {
        let manager = create_window_manager();
        let permission = manager.check_permission();
        println!("Permission status: {:?}", permission);
    }
}
