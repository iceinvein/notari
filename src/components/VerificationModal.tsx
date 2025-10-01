import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { AlertCircle, CheckCircle, FileVideo, Shield, XCircle } from "lucide-react";
import { useState } from "react";
import {
	type CheckResult,
	getVerificationStatusColor,
	useVerifyRecordingQuery,
	type VerificationReport,
} from "../hooks/useEvidence";

type VerificationModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

export default function VerificationModal({ isOpen, onClose }: VerificationModalProps) {
	const [videoPath, setVideoPath] = useState<string | null>(null);
	const [manifestPath, setManifestPath] = useState<string | null>(null);

	const {
		data: verificationReport,
		isLoading,
		error,
	} = useVerifyRecordingQuery(manifestPath, videoPath);

	const handleSelectVideo = async () => {
		try {
			// Push popover guard to prevent popover from closing when dialog opens
			await invoke("popover_guard_push");

			try {
				const selected = await open({
					multiple: false,
					filters: [
						{
							name: "Video",
							extensions: ["mov", "mp4", "avi", "mkv"],
						},
					],
				});

				if (selected && typeof selected === "string") {
					setVideoPath(selected);
					// Auto-detect manifest path (same name with .json extension)
					const manifestPath = selected.replace(/\.[^/.]+$/, ".json");
					setManifestPath(manifestPath);
				}
			} finally {
				// Always pop the guard, even if dialog fails
				await invoke("popover_guard_pop").catch(() => {});
			}
		} catch (error) {
			console.error("Failed to select video:", error);
		}
	};

	const handleReset = () => {
		setVideoPath(null);
		setManifestPath(null);
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
			<ModalContent>
				<ModalHeader className="flex items-center space-x-2">
					<Shield className="w-5 h-5" />
					<span>Verify Recording</span>
				</ModalHeader>
				<ModalBody>
					{/* File Selection */}
					{!videoPath ? (
						<Card>
							<CardBody className="p-6 text-center">
								<FileVideo className="w-12 h-12 mx-auto mb-4 text-foreground-400" />
								<h3 className="text-lg font-semibold mb-2">Select Recording to Verify</h3>
								<p className="text-sm text-foreground-500 mb-4">
									Choose a video file to verify its authenticity and integrity
								</p>
								<Button color="primary" onPress={handleSelectVideo}>
									Select Video File
								</Button>
							</CardBody>
						</Card>
					) : (
						<div className="space-y-4">
							{/* Selected Files */}
							<Card>
								<CardBody className="p-4">
									<div className="space-y-2">
										<div className="text-sm">
											<span className="font-medium">Video:</span>
											<div className="text-foreground-500 truncate">{videoPath}</div>
										</div>
										<div className="text-sm">
											<span className="font-medium">Manifest:</span>
											<div className="text-foreground-500 truncate">{manifestPath}</div>
										</div>
									</div>
								</CardBody>
							</Card>

							{/* Verification Results */}
							{isLoading && (
								<Card>
									<CardBody className="p-6 text-center">
										<div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
										<p className="text-sm text-foreground-500">Verifying recording...</p>
									</CardBody>
								</Card>
							)}

							{error && (
								<Card className="border-danger">
									<CardBody className="p-4">
										<div className="flex items-start space-x-3">
											<AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
											<div>
												<h4 className="font-semibold text-danger mb-1">Verification Failed</h4>
												<p className="text-sm text-foreground-500">
													{error instanceof Error ? error.message : "Unknown error occurred"}
												</p>
											</div>
										</div>
									</CardBody>
								</Card>
							)}

							{verificationReport && <VerificationResults report={verificationReport} />}
						</div>
					)}
				</ModalBody>
				<ModalFooter>
					{videoPath && (
						<Button variant="flat" onPress={handleReset}>
							Select Different File
						</Button>
					)}
					<Button color="primary" variant="light" onPress={onClose}>
						Close
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

// Verification Results Component
function VerificationResults({ report }: { report: VerificationReport }) {
	const { verification } = report;
	const statusColor = getVerificationStatusColor(verification.status);

	return (
		<div className="space-y-4">
			{/* Overall Status */}
			<Card className={`border-${statusColor}`}>
				<CardBody className="p-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center space-x-3">
							{verification.status === "VERIFIED" ? (
								<CheckCircle className="w-6 h-6 text-success" />
							) : verification.status === "FAILED" ? (
								<XCircle className="w-6 h-6 text-danger" />
							) : (
								<AlertCircle className="w-6 h-6 text-warning" />
							)}
							<div>
								<h3 className="font-semibold text-lg">
									{verification.status === "VERIFIED"
										? "Recording Verified"
										: verification.status === "FAILED"
											? "Verification Failed"
											: "Verification Warning"}
								</h3>
								<p className="text-sm text-foreground-500">
									Verified at {new Date(verification.timestamp).toLocaleString()}
								</p>
							</div>
						</div>
						<Chip color={statusColor} variant="flat" size="lg">
							{verification.status}
						</Chip>
					</div>
				</CardBody>
			</Card>

			{/* Verification Checks */}
			<Card>
				<CardBody className="p-4">
					<h4 className="font-semibold mb-3">Verification Checks</h4>
					<div className="space-y-2">
						<VerificationCheck
							label="Manifest Structure"
							result={verification.checks.manifest_structure}
						/>
						<VerificationCheck
							label="Digital Signature"
							result={verification.checks.signature_valid}
						/>
						<VerificationCheck label="File Integrity" result={verification.checks.hash_match} />
					</div>
				</CardBody>
			</Card>

			{/* Recording Info */}
			<Card>
				<CardBody className="p-4">
					<h4 className="font-semibold mb-3">Recording Information</h4>
					<div className="space-y-2 text-sm">
						<div className="flex gap-2">
							<span className="text-foreground-500">Session ID:</span>
							<span className="font-mono">
								{verification.recording_info.session_id.slice(0, 16)}...
							</span>
						</div>
						<div className="flex gap-2">
							<span className="text-foreground-500">Window:</span>
							<span>{verification.recording_info.window_title}</span>
						</div>
						<div className="flex gap-2">
							<span className="text-foreground-500">Duration:</span>
							<span>{verification.recording_info.duration_seconds}s</span>
						</div>
						<div className="flex gap-2">
							<span className="text-foreground-500">Created:</span>
							<span>{new Date(verification.recording_info.created_at).toLocaleString()}</span>
						</div>
					</div>
				</CardBody>
			</Card>

			{/* Signature Info */}
			<Card>
				<CardBody className="p-4">
					<h4 className="font-semibold mb-3">Signature Information</h4>
					<div className="space-y-2 text-sm">
						<div className="flex gap-2">
							<span className="text-foreground-500">Algorithm:</span>
							<span className="font-mono">{verification.signature_info.algorithm}</span>
						</div>
						<div className="flex gap-2">
							<span className="text-foreground-500">Public Key:</span>
							<span className="font-mono text-xs">
								{verification.signature_info.public_key.slice(0, 24)}...
							</span>
						</div>
						<div className="flex gap-2">
							<span className="text-foreground-500">Verified By:</span>
							<span>{verification.signature_info.verified_by}</span>
						</div>
					</div>
				</CardBody>
			</Card>
		</div>
	);
}

// Verification Check Component
function VerificationCheck({ label, result }: { label: string; result: CheckResult }) {
	const getCheckIcon = (result: CheckResult) => {
		switch (result) {
			case "PASS":
				return <CheckCircle className="w-4 h-4 text-success" />;
			case "FAIL":
				return <XCircle className="w-4 h-4 text-danger" />;
			case "SKIP":
				return <AlertCircle className="w-4 h-4 text-warning" />;
		}
	};

	const getCheckColor = (result: CheckResult): "success" | "danger" | "warning" => {
		switch (result) {
			case "PASS":
				return "success";
			case "FAIL":
				return "danger";
			case "SKIP":
				return "warning";
		}
	};

	return (
		<div className="flex items-center justify-between p-2 rounded-lg bg-content2">
			<span className="text-sm">{label}</span>
			<Chip
				color={getCheckColor(result)}
				variant="flat"
				size="sm"
				startContent={getCheckIcon(result)}
			>
				{result}
			</Chip>
		</div>
	);
}
