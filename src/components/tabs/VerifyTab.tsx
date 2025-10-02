import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
	AlertCircle,
	Anchor,
	CheckCircle,
	ExternalLink,
	FileSearch,
	FolderOpen,
	Shield,
	XCircle,
} from "lucide-react";
import { useState } from "react";

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

export default function VerifyTab() {
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [isVerifying, setIsVerifying] = useState(false);
	const [verificationResult, setVerificationResult] = useState<VerificationReport | null>(null);
	const [error, setError] = useState<string | null>(null);

	const handleSelectFile = async () => {
		try {
			// Push popover guard to prevent popover from closing when dialog opens
			await invoke("popover_guard_push");

			try {
				const file = await open({
					title: "Select Notari Proof Pack",
					filters: [
						{
							name: "Notari Proof Pack",
							extensions: ["notari"],
						},
					],
				});

				if (file && typeof file === "string") {
					setSelectedFile(file);
					setVerificationResult(null);
					setError(null);
				}
			} finally {
				// Always pop the guard, even if dialog fails
				await invoke("popover_guard_pop").catch(() => {});
			}
		} catch (err) {
			console.error("Failed to select file:", err);
			setError(err instanceof Error ? err.message : "Failed to select file");
		}
	};

	const handleVerify = async () => {
		if (!selectedFile) return;

		setIsVerifying(true);
		setError(null);

		try {
			// For .notari files, both manifestPath and videoPath are the same
			// The backend will extract and verify automatically
			const result = await invoke<VerificationReport>("verify_recording", {
				manifestPath: selectedFile,
				videoPath: selectedFile,
			});

			setVerificationResult(result);
		} catch (err) {
			console.error("Verification failed:", err);
			setError(err instanceof Error ? err.message : "Verification failed");
		} finally {
			setIsVerifying(false);
		}
	};

	const getStatusColor = (status: string) => {
		switch (status) {
			case "VERIFIED":
				return "success";
			case "WARNING":
				return "warning";
			case "FAILED":
				return "danger";
			default:
				return "default";
		}
	};

	const getStatusIcon = (status: string) => {
		switch (status) {
			case "VERIFIED":
				return <CheckCircle className="w-5 h-5" />;
			case "WARNING":
				return <AlertCircle className="w-5 h-5" />;
			case "FAILED":
				return <XCircle className="w-5 h-5" />;
			default:
				return <Shield className="w-5 h-5" />;
		}
	};

	return (
		<div className="h-full overflow-auto p-4 space-y-6">
			{/* File Selection */}
			<Card className="bg-content2">
				<CardBody className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex-1">
							<h4 className="text-sm font-medium text-foreground mb-1">Evidence Manifest</h4>
							{selectedFile ? (
								<p className="text-xs text-foreground-500 break-all">{selectedFile}</p>
							) : (
								<p className="text-xs text-foreground-500">No file selected</p>
							)}
						</div>
						<Button
							size="sm"
							variant="flat"
							onPress={handleSelectFile}
							startContent={<FolderOpen className="w-4 h-4" />}
						>
							Browse
						</Button>
					</div>

					<Button
						color="primary"
						size="lg"
						className="w-full"
						onPress={handleVerify}
						isDisabled={!selectedFile || isVerifying}
						isLoading={isVerifying}
						startContent={!isVerifying && <FileSearch className="w-5 h-5" />}
					>
						Verify Recording
					</Button>
				</CardBody>
			</Card>

			{/* Error Display */}
			{error && (
				<Card className="bg-danger-50 dark:bg-danger-900/20 border border-danger">
					<CardBody className="flex flex-row items-start space-x-3">
						<AlertCircle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
						<div className="flex-1">
							<p className="text-sm font-medium text-danger">Verification Error</p>
							<p className="text-xs text-danger-600 dark:text-danger-400 mt-1">{error}</p>
						</div>
					</CardBody>
				</Card>
			)}

			{/* Verification Result */}
			{verificationResult && (
				<div className="space-y-4">
					{/* Status Card */}
					<Card className="bg-content2">
						<CardBody className="space-y-4">
							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center space-x-3">
									{getStatusIcon(verificationResult.verification.status)}
									<div>
										<h4 className="text-sm font-medium text-foreground">Verification Status</h4>
										<p className="text-xs text-foreground-500">
											{verificationResult.verification.status === "VERIFIED"
												? "Recording is authentic and unmodified"
												: verificationResult.verification.status === "WARNING"
													? "Recording verified with warnings"
													: "Verification failed"}
										</p>
									</div>
								</div>
								<Chip color={getStatusColor(verificationResult.verification.status)} variant="flat">
									{verificationResult.verification.status}
								</Chip>
							</div>

							{/* Checks */}
							<div className="space-y-2">
								<div className="flex items-center justify-between text-sm">
									<span className="text-foreground-500">Digital Signature</span>
									<Chip
										size="sm"
										color={
											verificationResult.verification.checks.signature_valid === "PASS"
												? "success"
												: "danger"
										}
										variant="flat"
									>
										{verificationResult.verification.checks.signature_valid === "PASS"
											? "Valid"
											: "Invalid"}
									</Chip>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="text-foreground-500">File Hash</span>
									<Chip
										size="sm"
										color={
											verificationResult.verification.checks.hash_match === "PASS"
												? "success"
												: "danger"
										}
										variant="flat"
									>
										{verificationResult.verification.checks.hash_match === "PASS"
											? "Valid"
											: "Invalid"}
									</Chip>
								</div>
								<div className="flex items-center justify-between text-sm">
									<span className="text-foreground-500">Manifest Structure</span>
									<Chip
										size="sm"
										color={
											verificationResult.verification.checks.manifest_structure === "PASS"
												? "success"
												: "danger"
										}
										variant="flat"
									>
										{verificationResult.verification.checks.manifest_structure === "PASS"
											? "Valid"
											: "Invalid"}
									</Chip>
								</div>

								{/* Blockchain Anchor Check */}
								{verificationResult.verification.checks.blockchain_anchor && (
									<div className="flex items-center justify-between text-sm pt-2 border-t border-divider">
										<div className="flex flex-col gap-1">
											<div className="flex items-center gap-2">
												<Anchor className="w-3.5 h-3.5 text-foreground-500" />
												<span className="text-foreground-500">Blockchain Anchor</span>
											</div>
											<span className="text-xs text-foreground-400 ml-5">
												{verificationResult.verification.checks.blockchain_anchor.algorithm}
											</span>
											<span className="text-xs text-foreground-400 ml-5">
												{new Date(
													verificationResult.verification.checks.blockchain_anchor.anchored_at
												).toLocaleString()}
											</span>
										</div>
										<div className="flex items-center gap-2">
											<Chip size="sm" color="success" variant="flat">
												Present
											</Chip>
											{verificationResult.verification.checks.blockchain_anchor.explorer_url && (
												<Button
													isIconOnly
													size="sm"
													variant="light"
													onPress={() => {
														if (
															verificationResult.verification.checks.blockchain_anchor?.explorer_url
														) {
															window.open(
																verificationResult.verification.checks.blockchain_anchor
																	.explorer_url,
																"_blank"
															);
														}
													}}
													aria-label="View on blockchain explorer"
												>
													<ExternalLink className="w-3.5 h-3.5" />
												</Button>
											)}
										</div>
									</div>
								)}
							</div>
						</CardBody>
					</Card>

					{/* Custom Metadata */}
					{(verificationResult.verification.recording_info.title ||
						verificationResult.verification.recording_info.description ||
						(verificationResult.verification.recording_info.tags &&
							verificationResult.verification.recording_info.tags.length > 0)) && (
						<Card className="bg-content2">
							<CardBody className="space-y-3">
								<h4 className="text-sm font-medium text-foreground">Recording Metadata</h4>
								{verificationResult.verification.recording_info.title && (
									<div className="space-y-1">
										<p className="text-xs text-foreground-500">Title</p>
										<p className="text-sm font-medium">
											{verificationResult.verification.recording_info.title}
										</p>
									</div>
								)}
								{verificationResult.verification.recording_info.description && (
									<div className="space-y-1">
										<p className="text-xs text-foreground-500">Description</p>
										<p className="text-sm">
											{verificationResult.verification.recording_info.description}
										</p>
									</div>
								)}
								{verificationResult.verification.recording_info.tags &&
									verificationResult.verification.recording_info.tags.length > 0 && (
										<div className="space-y-1">
											<p className="text-xs text-foreground-500">Tags</p>
											<div className="flex flex-wrap gap-1">
												{verificationResult.verification.recording_info.tags.map((tag) => (
													<Chip key={tag} size="sm" variant="flat" color="primary">
														{tag}
													</Chip>
												))}
											</div>
										</div>
									)}
							</CardBody>
						</Card>
					)}

					{/* Recording Info */}
					<Card className="bg-content2">
						<CardBody className="space-y-3">
							<h4 className="text-sm font-medium text-foreground">Recording Information</h4>
							<div className="space-y-2 text-xs">
								<div className="flex gap-1">
									<span className="text-foreground-500">Window:</span>
									<span className="text-foreground break-all">
										{verificationResult.verification.recording_info.window_title}
									</span>
								</div>
								<div className="flex gap-1">
									<span className="text-foreground-500">Duration:</span>
									<span className="text-foreground">
										{verificationResult.verification.recording_info.duration_seconds.toFixed(1)}s
									</span>
								</div>
								<div className="flex gap-1">
									<span className="text-foreground-500">Verified By:</span>
									<span className="text-foreground text-xs">
										{verificationResult.verification.signature_info.verified_by}
									</span>
								</div>
							</div>
						</CardBody>
					</Card>
				</div>
			)}

			{/* Info Section */}
			{!verificationResult && !error && (
				<div className="bg-content2 rounded-lg p-4 space-y-3">
					<h4 className="text-sm font-medium text-foreground">Verification Features</h4>
					<div className="space-y-2 text-xs text-foreground-500">
						<div className="flex items-start space-x-2">
							<span className="text-success">✓</span>
							<span>Verify Ed25519 digital signatures</span>
						</div>
						<div className="flex items-start space-x-2">
							<span className="text-success">✓</span>
							<span>Validate SHA-256 file hashes</span>
						</div>
						<div className="flex items-start space-x-2">
							<span className="text-success">✓</span>
							<span>Check manifest structure and integrity</span>
						</div>
						<div className="flex items-start space-x-2">
							<span className="text-success">✓</span>
							<span>Detect tampering and modifications</span>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
