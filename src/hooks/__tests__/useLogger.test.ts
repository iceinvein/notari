import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLogger } from "../useLogger";
import { logger, LogLevel } from "../../utils/logger";

describe("useLogger", () => {
	beforeEach(() => {
		// Clear logs before each test
		logger.clearLogs();
	});

	it("should return initial empty logs", () => {
		const { result } = renderHook(() => useLogger());

		expect(result.current.logs).toEqual([]);
	});

	it("should return logs after logging", () => {
		// Add some logs
		logger.info("TEST", "Test message 1");
		logger.warn("TEST", "Test message 2");

		const { result } = renderHook(() => useLogger());

		expect(result.current.logs).toHaveLength(2);
		expect(result.current.logs[0].message).toBe("Test message 1");
		expect(result.current.logs[1].message).toBe("Test message 2");
	});

	it("should update when new logs are added", () => {
		const { result } = renderHook(() => useLogger());

		expect(result.current.logs).toHaveLength(0);

		act(() => {
			logger.info("TEST", "New log message");
		});

		expect(result.current.logs).toHaveLength(1);
		expect(result.current.logs[0].message).toBe("New log message");
	});

	it("should clear logs", () => {
		logger.info("TEST", "Test message");

		const { result } = renderHook(() => useLogger());

		expect(result.current.logs).toHaveLength(1);

		act(() => {
			result.current.clearLogs();
		});

		expect(result.current.logs).toHaveLength(0);
	});

	it("should export logs as JSON", () => {
		logger.info("TEST", "Test message 1");
		logger.error("TEST", "Test message 2", new Error("Test error"));

		const { result } = renderHook(() => useLogger());

		const exported = result.current.exportLogs();

		expect(exported).toContain("Test message 1");
		expect(exported).toContain("Test message 2");
		expect(exported).toContain("Test error");
	});

	it("should filter logs by level", () => {
		// Clear first to ensure clean state
		logger.clearLogs();

		logger.debug("TEST", "Debug message");
		logger.info("TEST", "Info message");
		logger.warn("TEST", "Warn message");
		logger.error("TEST", "Error message", new Error("Test"));

		const { result } = renderHook(() => useLogger());

		const errorLogs = result.current.getLogsByLevel(LogLevel.ERROR);
		expect(errorLogs.length).toBeGreaterThanOrEqual(1);
		expect(errorLogs.some((log) => log.level === LogLevel.ERROR)).toBe(true);

		const infoLogs = result.current.getLogsByLevel(LogLevel.INFO);
		expect(infoLogs.length).toBeGreaterThanOrEqual(1);
		expect(infoLogs.some((log) => log.level === LogLevel.INFO)).toBe(true);
	});

	it("should filter logs by category", () => {
		logger.info("RECORDING", "Recording message");
		logger.info("VERIFICATION", "Verification message");
		logger.info("RECORDING", "Another recording message");

		const { result } = renderHook(() => useLogger());

		const recordingLogs = result.current.getLogsByCategory("RECORDING");
		expect(recordingLogs).toHaveLength(2);
		expect(recordingLogs[0].category).toBe("RECORDING");

		const verificationLogs = result.current.getLogsByCategory("VERIFICATION");
		expect(verificationLogs).toHaveLength(1);
		expect(verificationLogs[0].category).toBe("VERIFICATION");
	});

	it("should handle log data objects", () => {
		const testData = { windowId: "123", duration: 60 };
		logger.info("TEST", "Test with data", testData);

		const { result } = renderHook(() => useLogger());

		expect(result.current.logs).toHaveLength(1);
		expect(result.current.logs[0].data).toEqual(testData);
	});

	it("should handle errors in logs", () => {
		const testError = new Error("Test error message");
		logger.error("TEST", "Error occurred", testError);

		const { result } = renderHook(() => useLogger());

		expect(result.current.logs).toHaveLength(1);
		expect(result.current.logs[0].level).toBe(LogLevel.ERROR);
		expect(result.current.logs[0].message).toBe("Error occurred");
		// Stack trace should be present
		expect(result.current.logs[0].stack).toBeDefined();
	});

	it("should maintain log order", () => {
		logger.info("TEST", "First");
		logger.info("TEST", "Second");
		logger.info("TEST", "Third");

		const { result } = renderHook(() => useLogger());

		expect(result.current.logs[0].message).toBe("First");
		expect(result.current.logs[1].message).toBe("Second");
		expect(result.current.logs[2].message).toBe("Third");
	});

	it("should cleanup subscription on unmount", () => {
		// Add a spy to check if unsubscribe is called
		const unsubscribeSpy = vi.fn();
		vi.spyOn(logger, "subscribe").mockReturnValue(unsubscribeSpy);

		const { unmount } = renderHook(() => useLogger());

		unmount();

		expect(unsubscribeSpy).toHaveBeenCalled();
	});
});
