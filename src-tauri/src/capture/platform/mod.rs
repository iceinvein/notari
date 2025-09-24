#[cfg(target_os = "windows")]
pub mod windows;

#[cfg(target_os = "macos")]
pub mod macos;

#[cfg(target_os = "linux")]
pub mod linux;

use crate::capture::types::*;
use async_trait::async_trait;

#[async_trait]
pub trait PlatformCapture: Send + Sync {
    /// Initialize the platform capture system
    async fn initialize(&mut self) -> CaptureResult<()>;
    
    /// Start screen capture
    async fn start_screen_capture(&mut self, config: &CaptureQuality) -> CaptureResult<()>;
    
    /// Stop screen capture
    async fn stop_screen_capture(&mut self) -> CaptureResult<()>;
    
    /// Capture a single screen frame
    async fn capture_screen_frame(&self) -> CaptureResult<CaptureEventType>;
    
    /// Start input monitoring
    async fn start_input_monitoring(&mut self, filters: &[PrivacyFilter]) -> CaptureResult<()>;
    
    /// Stop input monitoring
    async fn stop_input_monitoring(&mut self) -> CaptureResult<()>;
    
    /// Check if the platform has required permissions
    async fn check_permissions(&self) -> CaptureResult<PermissionStatus>;
    
    /// Request required permissions
    async fn request_permissions(&self) -> CaptureResult<()>;
}

#[derive(Debug, Clone)]
pub struct PermissionStatus {
    pub screen_capture: bool,
    pub input_monitoring: bool,
    pub accessibility: bool,
}

/// Create platform-specific capture implementation
pub fn create_platform_capture() -> CaptureResult<Box<dyn PlatformCapture>> {
    #[cfg(target_os = "windows")]
    {
        Ok(Box::new(windows::WindowsCapture::new()?))
    }
    
    #[cfg(target_os = "macos")]
    {
        Ok(Box::new(macos::MacOSCapture::new()?))
    }
    
    #[cfg(target_os = "linux")]
    {
        Ok(Box::new(linux::LinuxCapture::new()?))
    }
    
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err(CaptureError::PlatformNotSupported(
            std::env::consts::OS.to_string()
        ))
    }
}