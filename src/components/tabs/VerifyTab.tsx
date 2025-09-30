import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { AlertCircle, CheckCircle, FileSearch, FolderOpen, Shield, XCircle } from "lucide-react";
import { useState } from "react";

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
							<div className="flex items-center justify-between">
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
							</div>
						</CardBody>
					</Card>

					{/* Recording Info */}
					<Card className="bg-content2">
						<CardBody className="space-y-3">
							<h4 className="text-sm font-medium text-foreground">Recording Information</h4>
							<div className="space-y-2 text-xs">
								<div className="flex justify-between">
									<span className="text-foreground-500">Window:</span>
									<span className="text-foreground break-all text-right max-w-[60%]">
										{verificationResult.verification.recording_info.window_title}
									</span>
								</div>
								<div className="flex justify-between">
									<span className="text-foreground-500">Duration:</span>
									<span className="text-foreground">
										{verificationResult.verification.recording_info.duration_seconds.toFixed(1)}s
									</span>
								</div>
								<div className="flex justify-between">
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
