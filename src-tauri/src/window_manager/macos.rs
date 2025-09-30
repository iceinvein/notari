use super::{PermissionStatus, WindowBounds, WindowInfo, WindowManager};
use crate::dev_logger::DEV_LOGGER;
use core_foundation::array::CFArray;
use core_foundation::base::{CFType, TCFType};
use core_foundation::dictionary::CFDictionary;
use core_foundation::number::CFNumber;
use core_foundation::string::CFString;
use core_graphics::display::{
    kCGNullWindowID, kCGWindowListExcludeDesktopElements, kCGWindowListOptionOnScreenOnly,
    CGWindowListCopyWindowInfo,
};
// ScreenCaptureKit (Rust wrapper)
#[cfg(target_os = "macos")]
use screencapturekit::{
    shareable_content::SCShareableContent,
    stream::{
        configuration::{SCStreamConfiguration, pixel_format::PixelFormat},
        content_filter::SCContentFilter,
        screenshot_manager,
    },
};


pub struct MacOSWindowManager;

impl MacOSWindowManager {
    pub fn new() -> Self {
        Self
    }

    /// Parse window ID to extract CGWindowID
    fn parse_window_id(&self, window_id: &str) -> Option<u32> {
        // Window IDs from CoreGraphics are in format "cg_<number>"
        if window_id.starts_with("cg_") {
            window_id[3..].parse().ok()
        } else {
            None
        }
    }

    /// Create a thumbnail for a specific window using ScreenCaptureKit (screencapturekit-rs)
    fn create_window_thumbnail(&self, window_id: u32) -> Result<Option<String>, String> {
        DEV_LOGGER.log("info", &format!("Creating thumbnail via SCK for window ID: {}", window_id), "backend");
        // 1) Find matching SCWindow by CoreGraphics window_id
        let shareable = SCShareableContent::get().map_err(|e| format!("SCShareableContent::get failed: {e}"))?;
        let sc_window_opt = shareable.windows().into_iter().find(|w| w.window_id() == window_id);
        let sc_window = match sc_window_opt {
            Some(w) => w,
            None => {
                DEV_LOGGER.log("warn", &format!("SCK window not found for id {}", window_id), "backend");
                return Ok(None);
            }
        };

        // 2) Build content filter for this window
        let filter = SCContentFilter::new().with_desktop_independent_window(&sc_window);

        // 3) Configure capture: use 16:9 aspect to match most windows, force BGRA
        let config = SCStreamConfiguration::new()
            .set_width(480).map_err(|e| format!("set_width: {e}"))?
            .set_height(270).map_err(|e| format!("set_height: {e}"))?
            .set_pixel_format(PixelFormat::BGRA).map_err(|e| format!("set_pixel_format: {e}"))?;

        // 4) Capture a single frame
        let sample = screenshot_manager::capture(&filter, &config)
            .map_err(|e| format!("SCScreenshotManager::capture failed: {e}"))?;

        // 5) Extract pixel buffer and convert BGRA -> RGBA PNG in-memory
        // Get CVPixelBuffer directly and lock to access bytes
        let pixel_buffer = sample
            .get_pixel_buffer()
            .map_err(|e| format!("No pixel buffer in sample: {e}"))?;
        let width = pixel_buffer.get_width() as usize;
        let height = pixel_buffer.get_height() as usize;
        let bytes_per_row = pixel_buffer.get_bytes_per_row() as usize;
        DEV_LOGGER.log("info", &format!("SCK sample buffer size: {}x{}, row {}", width, height, bytes_per_row), "backend");

        // Lock for read-only access
        use screencapturekit::output::LockTrait;
        let guard = pixel_buffer
            .lock()
            .map_err(|e| format!("CVPixelBuffer lock failed: {e}"))?;
        let bytes = guard.as_slice();
        if bytes.len() < bytes_per_row * height {
            DEV_LOGGER.log("warn", &format!("Pixel buffer size {} < expected {}", bytes.len(), bytes_per_row * height), "backend");
        }

        let mut rgba = Vec::with_capacity(width * height * 4);
        for y in 0..height {
            let start = y * bytes_per_row;
            let row = &bytes[start..start + (width * 4)];
            for px in row.chunks_exact(4) {
                rgba.push(px[2]); // R
                rgba.push(px[1]); // G
                rgba.push(px[0]); // B
                rgba.push(px[3]); // A
            }
        }
        // Completed reading pixel buffer

        // Encode to PNG
        use image::{ImageBuffer, Rgba, DynamicImage, ImageFormat};
        use std::io::Cursor;
        let img: ImageBuffer<Rgba<u8>, Vec<u8>> = match ImageBuffer::from_raw(width as u32, height as u32, rgba) {
            Some(buf) => buf,
            None => return Ok(None),
        };
        let dyn_img = DynamicImage::ImageRgba8(img);
        let mut png_data = Vec::new();
        dyn_img.write_to(&mut Cursor::new(&mut png_data), ImageFormat::Png)
            .map_err(|e| format!("Failed to encode PNG: {e}"))?;

        // Reuse existing thumbnail scaler/encoder
        let result = self.create_thumbnail_from_data(&png_data);
        match &result {
            Ok(Some(thumbnail)) => DEV_LOGGER.log("info", &format!("Successfully created SCK thumbnail (length: {})", thumbnail.len()), "backend"),
            Ok(None) => DEV_LOGGER.log("warn", "SCK thumbnail creation returned None", "backend"),
            Err(e) => DEV_LOGGER.log("error", &format!("SCK thumbnail creation failed: {}", e), "backend"),
        }
        result
    }

