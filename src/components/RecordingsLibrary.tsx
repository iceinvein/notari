import { Alert } from "@heroui/alert";
import { Button } from "@heroui/button";
import { Card, CardBody, CardFooter, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Spinner } from "@heroui/spinner";
import { useQuery } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import {
	AlertCircle,
	Anchor,
	ExternalLink,
	Eye,
	EyeOff,
	FileVideo,
	FolderOpen,
	Info,
	Lock,
	RefreshCw,
	Shield,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import {
	type RecordingEntry,
	useDeleteRecordingMutation,
	useRecordingsQuery,
} from "../hooks/useRecordingSystem";
import { logger } from "../utils/logger";
import BlockchainAnchorButton from "./BlockchainAnchorButton";

type BlockchainConfig = {
	enabled: boolean;
	environment: string;
	chain_id: number;
	chain_name: string;
	auto_anchor: boolean;
	has_wallet: boolean;
	wallet_address?: string;
};
import { VideoPlayer } from "./VideoPlayer";

type BlockchainAnchorCheck = {
	present: boolean;
	algorithm: string;
	anchored_at: string;
	explorer_url?: string;
};

type VerificationReport = {
	verification: {
		timestamp: string;
		status: "VERIFIED" | "FAILED" | "WARNING";
		checks: {
			manifest_structure: "PASS" | "FAIL" | "SKIP";
			signature_valid: "PASS" | "FAIL" | "SKIP";
			hash_match: "PASS" | "FAIL" | "SKIP";
			blockchain_anchor?: BlockchainAnchorCheck;
		};
		recording_info: {
			session_id: string;
			created_at: string;
			duration_seconds: number;
			window_title: string;
			title?: string;
			description?: string;
			tags?: string[];
		};
		signature_info: {
			algorithm: string;
			public_key: string;
			verified_by: string;
		};
	};
};

type EvidenceManifest = {
	version: string;
	recording: {
		session_id: string;
		file_path: string;
		encrypted: boolean;
		encryption?: {
			algorithm: string;
			key_derivation: {
				algorithm: string;
				iterations: number;
				salt: string;
			};
			nonce: string;
		};
	};
};

type RecordingsLibraryProps = {
	onSettings?: () => void;
};

export default function RecordingsLibrary({ onSettings }: RecordingsLibraryProps = {}) {
	// React Query hooks
	const { data: recordings = [], isLoading, error, refetch } = useRecordingsQuery();
	const deleteRecordingMutation = useDeleteRecordingMutation();

	// Modal state
	const [showPasswordModal, setShowPasswordModal] = useState(false);
	const [selectedRecording, setSelectedRecording] = useState<RecordingEntry | null>(null);
	const [decryptPassword, setDecryptPassword] = useState("");
	const [showDecryptPassword, setShowDecryptPassword] = useState(false);
	const [decryptError, setDecryptError] = useState<string | null>(null);
	const [isDecrypting, setIsDecrypting] = useState(false);

	// Delete confirmation state
	const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
	const [recordingToDelete, setRecordingToDelete] = useState<RecordingEntry | null>(null);

	// Verification result state
	const [showVerifyResult, setShowVerifyResult] = useState(false);
	const [verifyResult, setVerifyResult] = useState<VerificationReport | null>(null);
	const [isVerifying, setIsVerifying] = useState(false);

	// Video player state
	const [showVideoPlayer, setShowVideoPlayer] = useState(false);
	const [videoPlayerRecording, setVideoPlayerRecording] = useState<RecordingEntry | null>(null);
	const [videoPlayerPassword, setVideoPlayerPassword] = useState("");

	// Blockchain banner state
	const [blockchainBannerDismissed, setBlockchainBannerDismissed] = useState(false);

	// Load blockchain config to check if enabled
	const { data: blockchainConfig, isLoading: configLoading } = useQuery({
		queryKey: ["blockchainConfig"],
		queryFn: async () => {
			const config = await invoke<BlockchainConfig>("get_blockchain_config");
			return config;
		},
	});

	const handlePlayVideo = async (recording: RecordingEntry) => {
		if (recording.is_encrypted) {
			// Show password modal for encrypted videos
			setSelectedRecording(recording);
			setShowPasswordModal(true);
		} else {
			// Open unencrypted videos directly in player
			setVideoPlayerRecording(recording);
			setVideoPlayerPassword("");
			setShowVideoPlayer(true);
		}
	};

	const handleDecryptAndPlay = async () => {
		if (!selectedRecording) return;

		setIsDecrypting(true);
		setDecryptError(null);

		try {
			logger.info("RecordingsLibrary", "Attempting to decrypt and play", {
				path: selectedRecording.manifest_path,
				is_encrypted: selectedRecording.is_encrypted,
			});

			// Validate password by loading manifest
			const manifest = await invoke<EvidenceManifest>("get_evidence_manifest", {
				manifestPath: selectedRecording.manifest_path,
			});

			logger.info("RecordingsLibrary", "Manifest loaded", {
				encrypted: manifest.recording?.encrypted,
				has_encryption_info: !!manifest.recording?.encryption,
			});

			const encryptionInfo = manifest.recording?.encryption;
			if (!encryptionInfo) {
				throw new Error(
					`No encryption info found in manifest. Recording encrypted flag: ${manifest.recording?.encrypted}`
				);
			}

			// Password is valid, open in video player
			logger.info("RecordingsLibrary", "Opening video player with password", {
				password_length: decryptPassword.length,
				has_password: decryptPassword.length > 0,
			});

			setVideoPlayerRecording(selectedRecording);
			setVideoPlayerPassword(decryptPassword);
			setShowVideoPlayer(true);

			// Close password modal
			setShowPasswordModal(false);
			setDecryptPassword("");
			setSelectedRecording(null);
		} catch (err) {
			console.error("Failed to validate password:", err);
			logger.error("RecordingsLibrary", "Decrypt and play failed", err as Error);
			setDecryptError(err instanceof Error ? err.message : "Invalid password");
		} finally {
			setIsDecrypting(false);
		}
	};

	const handleCloseVideoPlayer = () => {
		setShowVideoPlayer(false);
		setVideoPlayerRecording(null);
		setVideoPlayerPassword("");
	};

	const handleVerifyRecording = async (recording: RecordingEntry) => {
		if (!recording.has_manifest) {
			return;
		}

		setIsVerifying(true);
		try {
			const result = await invoke<VerificationReport>("verify_recording", {
				manifestPath: recording.manifest_path,
				videoPath: recording.video_path,
			});

			setVerifyResult(result);
			setShowVerifyResult(true);
		} catch (error) {
			console.error("Verification failed:", error);
			// Show error in result modal
			setVerifyResult({
				verification: {
					timestamp: new Date().toISOString(),
					status: "FAILED",
					checks: {
						manifest_structure: "FAIL",
						signature_valid: "FAIL",
						hash_match: "FAIL",
					},
					recording_info: {
						session_id: "",
						created_at: "",
						duration_seconds: 0,
						window_title: error instanceof Error ? error.message : "Unknown error",
					},
					signature_info: {
						algorithm: "",
						public_key: "",
						verified_by: "",
					},
				},
			});
			setShowVerifyResult(true);
		} finally {
			setIsVerifying(false);
		}
	};

	const handleDeleteRecording = (recording: RecordingEntry) => {
		setRecordingToDelete(recording);
		setShowDeleteConfirm(true);
	};

	const confirmDelete = () => {
		if (!recordingToDelete) return;

		logger.info("RECORDINGS_LIBRARY", "confirmDelete: Starting delete", {
			filename: recordingToDelete.filename,
		});

		// .notari files are self-contained (manifest is embedded), so just delete the file
		deleteRecordingMutation.mutate(
			{
				videoPath: recordingToDelete.video_path,
			},
			{
				onSuccess: () => {
					logger.info("RECORDINGS_LIBRARY", "confirmDelete: onSuccess callback called");
					// Close modal and reset state on success
					setShowDeleteConfirm(false);
					setRecordingToDelete(null);
					logger.info("RECORDINGS_LIBRARY", "confirmDelete: Modal closed and state reset");
				},
				onError: (error) => {
					logger.error(
						"RECORDINGS_LIBRARY",
						"confirmDelete: onError callback called",
						error as Error
					);
					alert(
						`Failed to delete recording: ${error instanceof Error ? error.message : "Unknown error"}`
					);
				},
			}
		);

		logger.info("RECORDINGS_LIBRARY", "confirmDelete: Mutation triggered");
	};

	const cancelDelete = () => {
		setShowDeleteConfirm(false);
		setRecordingToDelete(null);
		deleteRecordingMutation.reset(); // Reset mutation state
	};

	const handleOpenInFinder = async (recording: RecordingEntry) => {
		try {
			// Open the parent directory
			const dirPath = recording.video_path.substring(0, recording.video_path.lastIndexOf("/"));
			await invoke("open_file_in_default_app", { path: dirPath });
		} catch (err) {
			console.error("Failed to open in Finder:", err);
		}
	};

	const formatFileSize = (bytes: number): string => {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
		return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
	};

	const formatDate = (dateStr: string): string => {
		try {
			const date = new Date(dateStr);
			return date.toLocaleString();
		} catch {
			return dateStr;
		}
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-full">
				<Spinner size="lg" />
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center h-full">
				<Card className="max-w-md">
					<CardBody className="flex items-center space-y-4">
						<AlertCircle className="w-12 h-12 text-danger" />
						<p className="text-danger">{error.message || "Failed to load recordings"}</p>
						<Button color="primary" onPress={() => refetch()}>
							Retry
						</Button>
					</CardBody>
				</Card>
			</div>
		);
	}

	if (recordings.length === 0) {
		return (
			<div className="flex items-center justify-center h-full">
				<Card className="max-w-md">
					<CardBody className="flex flex-col items-center space-y-4 text-center">
						<FileVideo className="w-16 h-16 text-foreground-400" />
						<div>
							<h3 className="text-lg font-semibold">No Recordings Yet</h3>
							<p className="text-sm text-foreground-500 mt-2">
								Start recording to see your videos here
							</p>
						</div>
					</CardBody>
				</Card>
			</div>
		);
	}

	return (
		<>
			<div className="p-4 space-y-4">
				<div className="flex items-center justify-between">
					<h2 className="text-xl font-semibold">Recordings Library</h2>
					<Button
						size="sm"
						variant="flat"
						onPress={() => refetch()}
						isLoading={isLoading}
						startContent={!isLoading ? <RefreshCw className="w-4 h-4" /> : undefined}
					>
						Refresh
					</Button>
				</div>

				{/* Blockchain Not Enabled Banner */}
				{!configLoading &&
					!blockchainBannerDismissed &&
					blockchainConfig &&
					!blockchainConfig.enabled &&
					recordings.some((r) => r.has_manifest && !r.blockchain_anchor) && (
						<Alert
							color="primary"
							variant="flat"
							title="Blockchain Anchoring Available"
							description="Create immutable timestamps for your recordings on the blockchain. Enable blockchain anchoring in Settings to get started."
							isClosable
							onClose={() => setBlockchainBannerDismissed(true)}
							startContent={<Info className="w-4 h-4" />}
						/>
					)}

				<div className="grid gap-3">
					{recordings.map((recording) => (
						<Card
							key={recording.video_path}
							className="w-full hover:bg-default-100 transition-colors"
						>
							{/* Header */}
							<CardHeader
								className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 cursor-pointer"
								onClick={() => handlePlayVideo(recording)}
							>
								<div className="flex items-center gap-2 min-w-0 flex-1">
									<p className="font-semibold text-sm truncate">
										{recording.title || recording.filename}
									</p>
									{recording.is_encrypted && (
										<Lock className="w-3.5 h-3.5 text-warning flex-shrink-0" />
									)}
									{recording.has_manifest && (
										<Shield className="w-3.5 h-3.5 text-success flex-shrink-0" />
									)}
								</div>
								<div className="flex items-center gap-2 text-xs text-foreground-400 flex-shrink-0">
									<FileVideo className="w-3.5 h-3.5" />
									<span>{formatFileSize(recording.file_size_bytes)}</span>
								</div>
							</CardHeader>

							{/* Body */}
							<CardBody
								className="px-4 py-3 space-y-3 cursor-pointer"
								onClick={() => handlePlayVideo(recording)}
							>
								{/* Show filename if custom title exists */}
								{recording.title && (
									<p className="text-xs text-foreground-400 truncate">{recording.filename}</p>
								)}

								{/* Description */}
								{recording.description && (
									<p className="text-sm text-foreground-600 dark:text-foreground-400 line-clamp-2 leading-relaxed">
										{recording.description}
									</p>
								)}

								{/* Tags */}
								{recording.tags && recording.tags.length > 0 && (
									<div className="flex flex-wrap items-center gap-1.5">
										{recording.tags.slice(0, 3).map((tag) => (
											<Chip
												key={tag}
												size="sm"
												variant="flat"
												color="primary"
												classNames={{
													base: "h-6",
													content: "text-xs font-medium",
												}}
											>
												{tag}
											</Chip>
										))}
										{recording.tags.length > 3 && (
											<Chip
												size="sm"
												variant="flat"
												color="default"
												classNames={{
													base: "h-6",
													content: "text-xs",
												}}
											>
												+{recording.tags.length - 3}
											</Chip>
										)}
									</div>
								)}

								{/* Blockchain Anchoring Section */}
								{recording.has_manifest &&
									(recording.blockchain_anchor || blockchainConfig?.enabled) &&
									(recording.blockchain_anchor ? (
										// Anchored - Show detailed section
										<div className="pt-2 mt-2 border-t border-divider">
											<div className="flex items-start justify-between gap-3">
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-1.5 mb-1">
														<Anchor className="w-3.5 h-3.5 text-foreground-500 flex-shrink-0" />
														<span className="text-xs font-semibold text-foreground-600 dark:text-foreground-400">
															Blockchain Timestamp
														</span>
													</div>
													<p className="text-xs text-foreground-500 leading-relaxed">
														Anchored to {recording.blockchain_anchor.chain_name} on{" "}
														{new Date(recording.blockchain_anchor.anchored_at).toLocaleDateString()}{" "}
														at{" "}
														{new Date(recording.blockchain_anchor.anchored_at).toLocaleTimeString()}
													</p>
													{recording.blockchain_anchor.tx_hash && (
														<p className="text-xs text-foreground-400 font-mono mt-1">
															TX: {recording.blockchain_anchor.tx_hash.slice(0, 10)}...
															{recording.blockchain_anchor.tx_hash.slice(-8)}
														</p>
													)}
												</div>
												{/* biome-ignore lint/a11y/noStaticElementInteractions: wrapper div to stop event propagation */}
												<div
													role="presentation"
													onClick={(e) => e.stopPropagation()}
													onKeyDown={(e) => e.stopPropagation()}
													className="flex-shrink-0"
												>
													<BlockchainAnchorButton
														manifestPath={recording.manifest_path}
														anchor={recording.blockchain_anchor}
														onAnchored={refetch}
													/>
												</div>
											</div>
										</div>
									) : (
										// Not anchored but blockchain enabled - Show simple chip
										// biome-ignore lint/a11y/noStaticElementInteractions: wrapper div to stop event propagation
										<div
											role="presentation"
											onClick={(e) => e.stopPropagation()}
											onKeyDown={(e) => e.stopPropagation()}
										>
											<BlockchainAnchorButton
												manifestPath={recording.manifest_path}
												anchor={recording.blockchain_anchor}
												onAnchored={refetch}
											/>
										</div>
									))}

								{/* Date */}
								<div className="flex items-center gap-2 text-xs text-foreground-400">
									<span>{formatDate(recording.created_at)}</span>
								</div>
							</CardBody>

							{/* Footer with Actions */}
							<CardFooter className="px-4 py-3 border-t border-divider bg-content2/50">
								<div className="flex items-center justify-between w-full gap-2">
									<div className="flex items-center gap-2">
										{recording.has_manifest && (
											<Button
												size="sm"
												variant="flat"
												onPress={() => handleVerifyRecording(recording)}
												isLoading={isVerifying}
												startContent={!isVerifying && <Shield className="w-3.5 h-3.5" />}
											>
												Verify
											</Button>
										)}
										<Button
											size="sm"
											variant="flat"
											onPress={() => handleOpenInFinder(recording)}
											startContent={<FolderOpen className="w-3.5 h-3.5" />}
										>
											Show in Finder
										</Button>
									</div>
									<Button
										size="sm"
										variant="flat"
										color="danger"
										onPress={() => handleDeleteRecording(recording)}
										startContent={<Trash2 className="w-3.5 h-3.5" />}
									>
										Delete
									</Button>
								</div>
							</CardFooter>
						</Card>
					))}
				</div>
			</div>

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

			{/* Delete Confirmation Modal */}
			<Modal isOpen={showDeleteConfirm} onClose={cancelDelete} size="md">
				<ModalContent>
					<ModalHeader className="flex items-center gap-2">
						<AlertCircle className="w-5 h-5 text-danger" />
						<span>Delete Recording</span>
					</ModalHeader>
					<ModalBody>
						<p className="text-foreground-600">Are you sure you want to delete this recording?</p>
						{recordingToDelete && (
							<div className="mt-2 p-3 bg-content2 rounded-lg">
								<p className="font-medium text-sm break-words">{recordingToDelete.filename}</p>
								<p className="text-xs text-foreground-500 mt-1">
									Size: {formatFileSize(recordingToDelete.file_size_bytes)}
								</p>
							</div>
						)}
						<p className="text-sm text-danger mt-2">⚠️ This action cannot be undone.</p>
					</ModalBody>
					<ModalFooter>
						<Button
							variant="flat"
							onPress={cancelDelete}
							isDisabled={deleteRecordingMutation.isPending}
						>
							Cancel
						</Button>
						<Button
							color="danger"
							onPress={confirmDelete}
							isLoading={deleteRecordingMutation.isPending}
							startContent={
								!deleteRecordingMutation.isPending ? <Trash2 className="w-4 h-4" /> : undefined
							}
						>
							Delete
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>

			{/* Verification Result Modal */}
			<Modal isOpen={showVerifyResult} onClose={() => setShowVerifyResult(false)} size="lg">
				<ModalContent>
					<ModalHeader className="flex items-center gap-2">
						<Shield className="w-5 h-5 text-primary" />
						<span>Verification Result</span>
					</ModalHeader>
					<ModalBody>
						{verifyResult && (
							<div className="space-y-4">
								{/* Status Badge */}
								<div className="flex items-center justify-center">
									<Chip
										color={
											verifyResult.verification.status === "VERIFIED"
												? "success"
												: verifyResult.verification.status === "WARNING"
													? "warning"
													: "danger"
										}
										size="lg"
										variant="flat"
									>
										{verifyResult.verification.status}
									</Chip>
								</div>

								{/* Validation Checks */}
								<div className="space-y-2">
									<div className="flex items-center justify-between p-3 bg-content2 rounded-lg">
										<span className="text-sm font-medium">Digital Signature</span>
										<Chip
											color={
												verifyResult.verification.checks.signature_valid === "PASS"
													? "success"
													: "danger"
											}
											size="sm"
											variant="flat"
										>
											{verifyResult.verification.checks.signature_valid === "PASS"
												? "✓ Valid"
												: "✗ Invalid"}
										</Chip>
									</div>
									<div className="flex items-center justify-between p-3 bg-content2 rounded-lg">
										<span className="text-sm font-medium">File Hash</span>
										<Chip
											color={
												verifyResult.verification.checks.hash_match === "PASS"
													? "success"
													: "danger"
											}
											size="sm"
											variant="flat"
										>
											{verifyResult.verification.checks.hash_match === "PASS"
												? "✓ Valid"
												: "✗ Invalid"}
										</Chip>
									</div>
									<div className="flex items-center justify-between p-3 bg-content2 rounded-lg">
										<span className="text-sm font-medium">Manifest Structure</span>
										<Chip
											color={
												verifyResult.verification.checks.manifest_structure === "PASS"
													? "success"
													: "danger"
											}
											size="sm"
											variant="flat"
										>
											{verifyResult.verification.checks.manifest_structure === "PASS"
												? "✓ Valid"
												: "✗ Invalid"}
										</Chip>
									</div>

									{/* Blockchain Anchor Check */}
									{verifyResult.verification.checks.blockchain_anchor && (
										<div className="flex items-center justify-between p-3 bg-content2 rounded-lg">
											<div className="flex flex-col gap-1">
												<span className="text-sm font-medium">Blockchain Anchor</span>
												<span className="text-xs text-foreground-500">
													{verifyResult.verification.checks.blockchain_anchor.algorithm}
												</span>
												<span className="text-xs text-foreground-500">
													{new Date(
														verifyResult.verification.checks.blockchain_anchor.anchored_at
													).toLocaleString()}
												</span>
											</div>
											<div className="flex items-center gap-2">
												<Chip color="success" size="sm" variant="flat">
													✓ Present
												</Chip>
												{verifyResult.verification.checks.blockchain_anchor.explorer_url && (
													<Button
														isIconOnly
														size="sm"
														variant="light"
														onPress={() => {
															if (
																verifyResult.verification.checks.blockchain_anchor?.explorer_url
															) {
																window.open(
																	verifyResult.verification.checks.blockchain_anchor.explorer_url,
																	"_blank"
																);
															}
														}}
														aria-label="View on blockchain explorer"
													>
														<ExternalLink className="w-3 h-3" />
													</Button>
												)}
											</div>
										</div>
									)}
								</div>

								{/* Custom Metadata */}
								{(verifyResult.verification.recording_info.title ||
									verifyResult.verification.recording_info.description ||
									(verifyResult.verification.recording_info.tags &&
										verifyResult.verification.recording_info.tags.length > 0)) && (
									<div className="p-3 bg-content2 rounded-lg space-y-2">
										<p className="text-xs font-medium text-foreground-500">Recording Metadata</p>
										{verifyResult.verification.recording_info.title && (
											<div className="space-y-1">
												<p className="text-xs text-foreground-500">Title</p>
												<p className="text-sm font-medium">
													{verifyResult.verification.recording_info.title}
												</p>
											</div>
										)}
										{verifyResult.verification.recording_info.description && (
											<div className="space-y-1">
												<p className="text-xs text-foreground-500">Description</p>
												<p className="text-sm">
													{verifyResult.verification.recording_info.description}
												</p>
											</div>
										)}
										{verifyResult.verification.recording_info.tags &&
											verifyResult.verification.recording_info.tags.length > 0 && (
												<div className="space-y-1">
													<p className="text-xs text-foreground-500">Tags</p>
													<div className="flex flex-wrap gap-1">
														{verifyResult.verification.recording_info.tags.map((tag) => (
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
								{verifyResult.verification.recording_info.window_title && (
									<div className="p-3 bg-content2 rounded-lg space-y-1">
										<p className="text-xs text-foreground-500">Recording Details</p>
										<p className="text-sm font-medium">
											{verifyResult.verification.recording_info.window_title}
										</p>
										<p className="text-xs text-foreground-500">
											Duration:{" "}
											{verifyResult.verification.recording_info.duration_seconds.toFixed(1)}s
										</p>
									</div>
								)}
							</div>
						)}
					</ModalBody>
					<ModalFooter>
						<Button color="primary" onPress={() => setShowVerifyResult(false)}>
							Close
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>

			{/* Video Player Modal */}
			<Modal
				size="full"
				isOpen={showVideoPlayer}
				onClose={handleCloseVideoPlayer}
				hideCloseButton
				classNames={{
					base: "m-0 max-w-full max-h-full",
					wrapper: "items-center justify-center",
				}}
			>
				<ModalContent className="h-screen">
					{videoPlayerRecording && (
						<VideoPlayer
							recordingPath={videoPlayerRecording.video_path}
							password={videoPlayerPassword}
							onClose={handleCloseVideoPlayer}
							onSettings={onSettings}
						/>
					)}
				</ModalContent>
			</Modal>
		</>
	);
}
