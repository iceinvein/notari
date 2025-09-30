import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { invoke } from "@tauri-apps/api/core";
import { AlertCircle, CheckCircle, Copy, Key, Shield, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
	formatPublicKeyFingerprint,
	useHasSigningKeyQuery,
	usePublicKeyQuery,
} from "../hooks/useEvidence";

type KeyManagementModalProps = {
	isOpen: boolean;
	onClose: () => void;
};

export default function KeyManagementModal({ isOpen, onClose }: KeyManagementModalProps) {
	const { data: hasSigningKey, refetch: refetchHasKey } = useHasSigningKeyQuery();
	const { data: publicKey, refetch: refetchPublicKey } = usePublicKeyQuery();
	const [isGenerating, setIsGenerating] = useState(false);
	const [generateError, setGenerateError] = useState<string | null>(null);
	const [copySuccess, setCopySuccess] = useState(false);

	// Refetch when modal opens
	useEffect(() => {
		if (isOpen) {
			refetchHasKey();
			refetchPublicKey();
		}
	}, [isOpen, refetchHasKey, refetchPublicKey]);

	const handleGenerateKey = async () => {
		setIsGenerating(true);
		setGenerateError(null);

		try {
			await invoke("generate_signing_key");
			await refetchHasKey();
			await refetchPublicKey();
		} catch (error) {
			setGenerateError(error instanceof Error ? error.message : String(error));
		} finally {
			setIsGenerating(false);
		}
	};

	const handleCopyPublicKey = async () => {
		if (!publicKey) return;

		try {
			await navigator.clipboard.writeText(publicKey);
			setCopySuccess(true);
			setTimeout(() => setCopySuccess(false), 2000);
		} catch (error) {
			console.error("Failed to copy public key:", error);
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
			<ModalContent>
				<ModalHeader className="flex items-center space-x-2">
					<Key className="w-5 h-5" />
					<span>Signing Key Management</span>
				</ModalHeader>
				<ModalBody>
					<div className="space-y-4">
						{/* Key Status */}
						<Card className={hasSigningKey ? "border-success" : "border-warning"}>
							<CardBody className="p-4">
								<div className="flex items-center justify-between">
									<div className="flex items-center space-x-3">
										{hasSigningKey ? (
											<CheckCircle className="w-6 h-6 text-success" />
										) : (
											<AlertCircle className="w-6 h-6 text-warning" />
										)}
										<div>
											<h3 className="font-semibold text-lg">
												{hasSigningKey ? "Signing Key Active" : "No Signing Key"}
											</h3>
											<p className="text-sm text-foreground-500">
												{hasSigningKey
													? "Your recordings are being signed with cryptographic proof"
													: "Generate a key to enable evidence signing"}
											</p>
										</div>
									</div>
									<Chip color={hasSigningKey ? "success" : "warning"} variant="flat" size="lg">
										{hasSigningKey ? "Active" : "Inactive"}
									</Chip>
								</div>
							</CardBody>
						</Card>

						{/* Public Key Display */}
						{hasSigningKey && publicKey && (
							<Card>
								<CardBody className="p-4">
									<h4 className="font-semibold mb-3 flex items-center space-x-2">
										<Shield className="w-4 h-4" />
										<span>Public Key</span>
									</h4>
									<div className="space-y-3">
										<div className="p-3 bg-content2 rounded-lg font-mono text-xs break-all">
											{publicKey}
										</div>
										<div className="flex items-center justify-between">
											<span className="text-sm text-foreground-500">
												Fingerprint:{" "}
												<span className="font-mono">{formatPublicKeyFingerprint(publicKey)}</span>
											</span>
											<Button
												size="sm"
												variant="flat"
												color={copySuccess ? "success" : "primary"}
												onPress={handleCopyPublicKey}
												startContent={
													copySuccess ? (
														<CheckCircle className="w-4 h-4" />
													) : (
														<Copy className="w-4 h-4" />
													)
												}
											>
												{copySuccess ? "Copied!" : "Copy"}
											</Button>
										</div>
									</div>
								</CardBody>
							</Card>
						)}

						{/* Generate Key Section */}
						{!hasSigningKey && (
							<Card>
								<CardBody className="p-4">
									<h4 className="font-semibold mb-3">Generate Signing Key</h4>
									<p className="text-sm text-foreground-500 mb-4">
										Generate a new Ed25519 keypair to sign your recordings. The private key will be
										securely stored in your macOS Keychain.
									</p>
									<Button
										color="primary"
										onPress={handleGenerateKey}
										isLoading={isGenerating}
										startContent={<Key className="w-4 h-4" />}
									>
										Generate New Key
									</Button>
									{generateError && (
										<div className="mt-3 p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-200 dark:border-danger-800">
											<div className="flex items-start space-x-2">
												<XCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
												<span className="text-sm text-danger">{generateError}</span>
											</div>
										</div>
									)}
								</CardBody>
							</Card>
						)}

						{/* Info Section */}
						<Card className="bg-content2">
							<CardBody className="p-4">
								<h4 className="font-semibold mb-3">About Signing Keys</h4>
								<div className="space-y-2 text-sm text-foreground-500">
									<div className="flex items-start space-x-2">
										<span className="text-success">✓</span>
										<span>
											<strong>Private Key:</strong> Stored securely in macOS Keychain, never leaves
											your device
										</span>
									</div>
									<div className="flex items-start space-x-2">
										<span className="text-success">✓</span>
										<span>
											<strong>Public Key:</strong> Share this with others to verify your recordings
										</span>
									</div>
									<div className="flex items-start space-x-2">
										<span className="text-success">✓</span>
										<span>
											<strong>Ed25519:</strong> Industry-standard digital signature algorithm (RFC
											8032)
										</span>
									</div>
									<div className="flex items-start space-x-2">
										<span className="text-success">✓</span>
										<span>
											<strong>Automatic:</strong> All recordings are automatically signed when key
											exists
										</span>
									</div>
								</div>
							</CardBody>
						</Card>

						{/* Sharing Instructions */}
						{hasSigningKey && publicKey && (
							<Card className="bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
								<CardBody className="p-4">
									<h4 className="font-semibold mb-2 text-primary">How to Share Your Public Key</h4>
									<ol className="space-y-2 text-sm text-foreground-600 dark:text-foreground-400 list-decimal list-inside">
										<li>Click "Copy" to copy your public key to clipboard</li>
										<li>Share it via email, website, or include it with your recordings</li>
										<li>Others can use it to verify recordings you've created</li>
										<li>Your private key stays secure on your device</li>
									</ol>
								</CardBody>
							</Card>
						)}

						{/* Warning for Regeneration */}
						{hasSigningKey && (
							<Card className="bg-warning-50 dark:bg-warning-900/20 border-warning-200 dark:border-warning-800">
								<CardBody className="p-4">
									<div className="flex items-start space-x-2">
										<AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
										<div>
											<h4 className="font-semibold text-warning mb-1">Warning</h4>
											<p className="text-sm text-foreground-600 dark:text-foreground-400">
												Generating a new key will replace your current key. Previous recordings
												signed with the old key will still be valid, but you won't be able to sign
												new recordings with the old key.
											</p>
										</div>
									</div>
									<Button
										className="mt-3"
										color="warning"
										variant="flat"
										size="sm"
										onPress={handleGenerateKey}
										isLoading={isGenerating}
									>
										Generate New Key (Replace Current)
									</Button>
								</CardBody>
							</Card>
						)}
					</div>
				</ModalBody>
				<ModalFooter>
					<Button color="primary" variant="light" onPress={onClose}>
						Close
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}
