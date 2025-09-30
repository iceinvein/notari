import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { invoke } from "@tauri-apps/api/core";
import { AlertCircle, CheckCircle, Eye, EyeOff, Lock, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

type EncryptionPasswordModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onConfirm: (password: string) => void;
	title?: string;
	description?: string;
	mode?: "encrypt" | "decrypt";
};

export default function EncryptionPasswordModal({
	isOpen,
	onClose,
	onConfirm,
	title = "Encryption Password",
	description = "Enter a password to encrypt your recording",
	mode = "encrypt",
}: EncryptionPasswordModalProps) {
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);
	const [validationError, setValidationError] = useState<string | null>(null);
	const [isValidating, setIsValidating] = useState(false);
	const [passwordStrength, setPasswordStrength] = useState<"weak" | "medium" | "strong" | null>(
		null
	);

	// Reset state when modal opens/closes
	useEffect(() => {
		if (!isOpen) {
			setPassword("");
			setConfirmPassword("");
			setShowPassword(false);
			setShowConfirmPassword(false);
			setValidationError(null);
			setPasswordStrength(null);
		}
	}, [isOpen]);

	// Validate password strength in real-time
	useEffect(() => {
		if (password.length === 0) {
			setPasswordStrength(null);
			return;
		}

		const hasUppercase = /[A-Z]/.test(password);
		const hasLowercase = /[a-z]/.test(password);
		const hasDigit = /\d/.test(password);
		const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
		const length = password.length;

		if (length >= 12 && hasUppercase && hasLowercase && hasDigit && hasSpecial) {
			setPasswordStrength("strong");
		} else if (length >= 8 && hasUppercase && hasLowercase && hasDigit) {
			setPasswordStrength("medium");
		} else {
			setPasswordStrength("weak");
		}
	}, [password]);

	const handleConfirm = async () => {
		setValidationError(null);
		setIsValidating(true);

		try {
			// For encryption mode, validate password strength
			if (mode === "encrypt") {
				// Check if passwords match
				if (password !== confirmPassword) {
					setValidationError("Passwords do not match");
					setIsValidating(false);
					return;
				}

				// Validate password strength via backend
				await invoke("validate_encryption_password", { password });
			}

			// Password is valid, confirm
			onConfirm(password);
			onClose();
		} catch (error) {
			setValidationError(error instanceof Error ? error.message : String(error));
		} finally {
			setIsValidating(false);
		}
	};

	const getStrengthColor = () => {
		switch (passwordStrength) {
			case "strong":
				return "text-success";
			case "medium":
				return "text-warning";
			case "weak":
				return "text-danger";
			default:
				return "text-foreground-500";
		}
	};

	const getStrengthText = () => {
		switch (passwordStrength) {
			case "strong":
				return "Strong password";
			case "medium":
				return "Medium strength";
			case "weak":
				return "Weak password";
			default:
				return "";
		}
	};

	return (
		<Modal isOpen={isOpen} onClose={onClose} size="md">
			<ModalContent>
				<ModalHeader className="flex items-center space-x-2">
					<Lock className="w-5 h-5" />
					<span>{title}</span>
				</ModalHeader>
				<ModalBody>
					<div className="space-y-4">
						<p className="text-sm text-foreground-500">{description}</p>

						{/* Password Input */}
						<Input
							label="Password"
							placeholder="Enter password"
							type={showPassword ? "text" : "password"}
							value={password}
							onValueChange={setPassword}
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
							autoFocus
						/>

						{/* Password Strength Indicator (Encrypt mode only) */}
						{mode === "encrypt" && passwordStrength && (
							<div className="flex items-center space-x-2">
								{passwordStrength === "strong" ? (
									<CheckCircle className="w-4 h-4 text-success" />
								) : passwordStrength === "medium" ? (
									<AlertCircle className="w-4 h-4 text-warning" />
								) : (
									<XCircle className="w-4 h-4 text-danger" />
								)}
								<span className={`text-sm ${getStrengthColor()}`}>{getStrengthText()}</span>
							</div>
						)}

						{/* Confirm Password (Encrypt mode only) */}
						{mode === "encrypt" && (
							<Input
								label="Confirm Password"
								placeholder="Re-enter password"
								type={showConfirmPassword ? "text" : "password"}
								value={confirmPassword}
								onValueChange={setConfirmPassword}
								endContent={
									<button
										className="focus:outline-none"
										type="button"
										onClick={() => setShowConfirmPassword(!showConfirmPassword)}
									>
										{showConfirmPassword ? (
											<EyeOff className="w-4 h-4 text-foreground-400" />
										) : (
											<Eye className="w-4 h-4 text-foreground-400" />
										)}
									</button>
								}
							/>
						)}

						{/* Validation Error */}
						{validationError && (
							<div className="p-3 bg-danger-50 dark:bg-danger-900/20 rounded-lg border border-danger-200 dark:border-danger-800">
								<div className="flex items-start space-x-2">
									<XCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
									<span className="text-sm text-danger">{validationError}</span>
								</div>
							</div>
						)}

						{/* Password Requirements (Encrypt mode only) */}
						{mode === "encrypt" && (
							<div className="p-3 bg-content2 rounded-lg">
								<h4 className="text-sm font-semibold mb-2">Password Requirements</h4>
								<ul className="space-y-1 text-xs text-foreground-500">
									<li className="flex items-center space-x-2">
										<span className={password.length >= 8 ? "text-success" : ""}>
											{password.length >= 8 ? "✓" : "○"}
										</span>
										<span>At least 8 characters</span>
									</li>
									<li className="flex items-center space-x-2">
										<span className={/[A-Z]/.test(password) ? "text-success" : ""}>
											{/[A-Z]/.test(password) ? "✓" : "○"}
										</span>
										<span>One uppercase letter</span>
									</li>
									<li className="flex items-center space-x-2">
										<span className={/[a-z]/.test(password) ? "text-success" : ""}>
											{/[a-z]/.test(password) ? "✓" : "○"}
										</span>
										<span>One lowercase letter</span>
									</li>
									<li className="flex items-center space-x-2">
										<span className={/\d/.test(password) ? "text-success" : ""}>
											{/\d/.test(password) ? "✓" : "○"}
										</span>
										<span>One number</span>
									</li>
								</ul>
							</div>
						)}
					</div>
				</ModalBody>
				<ModalFooter>
					<Button color="default" variant="light" onPress={onClose}>
						Cancel
					</Button>
					<Button
						color="primary"
						onPress={handleConfirm}
						isLoading={isValidating}
						isDisabled={
							!password ||
							(mode === "encrypt" && (!confirmPassword || password !== confirmPassword)) ||
							(mode === "encrypt" && passwordStrength === "weak")
						}
					>
						{mode === "encrypt" ? "Encrypt" : "Decrypt"}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}
