use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::{Arc, Mutex};
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
	pub timestamp: DateTime<Utc>,
	pub level: String,
	pub message: String,
	pub source: String, // "frontend" or "backend"
}

pub struct DevLogger {
	logs: Arc<Mutex<VecDeque<LogEntry>>>,
	max_logs: usize,
}

impl DevLogger {
	pub fn new() -> Self {
		Self {
			logs: Arc::new(Mutex::new(VecDeque::new())),
			max_logs: 1000, // Keep last 1000 logs
		}
	}

	pub fn log(&self, level: &str, message: &str, source: &str) {
		let entry = LogEntry {
			timestamp: Utc::now(),
			level: level.to_string(),
			message: message.to_string(),
			source: source.to_string(),
		};

		if let Ok(mut logs) = self.logs.lock() {
			logs.push_back(entry);

			// Keep only the last max_logs entries
			while logs.len() > self.max_logs {
				logs.pop_front();
			}
		}
	}

	pub fn get_logs(&self) -> Vec<LogEntry> {
		if let Ok(logs) = self.logs.lock() {
			logs.iter().cloned().collect()
		} else {
			Vec::new()
		}
	}

	pub fn clear_logs(&self) {
		if let Ok(mut logs) = self.logs.lock() {
			logs.clear();
		}
	}
}

// Global logger instance
lazy_static::lazy_static! {
	pub static ref DEV_LOGGER: DevLogger = DevLogger::new();
}

// Macro for easy logging
#[macro_export]
macro_rules! dev_log {
	($level:expr, $($arg:tt)*) => {
		{
			let message = format!($($arg)*);
			crate::dev_logger::DEV_LOGGER.log($level, &message, "backend");
			// Also log to regular log for development
			match $level {
				"error" => log::error!("{}", message),
				"warn" => log::warn!("{}", message),
				"info" => log::info!("{}", message),
				"debug" => log::debug!("{}", message),
				_ => log::info!("{}", message),
			}
		}
	};
}
