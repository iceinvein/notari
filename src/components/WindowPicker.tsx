import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Spinner } from "@heroui/spinner";
import { invoke } from "@tauri-apps/api/core";
import {
	ArrowLeft,
	ExternalLink,
	Lock,
	Minimize2,
	Monitor,
	RefreshCw,
	Smartphone,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { useDevLogger } from "../hooks/useDevLogger";

interface WindowInfo {
	id: string;
	title: string;
	application: string;
	is_minimized: boolean;
	bounds: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	thumbnail?: string;
}

interface PermissionStatus {
	granted: boolean;
	can_request: boolean;
	system_settings_required: boolean;
	message: string;
}

interface WindowPickerProps {
	onWindowSelect: (window: WindowInfo) => void;
	onBack: () => void;
}

const WindowPicker: React.FC<WindowPickerProps> = ({ onWindowSelect, onBack }) => {
	const [windows, setWindows] = useState<WindowInfo[]>([]);
	const [permission, setPermission] = useState<PermissionStatus | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [loadingThumbnails, setLoadingThumbnails] = useState<Set<string>>(new Set());
	const { logInfo, logWarn, logError } = useDevLogger();

	const checkPermission = async () => {
		try {
			const status = await invoke<PermissionStatus>("check_recording_permission");
			setPermission(status);
			return status;
		} catch (err) {
			const errorMsg = `Failed to check permission: ${err}`;
			setError(errorMsg);
			return null;
		}
	};

	const requestPermission = async () => {
		try {
			setLoading(true);
			const granted = await invoke<boolean>("request_recording_permission");
			if (!granted) {
				// Open system settings if needed
				await invoke("open_system_settings");
			}
			// Recheck permission after request
			await checkPermission();
		} catch (err) {
			setError(`Failed to request permission: ${err}`);
		} finally {
			setLoading(false);
		}
	};

	const loadWindows = async () => {
		try {
			setLoading(true);
			const windowList = await invoke<WindowInfo[]>("get_available_windows");
			setWindows(windowList);
			setError(null);

			// Load thumbnails for windows that support it
			loadThumbnails(windowList);
		} catch (err) {
			const errorMsg = `Failed to load windows: ${err}`;
			setError(errorMsg);
		} finally {
			setLoading(false);
		}
	};

	const loadThumbnails = useCallback(
		async (windowList: WindowInfo[]) => {
			// Only load thumbnails for windows with CoreGraphics IDs (cg_*)
			const thumbnailWindows = windowList.filter((w) => w.id.startsWith("cg_"));

			logInfo(`Loading thumbnails for ${thumbnailWindows.length} windows`);

			for (const window of thumbnailWindows) {
				if (!window.thumbnail) {
					setLoadingThumbnails((prev) => new Set(prev).add(window.id));

					try {
						const thumbnail = await invoke<string | null>("get_window_thumbnail", {
							windowId: window.id,
						});

						if (thumbnail) {
							setWindows((prev) => prev.map((w) => (w.id === window.id ? { ...w, thumbnail } : w)));
						}
					} catch (err) {
						logWarn(`Failed to load thumbnail for window ${window.id}: ${err}`);
					} finally {
						setLoadingThumbnails((prev) => {
							const newSet = new Set(prev);
							newSet.delete(window.id);
							return newSet;
						});
					}
				}
			}
		},
		[logInfo, logWarn]
	);

	const refreshWindows = async () => {
		await loadWindows();
	};

	useEffect(() => {
		const checkPermissionInternal = async () => {
			try {
				logInfo("Checking recording permissions...");
				const status = await invoke<PermissionStatus>("check_recording_permission");
				logInfo(`Permission status: granted=${status.granted}, can_request=${status.can_request}`);
				setPermission(status);
				return status;
			} catch (err) {
				const errorMsg = `Failed to check permission: ${err}`;
				logError(errorMsg);
				setError(errorMsg);
				return null;
			}
		};

		const loadWindowsInternal = async () => {
			try {
				logInfo("Starting to load windows...");
				setLoading(true);
				const windowList = await invoke<WindowInfo[]>("get_available_windows");
				logInfo(`Loaded ${windowList.length} windows from backend`);
				setWindows(windowList);
				setError(null);

				// Load thumbnails for windows with CoreGraphics IDs
				await loadThumbnails(windowList);
			} catch (err) {
				const errorMsg = `Failed to load windows: ${err}`;
				logError(errorMsg);
				setError(errorMsg);
			} finally {
				setLoading(false);
			}
		};

		const initialize = async () => {
			logInfo("WindowPicker initializing...");
			const permissionStatus = await checkPermissionInternal();
			if (permissionStatus?.granted) {
				logInfo("Permissions granted, loading windows...");
				await loadWindowsInternal();
			} else {
				logWarn("Permissions not granted, skipping window loading");
				setLoading(false);
			}
		};

		initialize();
	}, [loadThumbnails, logInfo, logError, logWarn]);

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
						<p className="text-danger text-sm">{error}</p>
						<div className="flex space-x-2">
							<Button variant="bordered" size="sm" onPress={onBack}>
								Back
							</Button>
							<Button color="primary" size="sm" onPress={refreshWindows}>
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
						<div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-xl flex items-center justify-center shadow-lg">
							<Monitor className="w-6 h-6 text-primary-foreground" />
						</div>
						<div>
							<h2 className="text-xl font-bold text-foreground">Select Window</h2>
							<p className="text-sm text-foreground-500">Choose a window to record</p>
						</div>
					</div>
					<div className="flex space-x-2">
						<Button
							variant="light"
							size="md"
							onPress={refreshWindows}
							isIconOnly
							className="hover:bg-content2"
						>
							<RefreshCw className="w-5 h-5" />
						</Button>
					</div>
				</div>
			</div>
			<div className="w-full h-px bg-divider"></div>
			<div className="flex-1 pt-6 px-2 pb-6 flex flex-col min-h-0">
				{windows.length === 0 ? (
					<div className="flex-1 flex items-center justify-center">
						<div className="text-center">
							<div className="w-16 h-16 bg-default-100 rounded-full flex items-center justify-center mx-auto mb-4">
								<Monitor className="w-8 h-8 text-default-400" />
							</div>
							<h3 className="text-lg font-semibold text-foreground mb-2">No windows found</h3>
							<p className="text-foreground-500 text-sm mb-6">
								Make sure you have applications open and try refreshing
							</p>
							<Button
								color="primary"
								variant="flat"
								size="md"
								onPress={refreshWindows}
								startContent={<RefreshCw className="w-4 h-4" />}
							>
								Refresh Windows
							</Button>
						</div>
					</div>
				) : (
					<div className="flex-1 min-h-0 flex flex-col">
						<div className="flex-1 space-y-3 px-2 overflow-y-auto pb-4">
							{windows.map((window) => (
								<button
									key={window.id}
									type="button"
									onClick={() => handleWindowSelect(window)}
									className="group relative w-full p-4 rounded-xl border border-default-200 bg-content1 hover:bg-content2 hover:border-primary/30 transition-all duration-300 cursor-pointer hover:shadow-lg hover:scale-[1.02] text-left"
								>
									<div className="flex items-start space-x-4">
										{/* Thumbnail or App Icon */}
										<div className="relative">
											{window.thumbnail ? (
												<div className="w-20 h-16 rounded-xl overflow-hidden border border-default-200 bg-content2">
													<img
														src={window.thumbnail}
														alt={`${window.title} thumbnail`}
														className="w-full h-full object-cover"
													/>
												</div>
											) : loadingThumbnails.has(window.id) ? (
												<div className="w-20 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
													<Spinner size="sm" color="primary" />
												</div>
											) : (
												<div className="w-20 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center border border-primary/20">
													<Smartphone className="w-8 h-8 text-primary" />
												</div>
											)}
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
								{windows.length} window{windows.length !== 1 ? "s" : ""} available
							</p>
						</div>
					</div>
				)}
			</div>
		</div>
	);
};

export default WindowPicker;
