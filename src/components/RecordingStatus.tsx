import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Progress } from "@heroui/progress";
import { invoke } from "@tauri-apps/api/core";
import {
	AlertCircle,
	CheckCircle,
	Circle,
	Clock,
	Eye,
	EyeOff,
	HardDrive,
	Lock,
	Pause,
	Play,
	Shield,
	Square,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
	formatPublicKeyFingerprint,
	useHasSigningKeyQuery,
	usePublicKeyQuery,
} from "../hooks/useEvidence";
import {
	useActiveRecordingSessionQuery,
	useClearActiveRecordingMutation,
	usePauseRecordingMutation,
	useRecordingInfoQuery,
	useResumeRecordingMutation,
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
	const { data: activeSession } = useActiveRecordingSessionQuery();
	const { data: recordingInfo } = useRecordingInfoQuery(activeSession?.session_id || null);
	const [localDuration, setLocalDuration] = useState(0);

	const stopRecordingMutation = useStopRecordingMutation();
	const pauseRecordingMutation = usePauseRecordingMutation();
	const resumeRecordingMutation = useResumeRecordingMutation();
	const clearRecordingMutation = useClearActiveRecordingMutation();

	// Evidence system queries
	const { data: hasSigningKey } = useHasSigningKeyQuery();
	const { data: publicKey } = usePublicKeyQuery();

	// Decrypt and play state
	const [showPasswordModal, setShowPasswordModal] = useState(false);
	const [decryptPassword, setDecryptPassword] = useState("");
	const [showDecryptPassword, setShowDecryptPassword] = useState(false);
	const [decryptError, setDecryptError] = useState<string | null>(null);
	const [isDecrypting, setIsDecrypting] = useState(false);

	// Update local duration counter
	useEffect(() => {
		if (!activeSession || !isRecordingActive(activeSession.status)) {
			return;
		}

		const startTime = new Date(activeSession.start_time).getTime();
		const interval = setInterval(() => {
			const now = Date.now();
			const duration = Math.floor((now - startTime) / 1000);
			setLocalDuration(duration);
		}, 1000);

		return () => clearInterval(interval);
	}, [activeSession]);

	if (!activeSession) {
		return null;
	}

	const handleStop = () => {
		if (activeSession) {
			stopRecordingMutation.mutate(activeSession.session_id);
		}
	};

	const handlePause = () => {
		if (activeSession) {
			pauseRecordingMutation.mutate(activeSession.session_id);
		}
	};

	const handleResume = () => {
		if (activeSession) {
			resumeRecordingMutation.mutate(activeSession.session_id);
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
			case "Recording":
				return "success";
			case "Preparing":
				return "warning";
			case "Paused":
				return "secondary";
			case "Stopping":
				return "warning";
			case "Stopped":
				return "default";
			default:
				return "default";
		}
	};

	const getStatusIcon = (status: RecordingStatusType) => {
		if (isRecordingError(status)) return <AlertCircle className="w-4 h-4" />;
		switch (status) {
			case "Recording":
				return <Circle className="w-4 h-4 fill-current" />;
			case "Preparing":
				return <Clock className="w-4 h-4" />;
			case "Paused":
				return <Pause className="w-4 h-4" />;
			case "Stopping":
				return <Square className="w-4 h-4" />;
			case "Stopped":
				return <CheckCircle className="w-4 h-4" />;
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
				<CardBody className="p-4">
					<div className="flex items-center justify-between mb-3">
						<div className="flex items-center space-x-2">
							<Chip
								color={getStatusColor(activeSession.status)}
								variant="flat"
								startContent={getStatusIcon(activeSession.status)}
							>
								{typeof activeSession.status === "string" ? activeSession.status : "Error"}
							</Chip>
							<span className="text-sm text-foreground-600">
								Session: {activeSession.session_id.slice(0, 8)}...
							</span>
						</div>

						<div className="flex items-center space-x-2">
							{activeSession.status === "Recording" && (
								<Button
									size="sm"
									variant="flat"
									color="secondary"
									onPress={handlePause}
									isLoading={pauseRecordingMutation.isPending}
									startContent={<Pause className="w-4 h-4" />}
								>
									Pause
								</Button>
							)}

							{activeSession.status === "Paused" && (
								<Button
									size="sm"
									variant="flat"
									color="primary"
									onPress={handleResume}
									isLoading={resumeRecordingMutation.isPending}
									startContent={<Play className="w-4 h-4" />}
								>
									Resume
								</Button>
							)}

							{isRecordingActive(activeSession.status) && (
								<Button
									size="sm"
									color="danger"
									variant="flat"
									onPress={handleStop}
									isLoading={stopRecordingMutation.isPending}
									startContent={<Square className="w-4 h-4" />}
								>
									Stop
								</Button>
							)}

							{(activeSession.status === "Stopped" || isRecordingError(activeSession.status)) && (
								<>
									<Button
										size="sm"
										variant="flat"
										color="primary"
										onPress={handleOpenVideo}
										startContent={
											activeSession.output_path?.endsWith(".enc") ? (
												<Lock className="w-4 h-4" />
											) : (
												<Play className="w-4 h-4" />
											)
										}
									>
										Open Video
									</Button>
									<Button
										size="sm"
										variant="flat"
										onPress={handleClear}
										isLoading={clearRecordingMutation.isPending}
									>
										Clear
									</Button>
								</>
							)}
						</div>
					</div>

					{errorMessage && (
						<div className="mb-3 p-2 bg-danger-50 border border-danger-200 rounded-lg">
							<p className="text-sm text-danger-700">{errorMessage}</p>
						</div>
					)}

					<div className="grid grid-cols-2 gap-4 text-sm">
						<div className="flex items-center space-x-2">
							<Clock className="w-4 h-4 text-foreground-500" />
							<span>Duration: {formatRecordingDuration(duration)}</span>
						</div>

						{fileSize && (
							<div className="flex items-center space-x-2">
								<HardDrive className="w-4 h-4 text-foreground-500" />
								<span>Size: {formatFileSize(fileSize)}</span>
							</div>
						)}
					</div>

					{/* Evidence Status */}
					{hasSigningKey && (
						<div className="mt-3 p-2 bg-success-50 dark:bg-success-900/20 rounded-lg border border-success-200 dark:border-success-800">
							<div className="flex items-center space-x-2 text-sm">
								<Shield className="w-4 h-4 text-success-600 dark:text-success-400" />
								<span className="text-success-700 dark:text-success-300 font-medium">
									Evidence Enabled
								</span>
								{publicKey && (
									<span className="text-success-600 dark:text-success-400 text-xs">
										Key: {formatPublicKeyFingerprint(publicKey)}
									</span>
								)}
							</div>
							{activeSession.window_metadata && (
								<div className="mt-1 text-xs text-success-600 dark:text-success-400">
									Recording: {activeSession.window_metadata.title} (
									{activeSession.window_metadata.width}x{activeSession.window_metadata.height})
								</div>
							)}
						</div>
					)}

					{isRecordingActive(activeSession.status) && (
						<div className="mt-3">
							<Progress
								size="sm"
								color="success"
								isIndeterminate
								aria-label="Recording in progress"
							/>
						</div>
					)}

					<div className="mt-2 text-xs text-foreground-500">
						Output: {activeSession.output_path}
					</div>
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
