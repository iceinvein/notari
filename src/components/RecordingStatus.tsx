import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Progress } from "@heroui/progress";
import { useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import {
	AlertCircle,
	CheckCircle,
	Circle,
	Clock,
	Eye,
	EyeOff,
	Lock,
	Play,
	Shield,
	Square,
} from "lucide-react";
import { useState } from "react";
import { useRecordingProgress, useRecordingStateChanged } from "../hooks/useEventListener";
import {
	useActiveRecordingSessionQuery,
	useClearActiveRecordingMutation,
	useRecordingInfoQuery,
	useStopRecordingMutation,
} from "../hooks/useRecordingSystem";
import type { RecordingStatus as RecordingStatusType } from "../types/recording";
import {
	formatFileSize,
	formatRecordingDuration,
	getRecordingErrorMessage,
	isRecordingActive,
	isRecordingError,
} from "../types/recording";

type RecordingStatusProps = {
	className?: string;
	compact?: boolean;
};

export default function RecordingStatus({ className = "", compact = false }: RecordingStatusProps) {
	const queryClient = useQueryClient();
	const { data: activeSession } = useActiveRecordingSessionQuery();
	const { data: recordingInfo } = useRecordingInfoQuery(activeSession?.session_id || null);
	const [localDuration, setLocalDuration] = useState(0);

	const stopRecordingMutation = useStopRecordingMutation();
	const clearRecordingMutation = useClearActiveRecordingMutation();

	// Decrypt and play state
	const [showPasswordModal, setShowPasswordModal] = useState(false);
	const [decryptPassword, setDecryptPassword] = useState("");
	const [showDecryptPassword, setShowDecryptPassword] = useState(false);
	const [decryptError, setDecryptError] = useState<string | null>(null);
	const [isDecrypting, setIsDecrypting] = useState(false);

	// Listen to recording state changes
	useRecordingStateChanged(() => {
		// Invalidate queries when recording state changes
		queryClient.invalidateQueries({ queryKey: ["recording", "activeSession"] });
		queryClient.invalidateQueries({ queryKey: ["recording", "hasActive"] });
		// Note: Navigation to videos tab is handled in RecordMode component
	});

	// Listen to recording progress updates (replaces setInterval)
	useRecordingProgress((event) => {
		if (activeSession && event.sessionId === activeSession.session_id) {
			setLocalDuration(event.durationSeconds);
		}
	});

	if (!activeSession) {
		return null;
	}

	const handleStop = () => {
		if (activeSession) {
			stopRecordingMutation.mutate(activeSession.session_id);
			// Note: Navigation to recorded videos tab happens automatically
			// when the recording reaches "Completed" state (see useRecordingStateChanged above)
		}
	};

	const handleClear = () => {
		clearRecordingMutation.mutate();
	};

	const handleOpenVideo = async () => {
		if (!activeSession?.output_path) return;

		// Check if video is encrypted (has .enc extension)
		const isEncrypted = activeSession.output_path.endsWith(".enc");

		if (isEncrypted) {
			// Show password modal for encrypted videos
			setShowPasswordModal(true);
		} else {
			// Open unencrypted video directly
			try {
				await invoke("open_file_in_default_app", { path: activeSession.output_path });
			} catch (error) {
				console.error("Failed to open video:", error);
			}
		}
	};

	const handleDecryptAndPlay = async () => {
		if (!activeSession?.output_path) return;

		setIsDecrypting(true);
		setDecryptError(null);

		try {
			// Load manifest file to get encryption info
			const manifestPath = activeSession.output_path.replace(/\.[^/.]+$/, ".json");
			const manifestContent = await invoke<string>("read_file", { path: manifestPath });
			const manifest = JSON.parse(manifestContent);

			// Get encryption info from manifest
			const encryptionInfo = manifest.recording?.encryption;
			if (!encryptionInfo) {
				throw new Error("No encryption info found in manifest");
			}

			// Decrypt and play
			await invoke("decrypt_and_play_video", {
				encryptedPath: activeSession.output_path,
				password: decryptPassword,
				encryptionInfo,
			});

			// Close modal on success
			setShowPasswordModal(false);
			setDecryptPassword("");
		} catch (error) {
			console.error("Failed to decrypt video:", error);
			setDecryptError(error instanceof Error ? error.message : "Decryption failed");
		} finally {
			setIsDecrypting(false);
		}
	};

	const getStatusColor = (status: RecordingStatusType) => {
		if (isRecordingError(status)) return "danger";
		switch (status) {
			case "Idle":
				return "default";
			case "Preparing":
				return "primary";
			case "Recording":
				return "success";
			case "Stopping":
				return "warning";
			case "Processing":
				return "secondary";
			case "Completed":
				return "success";
			case "Failed":
				return "danger";
			default:
				return "default";
		}
	};

	const getStatusIcon = (status: RecordingStatusType) => {
		if (isRecordingError(status)) return <AlertCircle className="w-4 h-4" />;
		switch (status) {
			case "Idle":
				return <Circle className="w-4 h-4" />;
			case "Preparing":
				return <Clock className="w-4 h-4" />;
			case "Recording":
				return <Circle className="w-4 h-4 fill-current" />;
			case "Stopping":
				return <Square className="w-4 h-4" />;
			case "Processing":
				return <Clock className="w-4 h-4 animate-spin" />;
			case "Completed":
				return <CheckCircle className="w-4 h-4" />;
			case "Failed":
				return <AlertCircle className="w-4 h-4" />;
			default:
				return <Circle className="w-4 h-4" />;
		}
	};

	const duration = recordingInfo?.duration_seconds || localDuration;
	const fileSize = recordingInfo?.file_size_bytes;
	const errorMessage = getRecordingErrorMessage(activeSession.status);

	if (compact) {
		return (
			<div className={`flex items-center space-x-2 ${className}`}>
				<Chip
					color={getStatusColor(activeSession.status)}
					variant="flat"
					startContent={getStatusIcon(activeSession.status)}
					size="sm"
				>
					{typeof activeSession.status === "string" ? activeSession.status : "Error"}
				</Chip>
				{isRecordingActive(activeSession.status) && (
					<span className="text-sm text-foreground-600">{formatRecordingDuration(duration)}</span>
				)}
			</div>
		);
	}

	return (
		<>
			<Card className={`w-full ${className}`}>
				<CardBody className="p-4 space-y-4">
					{/* Header with Status and Controls */}
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<div
								className={`w-3 h-3 rounded-full ${
									activeSession.status === "Recording"
										? "bg-danger animate-pulse"
										: activeSession.status === "Processing"
											? "bg-secondary animate-pulse"
											: activeSession.status === "Completed"
												? "bg-success"
												: activeSession.status === "Failed"
													? "bg-danger"
													: "bg-primary"
								}`}
							/>
							<div>
								<p className="text-sm font-medium">
									{typeof activeSession.status === "string" ? activeSession.status : "Error"}
								</p>
								<p className="text-xs text-foreground-500">
									{formatRecordingDuration(duration)}
									{fileSize && fileSize > 0 && <> • {formatFileSize(fileSize)}</>}
								</p>
							</div>
						</div>

						<div className="flex items-center gap-2">
							{activeSession.status === "Recording" && (
								<Button
									isIconOnly
									size="sm"
									color="danger"
									variant="flat"
									onPress={handleStop}
									isLoading={stopRecordingMutation.isPending}
									aria-label="Stop"
								>
									<Square className="w-4 h-4" />
								</Button>
							)}

							{(activeSession.status === "Completed" || isRecordingError(activeSession.status)) && (
								<>
									<Button
										isIconOnly
										size="sm"
										variant="flat"
										color="primary"
										onPress={handleOpenVideo}
										aria-label="Open Video"
									>
										{activeSession.output_path?.endsWith(".enc") ? (
											<Lock className="w-4 h-4" />
										) : (
											<Play className="w-4 h-4" />
										)}
									</Button>
									<Button
										isIconOnly
										size="sm"
										variant="flat"
										onPress={handleClear}
										isLoading={clearRecordingMutation.isPending}
										aria-label="Clear"
									>
										<Circle className="w-4 h-4" />
									</Button>
								</>
							)}
						</div>
					</div>

					{errorMessage && (
						<div className="p-2 bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 rounded-lg">
							<p className="text-sm text-danger-700 dark:text-danger-300">{errorMessage}</p>
						</div>
					)}

					{/* Metadata Display */}
					{(activeSession.recording_title ||
						activeSession.recording_description ||
						(activeSession.recording_tags && activeSession.recording_tags.length > 0)) && (
						<div className="p-3 bg-content2 rounded-lg space-y-2">
							<p className="text-xs font-medium text-foreground-500">Recording Metadata</p>
							{activeSession.recording_title && (
								<div className="space-y-1">
									<p className="text-xs text-foreground-500">Title</p>
									<p className="text-sm font-medium">{activeSession.recording_title}</p>
								</div>
							)}
							{activeSession.recording_description && (
								<div className="space-y-1">
									<p className="text-xs text-foreground-500">Description</p>
									<p className="text-sm">{activeSession.recording_description}</p>
								</div>
							)}
							{activeSession.recording_tags && activeSession.recording_tags.length > 0 && (
								<div className="space-y-1">
									<p className="text-xs text-foreground-500">Tags</p>
									<div className="flex flex-wrap gap-1">
										{activeSession.recording_tags.map((tag) => (
											<Chip key={tag} size="sm" variant="flat" color="primary">
												{tag}
											</Chip>
										))}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Recording Info */}
					{activeSession.window_metadata && isRecordingActive(activeSession.status) && (
						<div className="flex items-center gap-2 text-xs text-foreground-500">
							<Shield className="w-3.5 h-3.5" />
							<span className="truncate">
								{activeSession.window_metadata.title} ({activeSession.window_metadata.width}x
								{activeSession.window_metadata.height})
							</span>
						</div>
					)}

					{/* Progress Bar */}
					{isRecordingActive(activeSession.status) && (
						<Progress
							size="sm"
							color="success"
							isIndeterminate
							aria-label="Recording in progress"
						/>
					)}
				</CardBody>
			</Card>

			{/* Decrypt Password Modal */}
			<Modal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)}>
				<ModalContent>
					<ModalHeader>Enter Decryption Password</ModalHeader>
					<ModalBody>
						<p className="text-sm text-foreground-500 mb-4">
							This video is encrypted. Enter the password you used during recording to decrypt and
							play it.
						</p>
						<Input
							type={showDecryptPassword ? "text" : "password"}
							label="Password"
							placeholder="Enter decryption password"
							value={decryptPassword}
							onValueChange={(value) => {
								setDecryptPassword(value);
								setDecryptError(null);
							}}
							isInvalid={!!decryptError}
							errorMessage={decryptError}
							endContent={
								<button
									className="focus:outline-none"
									type="button"
									onClick={() => setShowDecryptPassword(!showDecryptPassword)}
								>
									{showDecryptPassword ? (
										<EyeOff className="w-4 h-4 text-foreground-400" />
									) : (
										<Eye className="w-4 h-4 text-foreground-400" />
									)}
								</button>
							}
							autoFocus
						/>
					</ModalBody>
					<ModalFooter>
						<Button variant="flat" onPress={() => setShowPasswordModal(false)}>
							Cancel
						</Button>
						<Button
							color="primary"
							onPress={handleDecryptAndPlay}
							isLoading={isDecrypting}
							isDisabled={!decryptPassword}
						>
							Decrypt & Play
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</>
	);
}
