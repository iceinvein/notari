use chrono::{DateTime, Utc};
use crossbeam_channel::{bounded, Receiver, Sender};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Arc;

/// Log level enum for type-safe logging
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
}

impl LogLevel {
    #[allow(dead_code)]
    pub fn as_str(&self) -> &'static str {
        match self {
            LogLevel::Debug => "debug",
            LogLevel::Info => "info",
            LogLevel::Warn => "warn",
            LogLevel::Error => "error",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "debug" => Some(LogLevel::Debug),
            "info" => Some(LogLevel::Info),
            "warn" => Some(LogLevel::Warn),
            "error" => Some(LogLevel::Error),
            _ => None,
        }
    }
}

/// Log entry with optimized types and optional context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub level: LogLevel,
    pub message: String,
    pub source: &'static str, // "frontend" or "backend"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<HashMap<String, serde_json::Value>>,
}

/// Simple circular buffer for fixed-size log storage
struct CircularBuffer {
    buffer: Vec<LogEntry>,
    head: usize,
    size: usize,
    capacity: usize,
}

impl CircularBuffer {
    fn new(capacity: usize) -> Self {
        Self {
            buffer: Vec::with_capacity(capacity),
            head: 0,
            size: 0,
            capacity,
        }
    }

    fn push(&mut self, item: LogEntry) {
        if self.size < self.capacity {
            self.buffer.push(item);
            self.size += 1;
        } else {
            self.buffer[self.head] = item;
            self.head = (self.head + 1) % self.capacity;
        }
    }

    fn to_vec(&self) -> Vec<LogEntry> {
        if self.size < self.capacity {
            self.buffer.clone()
        } else {
            // Return items in chronological order
            let mut result = Vec::with_capacity(self.size);
            result.extend_from_slice(&self.buffer[self.head..]);
            result.extend_from_slice(&self.buffer[..self.head]);
            result
        }
    }

    fn clear(&mut self) {
        self.buffer.clear();
        self.head = 0;
        self.size = 0;
    }
}

/// Commands for the logger thread
enum LogCommand {
    Log(LogEntry),
    GetLogs(crossbeam_channel::Sender<Vec<LogEntry>>),
    Clear,
}

pub struct Logger {
    sender: Sender<LogCommand>,
    min_level: Arc<AtomicU8>,
}

impl Logger {
    pub fn new() -> Self {
        let (sender, receiver) = bounded(1000);
        let min_level = Arc::new(AtomicU8::new(LogLevel::Debug as u8));

        // Spawn background thread to handle logs
        std::thread::spawn(move || {
            Self::logger_thread(receiver);
        });

        Self { sender, min_level }
    }

    /// Background thread that manages the log buffer
    fn logger_thread(receiver: Receiver<LogCommand>) {
        let mut buffer = CircularBuffer::new(1000);

        for cmd in receiver {
            match cmd {
                LogCommand::Log(entry) => {
                    buffer.push(entry);
                }
                LogCommand::GetLogs(response_tx) => {
                    let _ = response_tx.send(buffer.to_vec());
                }
                LogCommand::Clear => {
                    buffer.clear();
                }
            }
        }
    }

    /// Log with enum level (non-blocking)
    pub fn log(&self, level: LogLevel, message: &str, source: &'static str) {
        // Check if this log level should be recorded
        if (level as u8) < self.min_level.load(Ordering::Relaxed) {
            return;
        }

        let entry = LogEntry {
            timestamp: Utc::now(),
            level,
            message: message.to_string(),
            source,
            context: None,
        };

        // Non-blocking send (drops log if channel is full)
        let _ = self.sender.try_send(LogCommand::Log(entry));
    }

    /// Log with context (structured logging)
    #[allow(dead_code)]
    pub fn log_with_context(
        &self,
        level: LogLevel,
        message: &str,
        source: &'static str,
        context: HashMap<String, serde_json::Value>,
    ) {
        // Check if this log level should be recorded
        if (level as u8) < self.min_level.load(Ordering::Relaxed) {
            return;
        }

        let entry = LogEntry {
            timestamp: Utc::now(),
            level,
            message: message.to_string(),
            source,
            context: Some(context),
        };

        // Non-blocking send (drops log if channel is full)
        let _ = self.sender.try_send(LogCommand::Log(entry));
    }

    /// Set minimum log level (runtime filtering)
    #[allow(dead_code)]
    pub fn set_min_level(&self, level: LogLevel) {
        self.min_level.store(level as u8, Ordering::Relaxed);
    }

    /// Get current minimum log level
    #[allow(dead_code)]
    pub fn get_min_level(&self) -> LogLevel {
        match self.min_level.load(Ordering::Relaxed) {
            0 => LogLevel::Debug,
            1 => LogLevel::Info,
            2 => LogLevel::Warn,
            3 => LogLevel::Error,
            _ => LogLevel::Info,
        }
    }

    pub fn get_logs(&self) -> Vec<LogEntry> {
        let (response_tx, response_rx) = bounded(1);
        if self.sender.send(LogCommand::GetLogs(response_tx)).is_ok() {
            response_rx.recv().unwrap_or_default()
        } else {
            Vec::new()
        }
    }

    pub fn clear_logs(&self) {
        let _ = self.sender.try_send(LogCommand::Clear);
    }
}

// Global logger instance
lazy_static::lazy_static! {
    pub static ref LOGGER: Logger = Logger::new();
}

// Macro for easy logging
#[macro_export]
macro_rules! app_log {
	($level:expr, $($arg:tt)*) => {
		{
			use crate::logger::LogLevel;
			let message = format!($($arg)*);
			crate::logger::LOGGER.log($level, &message, "backend");
			// Also log to regular log for development
			match $level {
				LogLevel::Error => log::error!("{}", message),
				LogLevel::Warn => log::warn!("{}", message),
				LogLevel::Info => log::info!("{}", message),
				LogLevel::Debug => log::debug!("{}", message),
			}
		}
	};
}
