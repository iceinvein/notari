import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/modal";
import { Snippet } from "@heroui/snippet";
import { invoke } from "@tauri-apps/api/core";
import { Check, Copy, Download, Key, QrCode, Share2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { logger } from "../utils/logger";

type KeyManagementProps = {
	isOpen: boolean;
	onClose: () => void;
};

export default function KeyManagement({ isOpen, onClose }: KeyManagementProps) {
	const [publicKey, setPublicKey] = useState<string>("");
	const [hasKey, setHasKey] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [showQRCode, setShowQRCode] = useState(false);
	const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
	const [copied, setCopied] = useState(false);

	const loadPublicKey = useCallback(async () => {
		try {
			setIsLoading(true);
			setError(null);

			// Check if key exists
			const keyExists = await invoke<boolean>("has_encryption_key");
			setHasKey(keyExists);

			if (keyExists) {
				// Export public key
				const key = await invoke<string>("export_encryption_public_key");
				setPublicKey(key);
				logger.info("KeyManagement", "Public key loaded successfully");
			} else {
				logger.info("KeyManagement", "No encryption key found");
			}
		} catch (err) {
			logger.error("KeyManagement", "Failed to load public key", err as Error);
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (isOpen) {
			loadPublicKey();
		}
	}, [isOpen, loadPublicKey]);

	const generateKey = async () => {
		try {
			setIsLoading(true);
			setError(null);

			const key = await invoke<string>("generate_encryption_key");
			setPublicKey(key);
			setHasKey(true);
			logger.info("KeyManagement", "Encryption key generated successfully");
		} catch (err) {
			logger.error("KeyManagement", "Failed to generate key", err as Error);
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsLoading(false);
		}
	};

	const copyToClipboard = async () => {
		try {
			await navigator.clipboard.writeText(publicKey);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
			logger.info("KeyManagement", "Public key copied to clipboard");
		} catch (err) {
			logger.error("KeyManagement", "Failed to copy to clipboard", err as Error);
			setError("Failed to copy to clipboard");
		}
	};

	const downloadPublicKey = () => {
		const blob = new Blob([publicKey], { type: "text/plain" });
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "notari-public-key.txt";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
		logger.info("KeyManagement", "Public key downloaded");
	};

	const generateQRCode = async () => {
		try {
			// Use a simple QR code generation approach
			// In production, you might want to use a proper QR code library
			const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicKey)}`;
			setQrCodeDataUrl(qrCodeUrl);
			setShowQRCode(true);
			logger.info("KeyManagement", "QR code generated");
		} catch (err) {
			logger.error("KeyManagement", "Failed to generate QR code", err as Error);
			setError("Failed to generate QR code");
		}
	};

	const deleteKey = async () => {
		if (!confirm("Are you sure you want to delete your encryption key? This cannot be undone!")) {
			return;
		}

		try {
			setIsLoading(true);
			setError(null);

			await invoke("delete_encryption_key");
			setPublicKey("");
			setHasKey(false);
			logger.info("KeyManagement", "Encryption key deleted");
		} catch (err) {
			logger.error("KeyManagement", "Failed to delete key", err as Error);
			setError(err instanceof Error ? err.message : String(err));
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<>
			<Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
				<ModalContent>
					<ModalHeader className="flex items-center space-x-2">
						<Key className="h-5 w-5" />
						<span>Encryption Key Management</span>
					</ModalHeader>
					<ModalBody className="pb-6">
						{error && (
							<div className="mb-4 rounded-lg bg-danger-50 p-3 text-sm text-danger-600">
								{error}
							</div>
						)}

						{!hasKey ? (
							<Card>
								<CardBody className="space-y-4 p-6">
									<div className="text-center">
										<Key className="mx-auto mb-4 h-12 w-12 text-default-400" />
										<h3 className="mb-2 text-lg font-semibold">No Encryption Key Found</h3>
										<p className="mb-4 text-sm text-default-500">
											Generate an encryption key to enable public key encryption for your
											recordings.
										</p>
										<Button
											color="primary"
											startContent={<Key className="h-4 w-4" />}
											onPress={generateKey}
											isLoading={isLoading}
										>
											Generate Encryption Key
										</Button>
									</div>
								</CardBody>
							</Card>
						) : (
							<div className="space-y-4">
								{/* Public Key Display */}
								<Card>
									<CardHeader>
										<h3 className="text-sm font-semibold">Your Public Key</h3>
									</CardHeader>
									<Divider />
									<CardBody className="space-y-3">
										<p className="text-xs text-default-500">
											Share this public key with others so they can encrypt videos for you.
										</p>
										<Snippet
											symbol=""
											variant="bordered"
											classNames={{
												base: "w-full",
												pre: "font-mono text-xs break-all whitespace-pre-wrap",
											}}
										>
											{publicKey}
										</Snippet>
									</CardBody>
								</Card>

								{/* Actions */}
								<Card>
									<CardHeader>
										<h3 className="text-sm font-semibold">Share Your Public Key</h3>
									</CardHeader>
									<Divider />
									<CardBody className="space-y-2">
										<div className="grid grid-cols-2 gap-2">
											<Button
												variant="flat"
												startContent={
													copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />
												}
												onPress={copyToClipboard}
												color={copied ? "success" : "default"}
											>
												{copied ? "Copied!" : "Copy"}
											</Button>
											<Button
												variant="flat"
												startContent={<Download className="h-4 w-4" />}
												onPress={downloadPublicKey}
											>
												Download
											</Button>
											<Button
												variant="flat"
												startContent={<QrCode className="h-4 w-4" />}
												onPress={generateQRCode}
												className="col-span-2"
											>
												Generate QR Code
											</Button>
										</div>
									</CardBody>
								</Card>

								{/* Info */}
								<Card>
									<CardBody className="space-y-2 p-4">
										<div className="flex items-start space-x-2">
											<Share2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
											<div className="text-xs text-default-600">
												<p className="font-semibold">How to use:</p>
												<ol className="ml-4 mt-1 list-decimal space-y-1">
													<li>Share your public key with others</li>
													<li>They add your key as a recipient when recording</li>
													<li>You can decrypt and view videos encrypted for you</li>
												</ol>
											</div>
										</div>
									</CardBody>
								</Card>

								{/* Danger Zone */}
								<Card className="border-danger">
									<CardHeader>
										<h3 className="text-sm font-semibold text-danger">Danger Zone</h3>
									</CardHeader>
									<Divider />
									<CardBody>
										<p className="mb-3 text-xs text-default-500">
											Deleting your encryption key will prevent you from decrypting videos encrypted
											for you. This action cannot be undone.
										</p>
										<Button color="danger" variant="flat" size="sm" onPress={deleteKey}>
											Delete Encryption Key
										</Button>
									</CardBody>
								</Card>
							</div>
						)}
					</ModalBody>
				</ModalContent>
			</Modal>

			{/* QR Code Modal */}
			<Modal isOpen={showQRCode} onClose={() => setShowQRCode(false)} size="sm">
				<ModalContent>
					<ModalHeader>Public Key QR Code</ModalHeader>
					<ModalBody className="items-center pb-6">
						{qrCodeDataUrl && (
							<>
								<img src={qrCodeDataUrl} alt="Public Key QR Code" className="rounded-lg" />
								<p className="text-center text-xs text-default-500">
									Scan this QR code to import the public key
								</p>
							</>
						)}
					</ModalBody>
				</ModalContent>
			</Modal>
		</>
	);
}
