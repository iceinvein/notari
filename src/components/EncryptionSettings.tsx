import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Radio, RadioGroup } from "@heroui/radio";
import { Switch } from "@heroui/switch";
import { invoke } from "@tauri-apps/api/core";
import { Eye, EyeOff, Lock, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { logger } from "../utils/logger";

export type EncryptionMethod = "password" | "public-key";

export type Recipient = {
	id: string;
	publicKey: string;
};

type EncryptionSettingsProps = {
	encryptionEnabled: boolean;
	onEncryptionEnabledChange: (enabled: boolean) => void;
	encryptionMethod: EncryptionMethod;
	onEncryptionMethodChange: (method: EncryptionMethod) => void;
	// Password-based encryption
	password: string;
	onPasswordChange: (password: string) => void;
	passwordError: string | null;
	onPasswordErrorChange: (error: string | null) => void;
	// Public key encryption
	recipients: Recipient[];
	onRecipientsChange: (recipients: Recipient[]) => void;
};

export default function EncryptionSettings({
	encryptionEnabled,
	onEncryptionEnabledChange,
	encryptionMethod,
	onEncryptionMethodChange,
	password,
	onPasswordChange,
	passwordError,
	onPasswordErrorChange,
	recipients,
	onRecipientsChange,
}: EncryptionSettingsProps) {
	const [showPassword, setShowPassword] = useState(false);
	const [newRecipientId, setNewRecipientId] = useState("");
	const [newRecipientKey, setNewRecipientKey] = useState("");
	const [recipientError, setRecipientError] = useState<string | null>(null);

	const handleAddRecipient = () => {
		// Validate inputs
		if (!newRecipientId.trim()) {
			setRecipientError("Recipient ID is required");
			return;
		}
		if (!newRecipientKey.trim()) {
			setRecipientError("Public key is required");
			return;
		}

		// Check for duplicates
		if (recipients.some((r) => r.id === newRecipientId.trim())) {
			setRecipientError("Recipient ID already exists");
			return;
		}

		// Add recipient
		onRecipientsChange([
			...recipients,
			{
				id: newRecipientId.trim(),
				publicKey: newRecipientKey.trim(),
			},
		]);

		// Clear inputs
		setNewRecipientId("");
		setNewRecipientKey("");
		setRecipientError(null);
	};

	const handleRemoveRecipient = (id: string) => {
		onRecipientsChange(recipients.filter((r) => r.id !== id));
	};

	const handleAddMyself = async () => {
		try {
			// Check if encryption key exists
			const hasKey = await invoke<boolean>("has_encryption_key");
			if (!hasKey) {
				setRecipientError("No encryption key found. Generate one in Settings > Security.");
				return;
			}

			// Get public key
			const publicKey = await invoke<string>("export_encryption_public_key");

			// Check if already added
			if (recipients.some((r) => r.publicKey === publicKey)) {
				setRecipientError("You are already in the recipients list");
				return;
			}

			// Add myself as recipient
			onRecipientsChange([
				...recipients,
				{
					id: "Me",
					publicKey,
				},
			]);

			setRecipientError(null);
			logger.info("EncryptionSettings", "Added self as recipient");
		} catch (err) {
			logger.error("EncryptionSettings", "Failed to add self as recipient", err as Error);
			setRecipientError(err instanceof Error ? err.message : String(err));
		}
	};

	return (
		<div className="p-4 bg-content2 rounded-lg space-y-4">
			{/* Encryption Toggle */}
			<Switch
				isSelected={encryptionEnabled}
				onValueChange={(enabled) => {
					onEncryptionEnabledChange(enabled);
					if (!enabled) {
						onPasswordChange("");
						onPasswordErrorChange(null);
						onRecipientsChange([]);
					}
				}}
				size="sm"
			>
				<div className="flex items-center space-x-2">
					<Lock className="w-4 h-4" />
					<div>
						<p className="text-sm font-medium">Encrypt Recording</p>
						<p className="text-xs text-foreground-500">
							Protect your video with AES-256-GCM encryption
						</p>
					</div>
				</div>
			</Switch>

			{/* Encryption Method Selection */}
			{encryptionEnabled && (
				<>
					<RadioGroup
						label="Encryption Method"
						value={encryptionMethod}
						onValueChange={(value) => {
							onEncryptionMethodChange(value as EncryptionMethod);
							// Clear errors when switching methods
							onPasswordErrorChange(null);
							setRecipientError(null);
						}}
						size="sm"
					>
						<Radio value="password">
							<div>
								<p className="text-sm font-medium">Password-based</p>
								<p className="text-xs text-foreground-500">
									Encrypt with a password (you'll need to share it separately)
								</p>
							</div>
						</Radio>
						<Radio value="public-key">
							<div>
								<p className="text-sm font-medium">Public Key Encryption</p>
								<p className="text-xs text-foreground-500">
									Encrypt for specific recipients (no password sharing needed)
								</p>
							</div>
						</Radio>
					</RadioGroup>

					{/* Password Input */}
					{encryptionMethod === "password" && (
						<div className="space-y-2">
							<Input
								type={showPassword ? "text" : "password"}
								label="Encryption Password"
								placeholder="Enter a strong password"
								value={password}
								onValueChange={(value) => {
									onPasswordChange(value);
									onPasswordErrorChange(null);
								}}
								isInvalid={!!passwordError}
								errorMessage={passwordError}
								endContent={
									<button
										className="focus:outline-none"
										type="button"
										onClick={() => setShowPassword(!showPassword)}
									>
										{showPassword ? (
											<EyeOff className="w-4 h-4 text-foreground-400" />
										) : (
											<Eye className="w-4 h-4 text-foreground-400" />
										)}
									</button>
								}
							/>
							<p className="text-xs text-foreground-500">
								Password must be at least 12 characters with uppercase, lowercase, number, and
								special character
							</p>
						</div>
					)}

					{/* Public Key Recipients */}
					{encryptionMethod === "public-key" && (
						<div className="space-y-3">
							<div className="flex items-center space-x-2 text-sm font-medium">
								<Users className="w-4 h-4" />
								<span>Recipients</span>
							</div>

							{/* Recipient List */}
							{recipients.length > 0 && (
								<div className="space-y-2">
									{recipients.map((recipient) => (
										<div
											key={recipient.id}
											className="flex items-center justify-between p-2 bg-content1 rounded-lg"
										>
											<div className="flex-1 min-w-0">
												<p className="text-sm font-medium truncate">{recipient.id}</p>
												<p className="text-xs text-foreground-500 truncate font-mono">
													{recipient.publicKey.substring(0, 32)}...
												</p>
											</div>
											<Button
												isIconOnly
												size="sm"
												variant="light"
												color="danger"
												onPress={() => handleRemoveRecipient(recipient.id)}
											>
												<Trash2 className="w-4 h-4" />
											</Button>
										</div>
									))}
								</div>
							)}

							{/* Add Recipient Form */}
							<div className="space-y-2 p-3 bg-content1 rounded-lg">
								<p className="text-xs font-medium text-foreground-600">Add Recipient</p>
								<Input
									size="sm"
									label="Recipient ID"
									placeholder="e.g., alice@example.com"
									value={newRecipientId}
									onValueChange={(value) => {
										setNewRecipientId(value);
										setRecipientError(null);
									}}
									isInvalid={!!recipientError}
								/>
								<Input
									size="sm"
									label="Public Key (base64)"
									placeholder="Paste recipient's public key"
									value={newRecipientKey}
									onValueChange={(value) => {
										setNewRecipientKey(value);
										setRecipientError(null);
									}}
									isInvalid={!!recipientError}
								/>
								{recipientError && <p className="text-xs text-danger">{recipientError}</p>}
								<div className="flex gap-2">
									<Button
										size="sm"
										color="primary"
										variant="flat"
										onPress={handleAddRecipient}
										startContent={<Plus className="w-4 h-4" />}
										className="flex-1"
									>
										Add Recipient
									</Button>
									<Button
										size="sm"
										color="secondary"
										variant="flat"
										onPress={handleAddMyself}
										startContent={<UserPlus className="w-4 h-4" />}
										className="flex-1"
									>
										Add Myself
									</Button>
								</div>
							</div>

							{recipients.length === 0 && (
								<p className="text-xs text-warning">
									⚠️ At least one recipient is required for public key encryption
								</p>
							)}
						</div>
					)}
				</>
			)}
		</div>
	);
}