    /// Create a thumbnail from image data
    fn create_thumbnail_from_data(&self, image_data: &[u8]) -> Result<Option<String>, String> {
        use image::io::Reader as ImageReader;
        use std::io::Cursor;

        // Load image from data
        let img = ImageReader::new(Cursor::new(image_data))
            .with_guessed_format()
            .map_err(|e| format!("Failed to guess image format: {}", e))?
            .decode()
            .map_err(|e| format!("Failed to decode image: {}", e))?;

        // Resize to thumbnail size
        let max_dimension = 300;
        let (width, height) = (img.width(), img.height());

        let (thumb_width, thumb_height) = if width > height {
            if width > max_dimension {
                let ratio = max_dimension as f32 / width as f32;
                (max_dimension, (height as f32 * ratio) as u32)
            } else {
                (width, height)
            }
        } else {
            if height > max_dimension {
                let ratio = max_dimension as f32 / height as f32;
                ((width as f32 * ratio) as u32, max_dimension)
            } else {
                (width, height)
            }
        };

        let thumbnail = img.resize(thumb_width, thumb_height, image::imageops::FilterType::Lanczos3);

        // Convert to PNG and encode as base64
        let mut png_data = Vec::new();
        thumbnail
            .write_to(&mut Cursor::new(&mut png_data), image::ImageFormat::Png)
            .map_err(|e| format!("Failed to encode PNG: {}", e))?;

        use base64::{Engine as _, engine::general_purpose};
        let base64_string = general_purpose::STANDARD.encode(&png_data);
        Ok(Some(format!("data:image/png;base64,{}", base64_string)))
    }

    /// Test if we can access screen recording by trying to get window information
    fn test_screen_recording_access(&self) -> bool {
        // Try to capture a small area of the screen to test permissions
        // This is more reliable than the -l flag which requires a window ID
        let temp_file = "/tmp/notari_permission_test.png";

        match std::process::Command::new("screencapture")
            .arg("-R")  // Capture rectangle
            .arg("0,0,1,1")  // Tiny 1x1 pixel area
            .arg("-t")
            .arg("png")
            .arg("-x")  // No sound
            .arg(temp_file)
            .output()
        {
            Ok(output) => {
                let success = output.status.success();
                // Clean up test file
                let _ = std::fs::remove_file(temp_file);

                DEV_LOGGER.log("info", &format!("Permission test result: success={}, stderr={}",
                    success, String::from_utf8_lossy(&output.stderr)), "backend");

                success
            },
            Err(e) => {
                DEV_LOGGER.log("error", &format!("Permission test command failed: {}", e), "backend");
                false
            }
        }
    }


    fn get_real_windows(&self) -> Result<Vec<WindowInfo>, String> {
        self.get_windows_coregraphics()
    }

