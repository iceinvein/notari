import { describe, it, expect, beforeEach, vi } from "vitest";
import {
	logger,
	LogLevel,
	appLogger,
	recordingLogger,
	preferencesLogger,
	storeLogger,
} from "../logger";

describe("Logger", () => {
	beforeEach(() => {
		logger.clearLogs();
	});

	describe("basic logging", () => {
		it("should log debug messages", () => {
			logger.debug("TEST", "Debug message");

			const logs = logger.getLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].level).toBe(LogLevel.DEBUG);
			expect(logs[0].category).toBe("TEST");
			expect(logs[0].message).toBe("Debug message");
		});

		it("should log info messages", () => {
			logger.info("TEST", "Info message");

			const logs = logger.getLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].level).toBe(LogLevel.INFO);
			expect(logs[0].message).toBe("Info message");
		});

		it("should log warn messages", () => {
			logger.warn("TEST", "Warning message");

			const logs = logger.getLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].level).toBe(LogLevel.WARN);
			expect(logs[0].message).toBe("Warning message");
		});

		it("should log error messages", () => {
			const error = new Error("Test error");
			logger.error("TEST", "Error message", error);

			const logs = logger.getLogs();
			expect(logs).toHaveLength(1);
			expect(logs[0].level).toBe(LogLevel.ERROR);
			expect(logs[0].message).toBe("Error message");
			expect(logs[0].stack).toBeDefined();
		});
	});

	describe("log data", () => {
		it("should store string data", () => {
			logger.info("TEST", "Message", "string data");

			const logs = logger.getLogs();
			expect(logs[0].data).toBe("string data");
		});

		it("should store number data", () => {
			logger.info("TEST", "Message", 42);

			const logs = logger.getLogs();
			expect(logs[0].data).toBe(42);
		});

		it("should store boolean data", () => {
			logger.info("TEST", "Message", true);

			const logs = logger.getLogs();
			expect(logs[0].data).toBe(true);
		});

		it("should store object data", () => {
			const data = { key: "value", count: 10 };
			logger.info("TEST", "Message", data);

			const logs = logger.getLogs();
			expect(logs[0].data).toEqual(data);
		});

		it("should store array data", () => {
			const data = [1, 2, 3, "test"];
			logger.info("TEST", "Message", data);

			const logs = logger.getLogs();
			expect(logs[0].data).toEqual(data);
		});

		it("should handle null data", () => {
			logger.info("TEST", "Message", null);

			const logs = logger.getLogs();
			expect(logs[0].data).toBeNull();
		});

		it("should handle undefined data", () => {
			logger.info("TEST", "Message", undefined);

			const logs = logger.getLogs();
			expect(logs[0].data).toBeUndefined();
		});
	});

	describe("log metadata", () => {
		it("should generate unique IDs", () => {
			logger.info("TEST", "Message 1");
			logger.info("TEST", "Message 2");

			const logs = logger.getLogs();
			expect(logs[0].id).not.toBe(logs[1].id);
		});

		it("should include timestamps", () => {
			logger.info("TEST", "Message");

			const logs = logger.getLogs();
			expect(logs[0].timestamp).toBeDefined();
			expect(new Date(logs[0].timestamp).getTime()).toBeGreaterThan(0);
		});

		it("should include category", () => {
			logger.info("CUSTOM_CATEGORY", "Message");

			const logs = logger.getLogs();
			expect(logs[0].category).toBe("CUSTOM_CATEGORY");
		});
	});

	describe("filtering", () => {
		beforeEach(() => {
			logger.debug("TEST", "Debug message");
			logger.info("TEST", "Info message");
			logger.warn("TEST", "Warn message");
			logger.error("TEST", "Error message", new Error("Test"));
		});

		it("should filter by level (ERROR)", () => {
			const errorLogs = logger.getLogsByLevel(LogLevel.ERROR);
			expect(errorLogs.every((log) => log.level >= LogLevel.ERROR)).toBe(true);
		});

		it("should filter by level (WARN)", () => {
			const warnLogs = logger.getLogsByLevel(LogLevel.WARN);
			expect(warnLogs.every((log) => log.level >= LogLevel.WARN)).toBe(true);
			expect(warnLogs.length).toBeGreaterThanOrEqual(2); // WARN and ERROR
		});

		it("should filter by level (INFO)", () => {
			const infoLogs = logger.getLogsByLevel(LogLevel.INFO);
			expect(infoLogs.every((log) => log.level >= LogLevel.INFO)).toBe(true);
			expect(infoLogs.length).toBeGreaterThanOrEqual(3); // INFO, WARN, ERROR
		});

		it("should filter by category", () => {
			logger.info("RECORDING", "Recording message");
			logger.info("VERIFICATION", "Verification message");

			const recordingLogs = logger.getLogsByCategory("RECORDING");
			expect(recordingLogs.every((log) => log.category === "RECORDING")).toBe(true);
		});
	});

	describe("log limits", () => {
		it("should limit logs to maxLogs (1000)", () => {
			// Add 1100 logs
			for (let i = 0; i < 1100; i++) {
				logger.info("TEST", `Message ${i}`);
			}

			const logs = logger.getLogs();
			expect(logs.length).toBe(1000);

			// Should keep the most recent logs
			expect(logs[logs.length - 1].message).toBe("Message 1099");
		});
	});

	describe("clearing logs", () => {
		it("should clear all logs", () => {
			logger.info("TEST", "Message 1");
			logger.info("TEST", "Message 2");

			expect(logger.getLogs()).toHaveLength(2);

			logger.clearLogs();

			expect(logger.getLogs()).toHaveLength(0);
		});
	});

	describe("subscriptions", () => {
		it("should notify subscribers on new log", () => {
			const listener = vi.fn();
			logger.subscribe(listener);

			logger.info("TEST", "Message");

			expect(listener).toHaveBeenCalled();
			expect(listener).toHaveBeenCalledWith(
				expect.arrayContaining([expect.objectContaining({ message: "Message" })])
			);
		});

		it("should notify subscribers on clear", () => {
			const listener = vi.fn();
			logger.subscribe(listener);

			logger.info("TEST", "Message");
			listener.mockClear();

			logger.clearLogs();

			expect(listener).toHaveBeenCalledWith([]);
		});

		it("should unsubscribe correctly", () => {
			const listener = vi.fn();
			const unsubscribe = logger.subscribe(listener);

			logger.info("TEST", "Message 1");
			expect(listener).toHaveBeenCalledTimes(1);

			unsubscribe();
			listener.mockClear();

			logger.info("TEST", "Message 2");
			expect(listener).not.toHaveBeenCalled();
		});
	});

	describe("export/import", () => {
		it("should export logs as JSON", () => {
			logger.info("TEST", "Message 1");
			logger.warn("TEST", "Message 2");

			const exported = logger.exportLogs();
			const parsed = JSON.parse(exported);

			expect(parsed.logs).toHaveLength(2);
			expect(parsed.exportedAt).toBeDefined();
			expect(parsed.appVersion).toBeDefined();
		});

		it("should import logs from JSON", () => {
			logger.info("TEST", "Original message");
			const exported = logger.exportLogs();

			logger.clearLogs();
			expect(logger.getLogs()).toHaveLength(0);

			const success = logger.importLogs(exported);

			expect(success).toBe(true);
			expect(logger.getLogs()).toHaveLength(1);
			expect(logger.getLogs()[0].message).toBe("Original message");
		});

		it("should reject invalid JSON", () => {
			const success = logger.importLogs("invalid json");
			expect(success).toBe(false);
		});

		it("should reject JSON without logs array", () => {
			const success = logger.importLogs('{"foo": "bar"}');
			expect(success).toBe(false);
		});
	});

	describe("convenience loggers", () => {
		it("should log with appLogger", () => {
			appLogger.info("App message");

			const logs = logger.getLogs();
			expect(logs[0].category).toBe("APP");
			expect(logs[0].message).toBe("App message");
		});

		it("should log with recordingLogger", () => {
			recordingLogger.info("Recording message");

			const logs = logger.getLogs();
			expect(logs[0].category).toBe("RECORDING");
			expect(logs[0].message).toBe("Recording message");
		});

		it("should log with preferencesLogger", () => {
			preferencesLogger.info("Preferences message");

			const logs = logger.getLogs();
			expect(logs[0].category).toBe("PREFERENCES");
			expect(logs[0].message).toBe("Preferences message");
		});

		it("should log with storeLogger", () => {
			storeLogger.info("Store message");

			const logs = logger.getLogs();
			expect(logs[0].category).toBe("STORE");
			expect(logs[0].message).toBe("Store message");
		});
	});
});
