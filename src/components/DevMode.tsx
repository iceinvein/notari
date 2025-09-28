import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { ScrollShadow } from "@heroui/scroll-shadow";
import { Switch } from "@heroui/switch";
import { ArrowLeft, Bug, Check, Copy, RefreshCw, Trash2 } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { type LogEntry, useDevLogger } from "../hooks/useDevLogger";

interface DevModeProps {
	onBack: () => void;
}

const DevMode: React.FC<DevModeProps> = ({ onBack }) => {
	const { logs, isEnabled, setIsEnabled, refreshLogs, clearLogs, logInfo, logWarn, logError } =
		useDevLogger();

	const [copySuccess, setCopySuccess] = useState(false);

	const getLevelColor = (level: string) => {
		switch (level.toLowerCase()) {
			case "error":
				return "danger";
			case "warn":
				return "warning";
			case "info":
				return "primary";
			case "debug":
				return "secondary";
			default:
				return "default";
		}
	};

	const getSourceColor = (source: string) => {
		return source === "frontend" ? "success" : "secondary";
	};

	const formatTimestamp = (timestamp: string) => {
		return new Date(timestamp).toLocaleTimeString();
	};

	const testLogs = () => {
		logInfo("Test info message from frontend");
		logWarn("Test warning message from frontend");
		logError("Test error message from frontend");
	};

	// Utility function to copy text to clipboard with fallback
	const copyToClipboard = async (text: string, onSuccess?: () => void): Promise<void> => {
		try {
			// Try modern clipboard API first
			if (navigator.clipboard && window.isSecureContext) {
				await navigator.clipboard.writeText(text);
				onSuccess?.();
				return;
			}
		} catch (_err) {
			// Fall through to fallback method
		}

		// Fallback for older browsers or non-secure contexts
		const textArea = document.createElement("textarea");
		textArea.value = text;
		textArea.style.position = "absolute";
		textArea.style.left = "-9999px";
		textArea.style.top = "-9999px";
		textArea.setAttribute("readonly", "");
		document.body.appendChild(textArea);

		try {
			textArea.select();
			textArea.setSelectionRange(0, text.length);
			textArea.focus();

			// Text is selected for manual copying (Ctrl+C)
			onSuccess?.();
		} finally {
			// Clean up after a short delay to allow manual copying
			setTimeout(() => {
				if (document.body.contains(textArea)) {
					document.body.removeChild(textArea);
				}
			}, 100);
		}
	};

	const copyAllLogs = async () => {
		const logText = logs
			.map(
				(log) =>
					`[${formatTimestamp(log.timestamp)}] ${log.level.toUpperCase()} (${log.source}): ${log.message}`
			)
			.join("\n");

		await copyToClipboard(logText, () => {
			setCopySuccess(true);
			setTimeout(() => setCopySuccess(false), 2000);
		});
	};

	const copyLog = async (log: LogEntry) => {
		const logText = `[${formatTimestamp(log.timestamp)}] ${log.level.toUpperCase()} (${log.source}): ${log.message}`;

		try {
			await copyToClipboard(logText);
		} catch {
			// Clipboard operation failed - could show a toast notification here
			// For now, we'll silently fail
		}
	};

	return (
		<div className="w-full h-full flex flex-col bg-background">
			{/* Header */}
			<div className="flex-shrink-0 pb-4 px-6 pt-6">
				<div className="flex items-center justify-between w-full">
					<div className="flex items-center space-x-4">
						<Button
							variant="light"
							size="md"
							onPress={onBack}
							isIconOnly
							className="hover:bg-content2"
						>
							<ArrowLeft className="w-5 h-5" />
						</Button>
						<div className="w-12 h-12 bg-gradient-to-br from-danger/20 to-danger/10 rounded-xl flex items-center justify-center border border-danger/20">
							<Bug className="w-6 h-6 text-danger" />
						</div>
						<div>
							<h2 className="text-xl font-bold text-foreground">Dev Logs</h2>
							<p className="text-sm text-foreground-500">Debug logs and testing (Ctrl+Shift+L)</p>
						</div>
					</div>
					<div className="flex items-center space-x-4">
						<Switch isSelected={isEnabled} onValueChange={setIsEnabled} color="primary" size="sm">
							Enable Logging
						</Switch>
					</div>
				</div>
			</div>

			{/* Divider */}
			<div className="w-full h-px bg-divider" />

			{/* Content */}
			<div className="flex-1 pt-6 px-6 pb-6 flex flex-col min-h-0">
				{/* Help Text */}
				{!isEnabled && (
					<div className="flex-shrink-0 mb-4 p-3 rounded-lg bg-content2 border border-default-200">
						<p className="text-sm text-foreground-600">
							<strong>Access Dev Logs:</strong> Press{" "}
							<kbd className="px-2 py-1 bg-content3 rounded text-xs">Ctrl+Shift+L</kbd> from
							anywhere in the app
						</p>
					</div>
				)}

				{/* Controls */}
				<div className="flex-shrink-0 flex items-center justify-between mb-4">
					<div className="flex items-center space-x-2">
						<Button
							size="sm"
							variant="flat"
							color="primary"
							onPress={testLogs}
							disabled={!isEnabled}
						>
							Test Logs
						</Button>
						<Button size="sm" variant="flat" onPress={refreshLogs} isIconOnly disabled={!isEnabled}>
							<RefreshCw className="w-4 h-4" />
						</Button>
						<Button
							size="sm"
							variant="flat"
							color="danger"
							onPress={clearLogs}
							isIconOnly
							disabled={!isEnabled}
						>
							<Trash2 className="w-4 h-4" />
						</Button>
						<Button
							size="sm"
							variant="flat"
							color="success"
							onPress={copyAllLogs}
							isIconOnly
							disabled={!isEnabled || logs.length === 0}
						>
							{copySuccess ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
						</Button>
					</div>
					<div className="flex items-center space-x-2">
						<Chip size="sm" variant="flat">
							{logs.length} logs
						</Chip>
						{copySuccess && (
							<Chip size="sm" color="success" variant="flat">
								Copied!
							</Chip>
						)}
					</div>
				</div>

				{/* Logs Display */}
				<Card className="flex-1 min-h-0">
					<CardHeader className="pb-2">
						<h3 className="text-lg font-semibold">Debug Logs</h3>
					</CardHeader>
					<CardBody className="pt-0">
						{!isEnabled ? (
							<div className="flex-1 flex items-center justify-center text-center">
								<div>
									<Bug className="w-12 h-12 text-foreground-300 mx-auto mb-4" />
									<p className="text-foreground-500">Enable logging to see debug information</p>
								</div>
							</div>
						) : logs.length === 0 ? (
							<div className="flex-1 flex items-center justify-center text-center">
								<div>
									<Bug className="w-12 h-12 text-foreground-300 mx-auto mb-4" />
									<p className="text-foreground-500">No logs yet</p>
									<p className="text-sm text-foreground-400">Interact with the app to see logs</p>
								</div>
							</div>
						) : (
							<ScrollShadow className="h-full">
								<div className="space-y-2">
									{logs.map((log) => (
										<div
											key={log.message + log.timestamp}
											className="p-3 rounded-lg bg-content2 border border-default-200"
										>
											<div className="flex items-start justify-between mb-2">
												<div className="flex items-center space-x-2">
													<Chip size="sm" color={getLevelColor(log.level)} variant="flat">
														{log.level.toUpperCase()}
													</Chip>
													<Chip size="sm" color={getSourceColor(log.source)} variant="dot">
														{log.source}
													</Chip>
												</div>
												<div className="flex items-center space-x-2">
													<Button
														size="sm"
														variant="light"
														isIconOnly
														onPress={() => copyLog(log)}
														className="min-w-unit-6 w-6 h-6"
													>
														<Copy className="w-3 h-3" />
													</Button>
													<span className="text-xs text-foreground-400">
														{formatTimestamp(log.timestamp)}
													</span>
												</div>
											</div>
											<p className="text-sm text-foreground font-mono break-all">{log.message}</p>
										</div>
									))}
								</div>
							</ScrollShadow>
						)}
					</CardBody>
				</Card>
			</div>
		</div>
	);
};

export default DevMode;
