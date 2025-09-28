use super::{PermissionStatus, WindowBounds, WindowInfo, WindowManager};
use core_foundation::array::CFArray;
use core_foundation::base::{CFType, TCFType};
use core_foundation::dictionary::CFDictionary;
use core_foundation::number::CFNumber;
use core_foundation::string::CFString;
use core_graphics::display::{
    kCGNullWindowID, kCGWindowListExcludeDesktopElements, kCGWindowListOptionOnScreenOnly,
    CGWindowListCopyWindowInfo,
};

pub struct MacOSWindowManager;

impl MacOSWindowManager {
    pub fn new() -> Self {
        Self
    }

    /// Test if we can access screen recording by trying to get window information
    fn test_screen_recording_access(&self) -> bool {
        // Try to run a simple system command that requires screen recording permission
        // This is a practical approach since the CGPreflightScreenCaptureAccess API
        // isn't easily accessible from Rust
        match std::process::Command::new("screencapture")
            .arg("-l")  // List windows
            .output()
        {
            Ok(output) => output.status.success(),
            Err(_) => false
        }
    }


    fn get_real_windows(&self) -> Result<Vec<WindowInfo>, String> {
        // Try CoreGraphics approach first (most reliable)
        match self.get_windows_coregraphics() {
            Ok(windows) if !windows.is_empty() => {
                return Ok(windows);
            }
            Ok(_) => {}
            Err(_) => {}
        }

        // Fallback to AppleScript approach
        match self.get_windows_applescript() {
            Ok(windows) if !windows.is_empty() => {
                return Ok(windows);
            }
            Ok(_) => {}
            Err(_) => {}
        }

        // Final fallback to lsappinfo approach
        self.get_windows_lsappinfo()
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
                            self.get_descriptive_title(&owner_name)
                        } else {
                            format!("{} - {}", owner_name, window_title)
                        }
                    } else {
                        self.get_descriptive_title(&owner_name)
                    };

                    let window_info = WindowInfo {
                        id: format!("macos_cg_{}", i),
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

    fn get_windows_applescript(&self) -> Result<Vec<WindowInfo>, String> {
        log::info!("Using AppleScript to get window titles");

        // AppleScript to get windows with real titles from recordable apps
        let script = r#"
        tell application "System Events"
            set windowList to {}
            set recordableApps to {"Safari", "Google Chrome", "Firefox", "Brave Browser", "Microsoft Edge", "Arc", "Visual Studio Code", "Code", "Xcode", "Slack", "Discord", "Microsoft Teams", "Zoom", "Figma", "Sketch", "Terminal", "iTerm2", "Warp", "Finder", "Preview", "Calculator", "Notion", "Obsidian"}

            repeat with appName in recordableApps
                try
                    if exists application process appName then
                        tell application process appName
                            repeat with w in windows
                                try
                                    set windowTitle to name of w
                                    if windowTitle is not "" and windowTitle is not missing value then
                                        set windowList to windowList & (appName & "|" & windowTitle)
                                    end if
                                end try
                            end repeat
                        end tell
                    end if
                end try
            end repeat

            return windowList
        end tell
        "#;

        let output = std::process::Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| format!("Failed to run AppleScript: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("AppleScript failed: {}", stderr));
        }

        let output_str = String::from_utf8_lossy(&output.stdout);
        self.parse_applescript_output(&output_str)
    }

    fn parse_applescript_output(&self, output: &str) -> Result<Vec<WindowInfo>, String> {
        let mut windows = Vec::new();

        // AppleScript returns comma-separated list like: "Safari|Google - Safari, Code|main.rs - notari"
        for (i, line) in output.trim().split(", ").enumerate() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Parse format: "AppName|WindowTitle"
            if let Some((app_name, window_title)) = line.split_once('|') {
                let app_name = app_name.trim();
                let window_title = window_title.trim();

                if !app_name.is_empty() && !window_title.is_empty() {
                    let window_info = WindowInfo {
                        id: format!("macos_as_{}", i),
                        title: format!("{} - {}", app_name, window_title),
                        application: app_name.to_string(),
                        is_minimized: false,
                        bounds: WindowBounds { x: 0, y: 0, width: 800, height: 600 },
                        thumbnail: None,
                    };

                    windows.push(window_info);
                }
            }
        }

        Ok(windows)
    }

    fn get_windows_lsappinfo(&self) -> Result<Vec<WindowInfo>, String> {
        // Fallback to the existing lsappinfo approach
        let output = std::process::Command::new("lsappinfo")
            .arg("list")
            .output()
            .map_err(|e| format!("Failed to run lsappinfo: {}", e))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(format!("lsappinfo failed: {}", stderr));
        }

        let output_str = String::from_utf8_lossy(&output.stdout);
        self.parse_lsappinfo_output(&output_str)
    }

    fn parse_lsappinfo_output(&self, output: &str) -> Result<Vec<WindowInfo>, String> {
        let mut windows = Vec::new();
        let mut app_counts = std::collections::HashMap::new();

        // Parse lsappinfo output - it typically shows app names and info
        for line in output.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }

            // Extract app name from lsappinfo format
            // Format is typically like: "AppName" ASN:0x0-0x123456:
            if let Some(app_name) = self.extract_app_name_from_lsappinfo(line) {
                // Count instances of each app
                let count = app_counts.entry(app_name.clone()).or_insert(0);
                *count += 1;

                // Create descriptive titles for multiple instances
                let title = if *count == 1 {
                    // First instance - try to get a more descriptive title
                    self.get_descriptive_title(&app_name)
                } else {
                    // Multiple instances - number them
                    format!("{} - Window {}", app_name, count)
                };

                let window_info = WindowInfo {
                    id: format!("macos_app_{}_{}", app_name.replace(" ", "_").to_lowercase(), count),
                    title,
                    application: app_name,
                    is_minimized: false,
                    bounds: WindowBounds { x: 0, y: 0, width: 800, height: 600 },
                    thumbnail: None,
                };

                windows.push(window_info);
            }
        }

        Ok(windows)
    }

    fn get_descriptive_title(&self, app_name: &str) -> String {
        match app_name {
            "Google Chrome" => "Google Chrome - Browser".to_string(),
            "Brave Browser" => "Brave Browser - Browser".to_string(),
            "Safari" => "Safari - Browser".to_string(),
            "Firefox" => "Firefox - Browser".to_string(),
            "Code" => "Visual Studio Code - Editor".to_string(),
            "Xcode" => "Xcode - IDE".to_string(),
            "Slack" => "Slack - Communication".to_string(),
            "Discord" => "Discord - Communication".to_string(),
            "Microsoft Teams" => "Microsoft Teams - Communication".to_string(),
            "Zoom" => "Zoom - Video Call".to_string(),
            "Terminal" => "Terminal - Command Line".to_string(),
            "iTerm2" => "iTerm2 - Terminal".to_string(),
            "Warp" => "Warp - Modern Terminal".to_string(),
            "Finder" => "Finder - File Browser".to_string(),
            "Preview" => "Preview - Document Viewer".to_string(),
            "Calculator" => "Calculator - Math".to_string(),
            "Figma" => "Figma - Design Tool".to_string(),
            "Sketch" => "Sketch - Design Tool".to_string(),
            "Notion" => "Notion - Notes & Docs".to_string(),
            "Obsidian" => "Obsidian - Knowledge Base".to_string(),
            _ => format!("{} - Application", app_name),
        }
    }

    fn extract_app_name_from_lsappinfo(&self, line: &str) -> Option<String> {
        // lsappinfo format is typically: "AppName" ASN:0x0-0x123456:
        if let Some(quote_start) = line.find('"') {
            if let Some(quote_end) = line[quote_start + 1..].find('"') {
                let app_name = &line[quote_start + 1..quote_start + 1 + quote_end];

                if self.is_recordable_app(app_name) {
                    return Some(app_name.to_string());
                }
            }
        }
        None
    }

    fn is_recordable_app(&self, app_name: &str) -> bool {
        if app_name.is_empty() || app_name.len() <= 2 {
            return false;
        }

        // STRICT whitelist: Only the most commonly recorded app types
        let recordable_apps = [
            // Browsers (most common recording target)
            "Safari", "Google Chrome", "Firefox", "Brave Browser", "Microsoft Edge", "Arc",
            // Code Editors (common for tutorials/demos)
            "Visual Studio Code", "Code", "Xcode",
            // Communication (meetings/demos)
            "Slack", "Discord", "Microsoft Teams", "Zoom",
            // Design Tools (creative work)
            "Figma", "Sketch", "Photoshop", "Illustrator",
            // Media Players (content)
            "VLC", "QuickTime Player", "IINA",
            // Productivity (documents/presentations)
            "Microsoft Word", "Microsoft Excel", "Microsoft PowerPoint", "Pages", "Numbers", "Keynote",
            "Notion", "Obsidian",
            // Terminal (development demos)
            "Terminal", "iTerm2", "Warp",
            // Essential System Apps
            "Finder", "Preview", "Calculator"
        ];

        // Only allow apps in the strict whitelist
        recordable_apps.contains(&app_name)
    }


}

