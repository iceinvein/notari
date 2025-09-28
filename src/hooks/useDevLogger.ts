import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export interface LogEntry {
	timestamp: string;
	level: string;
	message: string;
	source: string;
}

export const useDevLogger = () => {
	const [logs, setLogs] = useState<LogEntry[]>([]);
	const [isEnabled, setIsEnabled] = useState(() => {
		// Check localStorage for dev logging preference
		return localStorage.getItem("notari-dev-logging") === "true";
	});

	// Get all logs
	const refreshLogs = useCallback(async () => {
		if (!isEnabled) return;

		try {
			const allLogs = await invoke<LogEntry[]>("dev_log_get");
			setLogs(allLogs);
		} catch (error) {
			console.error("Failed to get dev logs:", error);
		}
	}, [isEnabled]);

	// Add a log entry
	const addLog = useCallback(
		async (level: string, message: string) => {
			if (!isEnabled) return;

			try {
				await invoke("dev_log_add", { level, message });
				// Refresh logs after adding
				await refreshLogs();
			} catch (error) {
				console.error("Failed to add dev log:", error);
			}
		},
		[isEnabled, refreshLogs]
	);

	// Clear all logs
	const clearLogs = useCallback(async () => {
		try {
			await invoke("dev_log_clear");
			setLogs([]);
		} catch (error) {
			console.error("Failed to clear dev logs:", error);
		}
	}, []);

	// Save dev logging preference to localStorage
	useEffect(() => {
		localStorage.setItem("notari-dev-logging", isEnabled.toString());
	}, [isEnabled]);

	// Auto-refresh logs when enabled
	useEffect(() => {
		if (!isEnabled) return;

		refreshLogs();
		const interval = setInterval(refreshLogs, 1000); // Refresh every second

		return () => clearInterval(interval);
	}, [isEnabled, refreshLogs]);

	// Convenience logging methods
	const logInfo = useCallback((message: string) => addLog("info", message), [addLog]);
	const logWarn = useCallback((message: string) => addLog("warn", message), [addLog]);
	const logError = useCallback((message: string) => addLog("error", message), [addLog]);
	const logDebug = useCallback((message: string) => addLog("debug", message), [addLog]);

	return {
		logs,
		isEnabled,
		setIsEnabled,
		addLog,
		refreshLogs,
		clearLogs,
		logInfo,
		logWarn,
		logError,
		logDebug,
	};
};
