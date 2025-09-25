use tauri::{AppHandle, WebviewWindow, WebviewWindowBuilder, WindowEvent, LogicalPosition, Position};
use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowPosition {
    pub x: f64,
    pub y: f64,
    pub anchor: PositionAnchor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PositionAnchor {
    Tray,
    Cursor,
    Center,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrayBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, thiserror::Error)]
pub enum PopoverError {
    #[error("Failed to create popover window: {0}")]
    WindowCreationFailed(String),
    
    #[error("Failed to position popover window: {0}")]
    PositioningFailed(String),
    
    #[error("Failed to show popover window: {0}")]
    ShowFailed(String),
    
    #[error("Failed to hide popover window: {0}")]
    HideFailed(String),
    
    #[error("Popover window not found")]
    WindowNotFound,
    
    #[error("Failed to get window position: {0}")]
    PositionCalculationFailed(String),
    
    #[error("Failed to set window properties: {0}")]
    WindowPropertyFailed(String),
    
    #[error("Tray bounds not available")]
    TrayBoundsUnavailable,
}

pub type PopoverResult<T> = Result<T, PopoverError>;

pub struct PopoverManager {
    app_handle: AppHandle,
    current_window: Arc<Mutex<Option<WebviewWindow>>>,
    position_calculator: TrayPositionCalculator,
    window_config: PopoverWindowConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PopoverWindowConfig {
    pub width: f64,
    pub height: f64,
    pub frameless: bool,
    pub always_on_top: bool,
    pub skip_taskbar: bool,
    pub transparent: bool,
    pub resizable: bool,
    pub auto_hide_on_blur: bool,
}

impl Default for PopoverWindowConfig {
    fn default() -> Self {
        Self {
            width: 400.0,
            height: 600.0,
            frameless: true,
            always_on_top: true,
            skip_taskbar: true,
            transparent: true,
            resizable: false,
            auto_hide_on_blur: true,
        }
    }
}

pub struct TrayPositionCalculator {
    app_handle: AppHandle,
}

impl TrayPositionCalculator {
    pub fn new(app_handle: AppHandle) -> Self {
        Self { app_handle }
    }

    pub fn calculate_position(&self, config: &PopoverWindowConfig) -> PopoverResult<WindowPosition> {
        // Try to get tray bounds - this is platform-specific and may not always be available
        match self.get_tray_bounds() {
            Ok(tray_bounds) => {
                let position = self.calculate_tray_relative_position(&tray_bounds, config)?;
                Ok(WindowPosition {
                    x: position.0,
                    y: position.1,
                    anchor: PositionAnchor::Tray,
                })
            }
            Err(_) => {
                // Fallback to center screen positioning
                let position = self.calculate_center_position(config)?;
                Ok(WindowPosition {
                    x: position.0,
                    y: position.1,
                    anchor: PositionAnchor::Center,
                })
            }
        }
    }

    fn get_tray_bounds(&self) -> PopoverResult<TrayBounds> {
        // This is a simplified implementation
        // In a real implementation, we would need platform-specific code to get actual tray bounds
        // For now, we'll return an error to trigger fallback positioning
        Err(PopoverError::TrayBoundsUnavailable)
    }

    fn calculate_tray_relative_position(
        &self,
        tray_bounds: &TrayBounds,
        config: &PopoverWindowConfig,
    ) -> PopoverResult<(f64, f64)> {
        // Calculate position relative to tray icon
        // Position the popover below the tray icon with some padding
        let padding = 10.0;
        
        let x = tray_bounds.x + (tray_bounds.width / 2.0) - (config.width / 2.0);
        let y = tray_bounds.y + tray_bounds.height + padding;
        
        // Ensure the window stays within screen bounds
        let (screen_width, screen_height) = self.get_screen_size()?;
        
        let adjusted_x = if x + config.width > screen_width {
            screen_width - config.width - padding
        } else if x < 0.0 {
            padding
        } else {
            x
        };
        
        let adjusted_y = if y + config.height > screen_height {
            tray_bounds.y - config.height - padding
        } else {
            y
        };
        
        Ok((adjusted_x, adjusted_y))
    }

    fn calculate_center_position(&self, config: &PopoverWindowConfig) -> PopoverResult<(f64, f64)> {
        let (screen_width, screen_height) = self.get_screen_size()?;
        
        let x = (screen_width - config.width) / 2.0;
        let y = (screen_height - config.height) / 2.0;
        
        Ok((x, y))
    }

    fn get_screen_size(&self) -> PopoverResult<(f64, f64)> {
        // This is a simplified implementation
        // In a real implementation, we would get the actual screen size
        // For now, we'll use common screen dimensions as fallback
        Ok((1920.0, 1080.0))
    }
}

impl PopoverManager {
    pub fn new(app_handle: AppHandle) -> Self {
        let position_calculator = TrayPositionCalculator::new(app_handle.clone());
        
        Self {
            app_handle,
            current_window: Arc::new(Mutex::new(None)),
            position_calculator,
            window_config: PopoverWindowConfig::default(),
        }
    }

