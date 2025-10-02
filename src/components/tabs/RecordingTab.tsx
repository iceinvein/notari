import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/react";
import { Switch } from "@heroui/switch";
import { Circle, Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";
import { useRecordingSystemStatusQuery } from "../../hooks/useRecordingSystem";
import RecordingStatus from "../RecordingStatus";
import { TagInput } from "../TagInput";

type RecordingTabProps = {
	onOpenWindowPicker: () => void;
	encryptionPassword: string;
	setEncryptionPassword: (password: string) => void;
	recordingTitle: string;
	setRecordingTitle: (title: string) => void;
	recordingDescription: string;
	setRecordingDescription: (description: string) => void;
	recordingTags: string[];
	setRecordingTags: (tags: string[]) => void;
};

export default function RecordingTab({
	onOpenWindowPicker,
	encryptionPassword,
	setEncryptionPassword,
	recordingTitle,
	setRecordingTitle,
	recordingDescription,
	setRecordingDescription,
	recordingTags,
	setRecordingTags,
}: RecordingTabProps) {
	const { data: recordingStatus } = useRecordingSystemStatusQuery();

	const [encryptionEnabled, setEncryptionEnabled] = useState(false);
	const [showPassword, setShowPassword] = useState(false);
	const [passwordError, setPasswordError] = useState<string | null>(null);

	const hasActiveRecording = recordingStatus?.has_active_recording ?? false;
	const activeSession = recordingStatus?.active_session;

	// Common tag suggestions
	const tagSuggestions = [
		"meeting",
		"demo",
		"bug-report",
		"tutorial",
		"presentation",
		"review",
		"interview",
		"training",
		"documentation",
		"testing",
	];

	// Validate password strength
	const validatePassword = (password: string): string | null => {
		if (password.length < 8) {
			return "Password must be at least 8 characters";
		}
		if (!/[A-Z]/.test(password)) {
			return "Password must contain an uppercase letter";
		}
		if (!/[a-z]/.test(password)) {
			return "Password must contain a lowercase letter";
		}
		if (!/[0-9]/.test(password)) {
			return "Password must contain a number";
		}
		return null;
	};

	const handleStartRecording = async () => {
		if (hasActiveRecording) {
			return;
		}

		// Validate password if encryption is enabled
		if (encryptionEnabled) {
			const error = validatePassword(encryptionPassword);
			if (error) {
				setPasswordError(error);
				return;
			}
		}

		// Open window picker
		onOpenWindowPicker();
	};

	return (
		<div className="h-full flex flex-col">
			{/* Recording Status */}
			{hasActiveRecording && activeSession && (
				<div className="flex-1 overflow-auto p-4">
					<RecordingStatus />
				</div>
			)}

			{/* Pre-recording form - only show when no active recording */}
			{!hasActiveRecording && (
				<>
					<div className="flex-1 overflow-auto p-4 space-y-4">
						{/* Encryption Settings */}
						<div className="p-4 bg-content2 rounded-lg space-y-4">
							<Switch
								isSelected={encryptionEnabled}
								onValueChange={(enabled) => {
									setEncryptionEnabled(enabled);
									if (!enabled) {
										setEncryptionPassword("");
										setPasswordError(null);
									}
								}}
								size="sm"
							>
								<div className="flex items-center space-x-2">
									<Lock className="w-4 h-4" />
									<div>
										<p className="text-sm font-medium">Encrypt Recording</p>
										<p className="text-xs text-foreground-500">
											Password-protect your video with AES-256-GCM
										</p>
									</div>
								</div>
							</Switch>

							{/* Password Input - shown when encryption is enabled */}
							{encryptionEnabled && (
								<div className="space-y-2">
									<Input
										type={showPassword ? "text" : "password"}
										label="Encryption Password"
										placeholder="Enter a strong password"
										value={encryptionPassword}
										onValueChange={(value) => {
											setEncryptionPassword(value);
											setPasswordError(null);
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
										size="sm"
									/>
									<div className="text-xs text-foreground-500 space-y-1">
										<p className="font-medium">Password requirements:</p>
										<ul className="list-disc list-inside space-y-0.5 ml-2">
											<li className={encryptionPassword.length >= 8 ? "text-success" : ""}>
												At least 8 characters
											</li>
											<li className={/[A-Z]/.test(encryptionPassword) ? "text-success" : ""}>
												One uppercase letter
											</li>
											<li className={/[a-z]/.test(encryptionPassword) ? "text-success" : ""}>
												One lowercase letter
											</li>
											<li className={/[0-9]/.test(encryptionPassword) ? "text-success" : ""}>
												One number
											</li>
										</ul>
									</div>
								</div>
							)}
						</div>

						{/* Metadata Settings */}
						<div className="p-4 bg-content2 rounded-lg space-y-4">
							<div className="space-y-1 mb-3">
								<p className="text-sm font-medium">Recording Metadata (Optional)</p>
								<p className="text-xs text-foreground-500">
									Add title, description, and tags to organize your recordings
								</p>
							</div>

							<Input
								size="sm"
								label="Title"
								placeholder="Give this recording a name..."
								value={recordingTitle}
								onValueChange={setRecordingTitle}
							/>

							<Textarea
								size="sm"
								label="Description"
								placeholder="What does this recording show?"
								value={recordingDescription}
								onValueChange={setRecordingDescription}
								minRows={2}
								maxRows={4}
							/>

							<TagInput
								label="Tags"
								placeholder="Type and press Enter..."
								value={recordingTags}
								onChange={setRecordingTags}
								suggestions={tagSuggestions}
								size="sm"
							/>
						</div>

						{/* Info Section */}
						<div className="bg-content2 rounded-lg p-4 space-y-3">
							<h4 className="text-sm font-medium text-foreground">Recording Features</h4>
							<div className="space-y-2 text-xs text-foreground-500">
								<div className="flex items-start space-x-2">
									<span className="text-success">✓</span>
									<span>Record individual windows with high quality</span>
								</div>
								<div className="flex items-start space-x-2">
									<span className="text-success">✓</span>
									<span>Optional AES-256-GCM encryption</span>
								</div>
								<div className="flex items-start space-x-2">
									<span className="text-success">✓</span>
									<span>Automatic cryptographic signatures</span>
								</div>
								<div className="flex items-start space-x-2">
									<span className="text-success">✓</span>
									<span>Tamper-evident evidence manifests</span>
								</div>
							</div>
						</div>
					</div>

					{/* Fixed bottom button */}
					<div className="p-4 border-t border-divider bg-background">
						<Button
							color="primary"
							size="lg"
							className="w-full font-medium"
							onPress={handleStartRecording}
							startContent={<Circle className="w-5 h-5" />}
						>
							Start Recording Session
						</Button>
					</div>
				</>
			)}
		</div>
	);
}