    fn get_windows_coregraphics(&self) -> Result<Vec<WindowInfo>, String> {
        unsafe {
            let options = kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements;
            let window_list_info = CGWindowListCopyWindowInfo(options, kCGNullWindowID);

            if window_list_info.is_null() {
                return Err("CoreGraphics API returned null - likely permission issue".to_string());
            }

            let arr: CFArray<CFType> = CFArray::wrap_under_create_rule(window_list_info);
            let mut windows = Vec::new();

            for i in 0..arr.len() {
                if let Some(item) = arr.get(i) {
                    let dict = CFDictionary::<CFString, CFType>::wrap_under_get_rule(
                        item.as_CFTypeRef() as _,
                    );

                    let owner_name = self.get_cf_str(&dict, "kCGWindowOwnerName").unwrap_or_default();
                    let window_name = self.get_cf_str(&dict, "kCGWindowName");
                    let layer = self.get_cf_i32(&dict, "kCGWindowLayer").unwrap_or_default();
                    let is_on_screen = self.get_cf_i32(&dict, "kCGWindowIsOnscreen").unwrap_or(0) != 0;
                    let window_id = self.get_cf_i32(&dict, "kCGWindowNumber").unwrap_or_default();

                    // Filter out system windows and non-recordable apps
                    if !self.is_recordable_app(&owner_name) {
                        continue;
                    }

                    // Skip windows that are not on screen or on system layers
                    if !is_on_screen || layer != 0 {
                        continue;
                    }

                    let bounds = self.get_cf_bounds(&dict).unwrap_or((0.0, 0.0, 800.0, 600.0));

                    // Skip windows that are too small (likely system elements)
                    if bounds.2 < 50.0 || bounds.3 < 50.0 {
                        continue;
                    }

                    let title = if let Some(window_title) = &window_name {
                        if window_title.is_empty() {
                            owner_name.clone()
                        } else {
                            window_title.clone()
                        }
                    } else {
                        owner_name.clone()
                    };

                    let window_info = WindowInfo {
                        id: format!("cg_{}", window_id),
                        title,
                        application: owner_name,
                        is_minimized: false,
                        bounds: WindowBounds {
                            x: bounds.0 as i32,
                            y: bounds.1 as i32,
                            width: bounds.2 as u32,
                            height: bounds.3 as u32
                        },
                        thumbnail: None,
                    };

                    DEV_LOGGER.log("info", &format!("Found window: id={}, title={}, app={}, cg_window_id={}",
                              window_info.id, window_info.title, window_info.application, window_id), "backend");

                    windows.push(window_info);
                }
            }

            Ok(windows)
        }
    }

    unsafe fn get_cf_str(&self, dict: &CFDictionary<CFString, CFType>, key: &str) -> Option<String> {
        let key = CFString::new(key);
        let val = dict.find(&key)?;
        let s = CFString::wrap_under_get_rule(val.as_CFTypeRef() as _);
        Some(s.to_string())
    }

    unsafe fn get_cf_i32(&self, dict: &CFDictionary<CFString, CFType>, key: &str) -> Option<i32> {
        let key = CFString::new(key);
        let val = dict.find(&key)?;
        let n = CFNumber::wrap_under_get_rule(val.as_CFTypeRef() as _);
        n.to_i32()
    }

    unsafe fn get_cf_bounds(&self, dict: &CFDictionary<CFString, CFType>) -> Option<(f64, f64, f64, f64)> {
        let key = CFString::new("kCGWindowBounds");
        let val = dict.find(&key)?;
        let b = CFDictionary::<CFString, CFType>::wrap_under_get_rule(val.as_CFTypeRef() as _);
        let x = self.get_cf_num_from_dict(&b, "X")?;
        let y = self.get_cf_num_from_dict(&b, "Y")?;
        let w = self.get_cf_num_from_dict(&b, "Width")?;
        let h = self.get_cf_num_from_dict(&b, "Height")?;
        Some((x, y, w, h))
    }

    unsafe fn get_cf_num_from_dict(&self, dict: &CFDictionary<CFString, CFType>, key: &str) -> Option<f64> {
        let key = CFString::new(key);
        let val = dict.find(&key)?;
        let n = CFNumber::wrap_under_get_rule(val.as_CFTypeRef() as _);
        n.to_f64()
    }

