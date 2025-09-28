import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { ExternalLink, Lock, Minimize2, Monitor, RefreshCw } from "lucide-react";
import type React from "react";
import { useMemo, useEffect } from "react";
import { useApplicationPreferencesQuery } from "../hooks/useApplicationPreferencesQuery";
import { recordingLogger } from "../utils/logger";
import {
	useOpenSystemSettingsMutation,
	useRecordingPermissionQuery,
	useRefreshWindows,
	useRequestRecordingPermissionMutation,
	useWindowsQuery,
} from "../lib/tauri-queries";
import type { WindowInfo } from "../types/window";
import AppHeader from "./AppHeader";
import ErrorBoundary from "./ErrorBoundary";
import WindowThumbnail from "./WindowThumbnail";

interface WindowPickerProps {
	onWindowSelect: (window: WindowInfo) => void;
	onBack: () => void;
}

const WindowPicker: React.FC<WindowPickerProps> = ({ onWindowSelect, onBack }) => {
	return (
		<ErrorBoundary>
			<WindowPickerContent onWindowSelect={onWindowSelect} onBack={onBack} />
		</ErrorBoundary>
	);
};

const WindowPickerContent: React.FC<WindowPickerProps> = ({ onWindowSelect, onBack }) => {
	// All hooks must be called unconditionally at the top level
	const { isApplicationAllowed } = useApplicationPreferencesQuery();

	// React Query hooks - always call these
	const { data: windows = [], isLoading: windowsLoading, error: windowsError } = useWindowsQuery();
	const {
		data: permission,
		isLoading: permissionLoading,
		error: permissionError,
	} = useRecordingPermissionQuery();

	const requestPermissionMutation = useRequestRecordingPermissionMutation();
	const openSystemSettingsMutation = useOpenSystemSettingsMutation();
	const refreshWindows = useRefreshWindows();

	// Filter windows based on user preferences - memoize with stable dependencies
	const filteredWindows = useMemo(() => {
		if (!windows || !isApplicationAllowed) return [];
		return windows.filter((window) => {
			try {
				return isApplicationAllowed(window.application);
			} catch (e) {
				console.error('Error filtering window:', e);
				return false;
			}
		});
	}, [windows, isApplicationAllowed]);

	// Combine loading states
	const loading = windowsLoading || permissionLoading;
	const error = windowsError || permissionError;

	const requestPermission = async () => {
		try {
			recordingLogger.info("Requesting recording permission...");
			const granted = await requestPermissionMutation.mutateAsync();
			if (!granted) {
				// Open system settings if needed
				recordingLogger.info("Permission not granted, opening system settings...");
				await openSystemSettingsMutation.mutateAsync();
			}
		} catch (err) {
			recordingLogger.error(`Failed to request permission: ${err}`);
		}
	};

	const handleRefreshWindows = () => {
		recordingLogger.info("Refreshing windows list...");
		refreshWindows();
	};

	// Log permission status when it changes - use useEffect to avoid conditional calls
	useEffect(() => {
		if (permission) {
			recordingLogger.info(
				`Permission status: granted=${permission.granted}, can_request=${permission.can_request}`
			);
		}
	}, [permission]);

	const handleWindowSelect = (window: WindowInfo) => {
		onWindowSelect(window);
	};

	if (loading) {
		return (
			<div className="w-full h-full flex items-center justify-center bg-background">
				<div className="text-center space-y-4">
					<Spinner size="lg" color="primary" />
					<p className="text-foreground-500">Loading available windows...</p>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="w-full h-full flex flex-col bg-background">
				<div className="flex-shrink-0 pb-3 px-4 pt-6">
					<h2 className="text-lg font-bold text-foreground">Error</h2>
				</div>
				<div className="w-full h-px bg-divider"></div>
				<div className="flex-1 pt-6 px-4 pb-4">
					<div className="space-y-4">
						<p className="text-danger text-sm">{error?.message || String(error)}</p>
						<div className="flex space-x-2">
							<Button variant="bordered" size="sm" onPress={onBack}>
								Back
							</Button>
							<Button color="primary" size="sm" onPress={handleRefreshWindows}>
								Retry
							</Button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (permission && !permission.granted) {
		return (
			<div className="w-full h-full flex flex-col bg-background">
				<div className="flex-shrink-0 pb-3 px-4 pt-6">
					<div className="flex items-center space-x-3">
						<div className="w-8 h-8 bg-warning rounded-full flex items-center justify-center">
							<Lock className="w-4 h-4 text-warning-foreground" />
						</div>
						<div>
							<h2 className="text-lg font-bold text-foreground">Permission Required</h2>
							<p className="text-xs text-foreground-500">Screen recording access needed</p>
						</div>
					</div>
				</div>
				<div className="w-full h-px bg-divider"></div>
				<div className="flex-1 pt-6 px-4 pb-4">
					<div className="space-y-4">
						<p className="text-sm text-foreground-600">{permission.message}</p>

						<div className="bg-content2 rounded-lg p-4 space-y-2">
							<h4 className="text-sm font-medium text-foreground">What happens next:</h4>
							<div className="space-y-1 text-xs text-foreground-500">
								<div className="flex items-start space-x-2">
									<span>1.</span>
									<span>System Preferences will open</span>
								</div>
								<div className="flex items-start space-x-2">
									<span>2.</span>
									<span>Navigate to Security & Privacy → Privacy → Screen Recording</span>
								</div>
								<div className="flex items-start space-x-2">
									<span>3.</span>
									<span>Check the box next to "Notari"</span>
								</div>
								<div className="flex items-start space-x-2">
									<span>4.</span>
									<span>Return to this app and try again</span>
								</div>
							</div>
						</div>

						<div className="flex space-x-2">
							<Button variant="bordered" size="sm" onPress={onBack}>
								Back
							</Button>
							<Button color="primary" size="sm" onPress={requestPermission}>
								Grant Permission
							</Button>
						</div>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="w-full h-full flex flex-col bg-background">
			<div className="flex-shrink-0 pb-4 px-2 pt-6">
				<AppHeader
					title="Select Window"
					subtitle="Choose a window to record"
					showBackButton={true}
					onBack={onBack}
					showSettingsButton={false}
					rightContent={
						<Button
							variant="light"
							size="md"
							onPress={handleRefreshWindows}
							isIconOnly
							className="hover:bg-content2"
						>
							<RefreshCw className="w-5 h-5" />
						</Button>
					}
				/>
			</div>
			<div className="w-full h-px bg-divider"></div>
			<div className="flex-1 pt-6 px-2 pb-6 flex flex-col min-h-0">
				{filteredWindows.length === 0 ? (
					<div className="flex-1 flex items-center justify-center">
						<div className="text-center">
							<div className="w-16 h-16 bg-default-100 rounded-full flex items-center justify-center mx-auto mb-4">
								<Monitor className="w-8 h-8 text-default-400" />
							</div>
							<h3 className="text-lg font-semibold text-foreground mb-2">
								{windows.length === 0 ? "No windows found" : "No allowed windows"}
							</h3>
							<p className="text-foreground-500 text-sm mb-6">
								{windows.length === 0
									? "Make sure you have applications open and try refreshing"
									: `${windows.length} window${windows.length !== 1 ? "s" : ""} available, but none match your allowed applications. Check Settings to manage your application list.`}
							</p>
							<Button
								color="primary"
								variant="flat"
								size="md"
								onPress={handleRefreshWindows}
								startContent={<RefreshCw className="w-4 h-4" />}
							>
								Refresh Windows
							</Button>
						</div>
					</div>
				) : (
					<div className="flex-1 min-h-0 flex flex-col">
						<div className="flex-1 space-y-3 px-2 overflow-y-auto pb-4">
							{filteredWindows.map((window) => (
								<button
									key={window.id}
									type="button"
									onClick={() => handleWindowSelect(window)}
									className="group relative w-full p-4 rounded-xl border border-default-200 bg-content1 hover:bg-content2 hover:border-primary/30 transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] text-left"
								>
									<div className="flex items-start space-x-4">
										{/* Thumbnail or App Icon */}
										<div className="relative">
											<WindowThumbnail window={window} />
											{window.is_minimized && (
												<div className="absolute -top-1 -right-1 w-5 h-5 bg-warning rounded-full flex items-center justify-center">
													<Minimize2 className="w-3 h-3 text-warning-foreground" />
												</div>
											)}
										</div>

										{/* Window Info */}
										<div className="flex-1 min-w-0 space-y-1">
											<div className="flex items-center justify-between">
												<h3 className="text-base font-semibold text-foreground truncate pr-2">
													{window.title}
												</h3>
												<ExternalLink className="w-4 h-4 text-foreground-400 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0" />
											</div>

											<p className="text-sm text-foreground-600 truncate">{window.application}</p>

											<div className="flex items-center space-x-4 text-xs text-foreground-500">
												<span className="flex items-center space-x-1">
													<Monitor className="w-3 h-3" />
													<span>
														{window.bounds.width} × {window.bounds.height}
													</span>
												</span>
												{window.is_minimized && (
													<Chip size="sm" color="warning" variant="flat" className="h-5">
														Minimized
													</Chip>
												)}
											</div>
										</div>
									</div>

									{/* Hover Effect Border */}
									<div className="absolute inset-0 rounded-xl border-2 border-primary/0 group-hover:border-primary/20 transition-colors duration-300 pointer-events-none" />
								</button>
							))}
						</div>

						{/* Footer */}
						<div className="flex-shrink-0 flex justify-between items-center pt-6 border-t border-default-100">
							<p className="text-xs text-foreground-400">
								{filteredWindows.length} window{filteredWindows.length !== 1 ? "s" : ""} available
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default WindowPicker;