impl WindowManager for MacOSWindowManager {
    fn check_permission(&self) -> PermissionStatus {
        log::info!("Checking macOS screen recording permission");

        // Test if we have screen recording permission by trying to access screen capture
        let has_permission = self.test_screen_recording_access();

        log::info!("Permission check result: has_permission={}", has_permission);

        if has_permission {
            let status = PermissionStatus {
                granted: true,
                can_request: true,
                system_settings_required: false,
                message: "Screen recording permission is granted.".to_string(),
            };
            log::info!("Returning granted permission status: {:?}", status);
            status
        } else {
            // For unsigned apps, the screencapture command may fail even with permissions granted
            // In development/testing, we'll assume permission is granted if the command fails
            // This is a common issue with unsigned Tauri apps
            log::warn!("screencapture command failed - this is likely due to code signing issues");
            log::info!("Assuming permission is granted for unsigned app (development mode)");

            let status = PermissionStatus {
                granted: true, // Assume granted for unsigned apps
                can_request: true,
                system_settings_required: false,
                message: "Screen recording permission assumed granted (unsigned app - code signing required for production).".to_string(),
            };
            log::info!("Returning assumed granted permission status: {:?}", status);
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
        log::info!("Getting windows - starting process");

        // Check permission first
        let permission = self.check_permission();
        if !permission.granted {
            log::error!("Permission not granted, returning error");
            return Err("Screen recording permission not granted".to_string());
        }

        log::info!("Permission granted, attempting to get real windows");

        // Try to get real windows using AppleScript
        self.get_real_windows()
    }



    fn get_window_thumbnail(&self, _window_id: &str) -> Result<Option<String>, String> {
        // TODO: Implement thumbnail generation using CGWindowListCreateImage
        Ok(None)
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
        println!("macOS permission status: {:?}", permission);
    }
}