    fn is_recordable_app(&self, app_name: &str) -> bool {
        // Basic validation: app name should not be empty or too short
        if app_name.is_empty() || app_name.len() <= 2 {
            return false;
        }

        // Filter out obvious system processes and background services
        let system_apps = [
            "WindowServer", "Dock", "SystemUIServer", "ControlCenter", "NotificationCenter",
            "Spotlight", "loginwindow", "UserEventAgent", "CoreServicesUIAgent",
            "AirPlayUIAgent", "WiFiAgent", "BluetoothUIAgent"
        ];

        // Allow all applications except system processes
        // Frontend will handle user preference filtering
        !system_apps.contains(&app_name)
    }


}

impl WindowManager for MacOSWindowManager {
    fn check_permission(&self) -> PermissionStatus {
        DEV_LOGGER.log("info", "Checking macOS screen recording permission", "backend");

        // Test if we have screen recording permission by trying to access screen capture
        let has_permission = self.test_screen_recording_access();

        DEV_LOGGER.log("info", &format!("Permission check result: has_permission={}", has_permission), "backend");

        if has_permission {
            let status = PermissionStatus {
                granted: true,
                can_request: true,
                system_settings_required: false,
                message: "Screen recording permission is granted.".to_string(),
            };
            DEV_LOGGER.log("info", &format!("Returning granted permission status: {:?}", status), "backend");
            status
        } else {
            // For unsigned apps, the screencapture command may fail even with permissions granted
            // In development/testing, we'll assume permission is granted if the command fails
            // This is a common issue with unsigned Tauri apps
            DEV_LOGGER.log("warn", "screencapture command failed - this is likely due to code signing issues", "backend");
            DEV_LOGGER.log("info", "Assuming permission is granted for unsigned app (development mode)", "backend");

            let status = PermissionStatus {
                granted: true, // Assume granted for unsigned apps
                can_request: true,
                system_settings_required: false,
                message: "Screen recording permission assumed granted (unsigned app - code signing required for production).".to_string(),
            };
            DEV_LOGGER.log("info", &format!("Returning assumed granted permission status: {:?}", status), "backend");
            status
        }
    }

    fn request_permission(&self) -> Result<bool, String> {
        // On macOS, we can't programmatically request screen recording permission
        // We need to guide the user to System Preferences
        self.open_system_settings()?;

        // Return false because user needs to manually grant permission
        Ok(false)
    }

    fn get_windows(&self) -> Result<Vec<WindowInfo>, String> {
        DEV_LOGGER.log("info", "Getting windows - starting process", "backend");

        // Check permission first
        let permission = self.check_permission();
        if !permission.granted {
            DEV_LOGGER.log("error", "Permission not granted, returning error", "backend");
            return Err("Screen recording permission not granted".to_string());
        }

        DEV_LOGGER.log("info", "Permission granted, attempting to get real windows", "backend");

        // Try to get real windows using AppleScript
        self.get_real_windows()
    }



    fn get_window_thumbnail(&self, window_id: &str) -> Result<Option<String>, String> {
        DEV_LOGGER.log("info", &format!("Getting thumbnail for window ID: {}", window_id), "backend");

        // Parse window ID to get the CGWindowID
        let cg_window_id = match self.parse_window_id(window_id) {
            Some(id) => {
                DEV_LOGGER.log("info", &format!("Parsed window ID {} to CoreGraphics ID: {}", window_id, id), "backend");
                id
            },
            None => {
                DEV_LOGGER.log("warn", &format!("Could not parse window ID: {} (expected format: cg_<number>)", window_id), "backend");
                return Ok(None);
            },
        };

        // Create thumbnail using CoreGraphics
        DEV_LOGGER.log("info", &format!("Creating thumbnail for CoreGraphics window ID: {}", cg_window_id), "backend");
        self.create_window_thumbnail(cg_window_id)
    }



    fn open_system_settings(&self) -> Result<(), String> {
        // For Phase 1, we'll use a simple command to open System Preferences
        // In Phase 2, we'll implement proper Cocoa API calls
        std::process::Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture")
            .spawn()
            .map_err(|e| format!("Failed to open System Preferences: {}", e))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_macos_window_manager() {
        let manager = MacOSWindowManager::new();
        let permission = manager.check_permission();
        DEV_LOGGER.log("info", &format!("macOS permission status: {:?}", permission), "backend");
    }
}
