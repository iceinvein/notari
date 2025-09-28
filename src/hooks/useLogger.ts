import { useEffect, useState } from "react";

import { type LogEntry, type LogLevel, logger } from "../utils/logger";

export const useLogger = () => {
	const [logs, setLogs] = useState<LogEntry[]>(() => logger.getLogs());

	useEffect(() => {
		const unsubscribe = logger.subscribe(setLogs);
		return unsubscribe;
	}, []);

	const clearLogs = () => {
		logger.clearLogs();
	};

	const exportLogs = () => {
		return logger.exportLogs();
	};

	const getLogsByLevel = (level: LogLevel) => {
		return logger.getLogsByLevel(level);
	};

	const getLogsByCategory = (category: string) => {
		return logger.getLogsByCategory(category);
	};

	return {
		logs,
		clearLogs,
		exportLogs,
		getLogsByLevel,
		getLogsByCategory,
	};
};
