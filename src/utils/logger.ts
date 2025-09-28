export enum LogLevel {
	DEBUG = 0,
	INFO = 1,
	WARN = 2,
	ERROR = 3,
}

// Type for log data - can be primitives, objects, arrays, or null/undefined
export type LogData =
	| string
	| number
	| boolean
	| null
	| undefined
	| Record<string, unknown>
	| unknown[];

export interface LogEntry {
	id: string;
	timestamp: string;
	level: LogLevel;
	category: string;
	message: string;
	data?: LogData;
	stack?: string;
}

class Logger {
	private logs: LogEntry[] = [];
	private maxLogs = 1000; // Keep last 1000 logs
	private listeners: ((logs: LogEntry[]) => void)[] = [];

	private generateId(): string {
		return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
	}

	private addLog(
		level: LogLevel,
		category: string,
		message: string,
		data?: LogData,
		error?: Error
	) {
		const entry: LogEntry = {
			id: this.generateId(),
			timestamp: new Date().toISOString(),
			level,
			category,
			message,
			data,
			stack: error?.stack,
		};

		this.logs.push(entry);

		// Keep only the last maxLogs entries
		if (this.logs.length > this.maxLogs) {
			this.logs = this.logs.slice(-this.maxLogs);
		}

		// Notify listeners
		this.listeners.forEach((listener) => {
			listener([...this.logs]);
		});

		// Also log to console in development
		if (import.meta.env.DEV) {
			const levelName = LogLevel[level];
			const timestamp = new Date().toLocaleTimeString();
			const prefix = `[${timestamp}] [${levelName}] [${category}]`;

			switch (level) {
				case LogLevel.DEBUG:
					// biome-ignore lint/suspicious/noConsole: We're doing exacly that
					console.debug(prefix, message, data);
					break;
				case LogLevel.INFO:
					// biome-ignore lint/suspicious/noConsole: We're doing exacly that
					console.info(prefix, message, data);
					break;
				case LogLevel.WARN:
					console.warn(prefix, message, data);
					break;
				case LogLevel.ERROR:
					console.error(prefix, message, data, error);
					break;
			}
		}
	}

	debug(category: string, message: string, data?: LogData) {
		this.addLog(LogLevel.DEBUG, category, message, data);
	}

	info(category: string, message: string, data?: LogData) {
		this.addLog(LogLevel.INFO, category, message, data);
	}

	warn(category: string, message: string, data?: LogData) {
		this.addLog(LogLevel.WARN, category, message, data);
	}

	error(category: string, message: string, error?: Error, data?: LogData) {
		this.addLog(LogLevel.ERROR, category, message, data, error);
	}

	getLogs(): LogEntry[] {
		return [...this.logs];
	}

	getLogsByLevel(level: LogLevel): LogEntry[] {
		return this.logs.filter((log) => log.level >= level);
	}

	getLogsByCategory(category: string): LogEntry[] {
		return this.logs.filter((log) => log.category === category);
	}

	clearLogs() {
		this.logs = [];
		this.listeners.forEach((listener) => {
			listener([]);
		});
	}

	subscribe(listener: (logs: LogEntry[]) => void): () => void {
		this.listeners.push(listener);
		// Return unsubscribe function
		return () => {
			const index = this.listeners.indexOf(listener);
			if (index > -1) {
				this.listeners.splice(index, 1);
			}
		};
	}

	exportLogs(): string {
		const logsData = {
			exportedAt: new Date().toISOString(),
			appVersion: "0.1.0", // TODO: Get from package.json or config
			logs: this.logs,
		};
		return JSON.stringify(logsData, null, 2);
	}

	importLogs(jsonData: string): boolean {
		try {
			const data = JSON.parse(jsonData);
			if (data.logs && Array.isArray(data.logs)) {
				this.logs = data.logs;
				this.listeners.forEach((listener) => {
					listener([...this.logs]);
				});
				return true;
			}
			return false;
		} catch {
			return false;
		}
	}
}

// Create singleton instance
export const logger = new Logger();

// Convenience functions for common categories
export const appLogger = {
	debug: (message: string, data?: LogData) => logger.debug("APP", message, data),
	info: (message: string, data?: LogData) => logger.info("APP", message, data),
	warn: (message: string, data?: LogData) => logger.warn("APP", message, data),
	error: (message: string, error?: Error, data?: LogData) =>
		logger.error("APP", message, error, data),
};

export const preferencesLogger = {
	debug: (message: string, data?: LogData) => logger.debug("PREFERENCES", message, data),
	info: (message: string, data?: LogData) => logger.info("PREFERENCES", message, data),
	warn: (message: string, data?: LogData) => logger.warn("PREFERENCES", message, data),
	error: (message: string, error?: Error, data?: LogData) =>
		logger.error("PREFERENCES", message, error, data),
};

export const recordingLogger = {
	debug: (message: string, data?: LogData) => logger.debug("RECORDING", message, data),
	info: (message: string, data?: LogData) => logger.info("RECORDING", message, data),
	warn: (message: string, data?: LogData) => logger.warn("RECORDING", message, data),
	error: (message: string, error?: Error, data?: LogData) =>
		logger.error("RECORDING", message, error, data),
};

export const storeLogger = {
	debug: (message: string, data?: LogData) => logger.debug("STORE", message, data),
	info: (message: string, data?: LogData) => logger.info("STORE", message, data),
	warn: (message: string, data?: LogData) => logger.warn("STORE", message, data),
	error: (message: string, error?: Error, data?: LogData) =>
		logger.error("STORE", message, error, data),
};