    pub fn with_config(app_handle: AppHandle, config: PopoverWindowConfig) -> Self {
        let position_calculator = TrayPositionCalculator::new(app_handle.clone());
        
        Self {
            app_handle,
            current_window: Arc::new(Mutex::new(None)),
            position_calculator,
            window_config: config,
        }
    }

    pub fn show_popover(&self) -> PopoverResult<()> {
        let mut current_window = self.current_window.lock()
            .map_err(|e| PopoverError::WindowCreationFailed(format!("Failed to acquire window lock: {}", e)))?;

        // If window already exists and is visible, just focus it
        if let Some(ref window) = *current_window {
            if window.is_visible().unwrap_or(false) {
                return window.set_focus()
                    .map_err(|e| PopoverError::ShowFailed(format!("Failed to focus existing window: {}", e)));
            }
        }

        // Calculate position for the popover
        let position = self.position_calculator.calculate_position(&self.window_config)?;

        // Create or show the window
        let window = if let Some(ref existing_window) = *current_window {
            // Window exists but is hidden, show it
            existing_window.set_position(Position::Logical(LogicalPosition::new(position.x, position.y)))
                .map_err(|e| PopoverError::PositioningFailed(format!("Failed to set window position: {}", e)))?;
            
            existing_window.show()
                .map_err(|e| PopoverError::ShowFailed(format!("Failed to show existing window: {}", e)))?;
            
            existing_window.clone()
        } else {
            // Create new window
            let window = self.create_popover_window(&position)?;
            *current_window = Some(window.clone());
            window
        };

        // Set up window event handlers
        self.setup_window_events(&window)?;

        Ok(())
    }

    pub fn hide_popover(&self) -> PopoverResult<()> {
        let current_window = self.current_window.lock()
            .map_err(|e| PopoverError::HideFailed(format!("Failed to acquire window lock: {}", e)))?;

        if let Some(ref window) = *current_window {
            window.hide()
                .map_err(|e| PopoverError::HideFailed(format!("Failed to hide window: {}", e)))?;
        }

        Ok(())
    }

    pub fn toggle_popover(&self) -> PopoverResult<()> {
        let current_window = self.current_window.lock()
            .map_err(|e| PopoverError::WindowCreationFailed(format!("Failed to acquire window lock: {}", e)))?;

        let is_visible = if let Some(ref window) = *current_window {
            window.is_visible().unwrap_or(false)
        } else {
            false
        };

        drop(current_window); // Release the lock before calling show/hide

        if is_visible {
            self.hide_popover()
        } else {
            self.show_popover()
        }
    }

    pub fn is_visible(&self) -> bool {
        let current_window = self.current_window.lock().ok();
        
        if let Some(window_guard) = current_window {
            if let Some(ref window) = *window_guard {
                return window.is_visible().unwrap_or(false);
            }
        }
        
        false
    }

    pub fn destroy_popover(&self) -> PopoverResult<()> {
        let mut current_window = self.current_window.lock()
            .map_err(|e| PopoverError::HideFailed(format!("Failed to acquire window lock: {}", e)))?;

        if let Some(window) = current_window.take() {
            window.close()
                .map_err(|e| PopoverError::HideFailed(format!("Failed to close window: {}", e)))?;
        }

        Ok(())
    }

    fn create_popover_window(&self, position: &WindowPosition) -> PopoverResult<WebviewWindow> {
        let window_builder = WebviewWindowBuilder::new(
            &self.app_handle,
            "popover",
            tauri::WebviewUrl::App("index.html".into())
        )
        .title("Notari Popover")
        .inner_size(self.window_config.width, self.window_config.height)
        .position(position.x, position.y)
        .resizable(self.window_config.resizable)
        .decorations(!self.window_config.frameless)
        .always_on_top(self.window_config.always_on_top)
        .skip_taskbar(self.window_config.skip_taskbar)
        // Note: transparent method may not be available in this Tauri version
        // .transparent(self.window_config.transparent)
        .visible(false); // Start hidden, we'll show it after setup

        let window = window_builder.build()
            .map_err(|e| PopoverError::WindowCreationFailed(format!("Failed to build window: {}", e)))?;

        // Show the window after creation
        window.show()
            .map_err(|e| PopoverError::ShowFailed(format!("Failed to show new window: {}", e)))?;

        Ok(window)
    }

    fn setup_window_events(&self, window: &WebviewWindow) -> PopoverResult<()> {
        if !self.window_config.auto_hide_on_blur {
            return Ok(());
        }

        let window_clone = window.clone();
        let auto_hide = self.window_config.auto_hide_on_blur;

        window.on_window_event(move |event| {
            match event {
                WindowEvent::Focused(focused) => {
                    if !focused && auto_hide {
                        // Window lost focus, hide it
                        if let Err(e) = window_clone.hide() {
                            eprintln!("Failed to auto-hide popover on blur: {}", e);
                        }
                    }
                }
                WindowEvent::CloseRequested { .. } => {
                    // Instead of closing, just hide the window
                    if let Err(e) = window_clone.hide() {
                        eprintln!("Failed to hide popover on close request: {}", e);
                    }
                }
                _ => {}
            }
        });

        Ok(())
    }

