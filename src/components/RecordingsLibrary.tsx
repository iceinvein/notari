import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Spinner } from "@heroui/spinner";
import { invoke } from "@tauri-apps/api/core";
import {
	AlertCircle,
	Eye,
	EyeOff,
	FileVideo,
	FolderOpen,
	Lock,
	Play,
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

type VerificationReport = {
	verification: {
		timestamp: string;
		status: "VERIFIED" | "FAILED" | "WARNING";
		checks: {
			manifest_structure: "PASS" | "FAIL" | "SKIP";
			signature_valid: "PASS" | "FAIL" | "SKIP";
			hash_match: "PASS" | "FAIL" | "SKIP";
		};
		recording_info: {
			session_id: string;
			created_at: string;
			duration_seconds: number;
			window_title: string;
		};
		signature_info: {
			algorithm: string;
			public_key: string;
			verified_by: string;
		};
	};
};

export default function RecordingsLibrary() {
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

	const handlePlayVideo = async (recording: RecordingEntry) => {
		if (recording.is_encrypted) {
			setSelectedRecording(recording);
			setShowPasswordModal(true);
		} else {
			try {
				await invoke("open_file_in_default_app", { path: recording.video_path });
			} catch (err) {
				console.error("Failed to open video:", err);
			}
		}
	};

	const handleDecryptAndPlay = async () => {
		if (!selectedRecording) return;

		setIsDecrypting(true);
		setDecryptError(null);

		try {
			// Load manifest to get encryption info
			const manifestContent = await invoke<string>("read_file", {
				path: selectedRecording.manifest_path,
			});
			const manifest = JSON.parse(manifestContent);
			const encryptionInfo = manifest.recording?.encryption;
			if (!encryptionInfo) {
				throw new Error(
					`No encryption info found in manifest. Recording encrypted flag: ${manifest.recording?.encrypted}`
				);
			}

			// Decrypt and play
			await invoke("decrypt_and_play_video", {
				encryptedPath: selectedRecording.video_path,
				password: decryptPassword,
				encryptionInfo,
			});

			// Close modal on success
			setShowPasswordModal(false);
			setDecryptPassword("");
			setSelectedRecording(null);
		} catch (err) {
			console.error("Failed to decrypt video:", err);
			setDecryptError(err instanceof Error ? err.message : "Decryption failed");
		} finally {
			setIsDecrypting(false);
		}
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

	const confirmDelete = async () => {
		if (!recordingToDelete) return;

		try {
			await deleteRecordingMutation.mutateAsync({
				videoPath: recordingToDelete.video_path,
				manifestPath: recordingToDelete.has_manifest ? recordingToDelete.manifest_path : undefined,
			});

			// Close modal and reset state
			setShowDeleteConfirm(false);
			setRecordingToDelete(null);
		} catch (error) {
			console.error("Delete failed:", error);
			alert(
				`Failed to delete recording: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	};

	const cancelDelete = () => {
		setShowDeleteConfirm(false);
		setRecordingToDelete(null);
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

				<div className="grid gap-4">
					{recordings.map((recording) => (
						<Card key={recording.video_path} className="w-full">
							<CardBody className="p-4 space-y-3">
								{/* File Info - Top */}
								<div className="space-y-2">
									<div className="flex items-start gap-2">
										<FileVideo className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
										<div className="flex-1 min-w-0">
											<p className="font-medium text-sm break-words">{recording.filename}</p>
											<div className="flex items-center gap-2 mt-1 flex-wrap">
												{recording.is_encrypted && (
													<Chip
														size="sm"
														color="warning"
														variant="flat"
														startContent={<Lock className="w-3 h-3" />}
													>
														Encrypted
													</Chip>
												)}
												{recording.has_manifest && (
													<Chip
														size="sm"
														color="success"
														variant="flat"
														startContent={<Shield className="w-3 h-3" />}
													>
														Verified
													</Chip>
												)}
											</div>
										</div>
									</div>

									<div className="text-xs text-foreground-500 space-y-0.5 pl-7">
										<p>Created: {formatDate(recording.created_at)}</p>
										<p>Size: {formatFileSize(recording.file_size_bytes)}</p>
									</div>
								</div>

								{/* Action Buttons - Bottom */}
								<div className="flex items-center gap-2 flex-wrap pt-2 border-t border-divider">
									<Button
										size="sm"
										color="primary"
										variant="flat"
										onPress={() => handlePlayVideo(recording)}
										startContent={
											recording.is_encrypted ? (
												<Lock className="w-4 h-4" />
											) : (
												<Play className="w-4 h-4" />
											)
										}
									>
										Play
									</Button>
									{recording.has_manifest && (
										<Button
											size="sm"
											variant="flat"
											onPress={() => handleVerifyRecording(recording)}
											isLoading={isVerifying}
											startContent={!isVerifying ? <Shield className="w-4 h-4" /> : undefined}
										>
											Verify
										</Button>
									)}
									<Button
										size="sm"
										variant="flat"
										onPress={() => handleOpenInFinder(recording)}
										startContent={<FolderOpen className="w-4 h-4" />}
									>
										Show
									</Button>
									<Button
										size="sm"
										color="danger"
										variant="flat"
										onPress={() => handleDeleteRecording(recording)}
										startContent={<Trash2 className="w-4 h-4" />}
									>
										Delete
									</Button>
								</div>
							</CardBody>
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
								</div>

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
		</>
	);
}
