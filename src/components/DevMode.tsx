import { Button } from "@heroui/button";
import { ArrowLeft, Bug } from "lucide-react";
import type React from "react";

import { appLogger } from "../utils/logger";

interface DevModeProps {
	onBack: () => void;
}

const DevMode: React.FC<DevModeProps> = ({ onBack }) => {
	const testLogs = () => {
		appLogger.debug("Test debug message from DevMode");
		appLogger.info("Test info message from DevMode");
		appLogger.warn("Test warning message from DevMode");
		appLogger.error("Test error message from DevMode", new Error("Test error"));
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
							<h2 className="text-xl font-bold text-foreground">Developer Tools</h2>
							<p className="text-sm text-foreground-500">Debug tools and application logs</p>
						</div>
					</div>
				</div>
			</div>

			{/* Divider */}
			<div className="w-full h-px bg-divider" />

			{/* Content */}
			<div className="flex-1 pt-6 px-6 pb-6 flex flex-col min-h-0 space-y-4">
				{/* Test Logs Section */}
				<div className="flex-shrink-0 p-4 rounded-lg bg-content1 border border-default-200">
					<h3 className="text-lg font-semibold mb-2">Test Logging</h3>
					<p className="text-sm text-foreground-500 mb-4">
						Generate test log entries to verify the logging system is working.
					</p>
					<Button size="sm" variant="flat" color="primary" onPress={testLogs}>
						Generate Test Logs
					</Button>
				</div>

				{/* Application Logs Section */}
				<div className="flex-shrink-0 p-4 rounded-lg bg-content1 border border-default-200">
					<h3 className="text-lg font-semibold mb-2">Application Logs</h3>
					<p className="text-sm text-foreground-500 mb-4">
						Application logs are now available in Settings → Logs tab for easy access.
					</p>
					<p className="text-xs text-foreground-400">
						💡 Tip: Use the Logs tab to export logs for troubleshooting or support.
					</p>
				</div>
			</div>
		</div>
	);
};

export default DevMode;