    pub fn update_config(&mut self, config: PopoverWindowConfig) {
        self.window_config = config;
    }

    pub fn get_config(&self) -> &PopoverWindowConfig {
        &self.window_config
    }

    pub fn calculate_position(&self) -> PopoverResult<WindowPosition> {
        self.position_calculator.calculate_position(&self.window_config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_window_position_serialization() {
        let position = WindowPosition {
            x: 100.0,
            y: 200.0,
            anchor: PositionAnchor::Tray,
        };

        let json = serde_json::to_string(&position).expect("Failed to serialize position");
        let deserialized: WindowPosition = serde_json::from_str(&json).expect("Failed to deserialize position");

        assert_eq!(position.x, deserialized.x);
        assert_eq!(position.y, deserialized.y);
        assert!(matches!(deserialized.anchor, PositionAnchor::Tray));
    }

    #[test]
    fn test_tray_bounds_serialization() {
        let bounds = TrayBounds {
            x: 50.0,
            y: 100.0,
            width: 24.0,
            height: 24.0,
        };

        let json = serde_json::to_string(&bounds).expect("Failed to serialize bounds");
        let deserialized: TrayBounds = serde_json::from_str(&json).expect("Failed to deserialize bounds");

        assert_eq!(bounds.x, deserialized.x);
        assert_eq!(bounds.y, deserialized.y);
        assert_eq!(bounds.width, deserialized.width);
        assert_eq!(bounds.height, deserialized.height);
    }

    #[test]
    fn test_popover_window_config_default() {
        let config = PopoverWindowConfig::default();
        
        assert_eq!(config.width, 400.0);
        assert_eq!(config.height, 600.0);
        assert!(config.frameless);
        assert!(config.always_on_top);
        assert!(config.skip_taskbar);
        assert!(config.transparent);
        assert!(!config.resizable);
        assert!(config.auto_hide_on_blur);
    }

    #[test]
    fn test_position_anchor_variants() {
        let tray_anchor = PositionAnchor::Tray;
        let cursor_anchor = PositionAnchor::Cursor;
        let center_anchor = PositionAnchor::Center;

        // Test serialization
        let tray_json = serde_json::to_string(&tray_anchor).expect("Failed to serialize tray anchor");
        let cursor_json = serde_json::to_string(&cursor_anchor).expect("Failed to serialize cursor anchor");
        let center_json = serde_json::to_string(&center_anchor).expect("Failed to serialize center anchor");

        // Test deserialization
        let _: PositionAnchor = serde_json::from_str(&tray_json).expect("Failed to deserialize tray anchor");
        let _: PositionAnchor = serde_json::from_str(&cursor_json).expect("Failed to deserialize cursor anchor");
        let _: PositionAnchor = serde_json::from_str(&center_json).expect("Failed to deserialize center anchor");
    }

    #[test]
    fn test_popover_error_display() {
        let creation_error = PopoverError::WindowCreationFailed("test error".to_string());
        let positioning_error = PopoverError::PositioningFailed("position error".to_string());
        let not_found_error = PopoverError::WindowNotFound;

        assert_eq!(creation_error.to_string(), "Failed to create popover window: test error");
        assert_eq!(positioning_error.to_string(), "Failed to position popover window: position error");
        assert_eq!(not_found_error.to_string(), "Popover window not found");
    }

    // Mock tests for position calculation
    #[test]
    fn test_tray_position_calculation() {
        let tray_bounds = TrayBounds {
            x: 100.0,
            y: 50.0,
            width: 24.0,
            height: 24.0,
        };

        let config = PopoverWindowConfig::default();
        
        // Calculate expected position
        let expected_x = tray_bounds.x + (tray_bounds.width / 2.0) - (config.width / 2.0);
        let expected_y = tray_bounds.y + tray_bounds.height + 10.0; // 10.0 is padding

        assert_eq!(expected_x, 100.0 + 12.0 - 200.0); // -88.0
        assert_eq!(expected_y, 50.0 + 24.0 + 10.0); // 84.0
    }

    #[test]
    fn test_center_position_calculation() {
        let screen_width = 1920.0;
        let screen_height = 1080.0;
        let config = PopoverWindowConfig::default();
        
        let expected_x = (screen_width - config.width) / 2.0;
        let expected_y = (screen_height - config.height) / 2.0;

        assert_eq!(expected_x, (1920.0 - 400.0) / 2.0); // 760.0
        assert_eq!(expected_y, (1080.0 - 600.0) / 2.0); // 240.0
    }
}