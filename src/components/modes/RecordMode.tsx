import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { invoke } from "@tauri-apps/api/core";
import { AlertCircle } from "lucide-react";

import { useState } from "react";
import {
	useActiveRecordingSessionQuery,
	useRecordingPreferencesQuery,
	useStartRecordingMutation,
} from "../../hooks/useRecordingSystem";
import { isRecordingActive } from "../../types/recording";
import AppHeader from "../AppHeader";
import RecordingStatus from "../RecordingStatus";
import SettingsModal from "../SettingsModal";
import WindowPicker from "../WindowPicker";

type WindowInfo = {
	id: string;
	title: string;
	application: string;
	is_minimized: boolean;
	bounds: {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	thumbnail?: string;
};

type RecordModeProps = {
	onStartRecording: () => void;
	onVerifyFile: () => void;
};

type RecordView = "main" | "window-picker";

export default function RecordMode({ onStartRecording, onVerifyFile }: RecordModeProps) {
	const [currentView, setCurrentView] = useState<RecordView>("main");
	const [_selectedWindow, setSelectedWindow] = useState<WindowInfo | null>(null);
	const [showSettings, setShowSettings] = useState(false);
	const [startError, setStartError] = useState<string | null>(null);

	// Recording system hooks
	const { data: activeSession } = useActiveRecordingSessionQuery();
	const { data: recordingPreferences } = useRecordingPreferencesQuery();
	const startRecordingMutation = useStartRecordingMutation();

	// Determine if recording is actually active based on session status
	const hasActiveRecording = activeSession ? isRecordingActive(activeSession.status) : false;

	const handleStartRecording = () => {
		if (hasActiveRecording) {
			// If there's already an active recording, don't allow starting another
			return;
		}
		setCurrentView("window-picker");
	};

	const handleWindowSelect = async (window: WindowInfo) => {
		setSelectedWindow(window);

		try {
			setStartError(null);
			// Start recording with the selected window
			await startRecordingMutation.mutateAsync({
				windowId: window.id,
				preferences: recordingPreferences,
			});

			// Call the parent callback to indicate recording started
			onStartRecording();
			setCurrentView("main");
		} catch (error) {
			console.error("Failed to start recording:", error);
			const message = error instanceof Error ? error.message : String(error);
			setStartError(message || "Failed to start recording");
			// Stay on window picker if recording failed
		}
	};

	const handleBackToMain = () => {
		setCurrentView("main");
	};

	if (currentView === "window-picker") {
		const openScreenRecordingSettings = async () => {
			try {
				await invoke("open_system_settings");
			} catch (e) {
				console.error("Failed to open system settings:", e);
			}
		};
		return (
			<>
				{startError && (
					<div className="px-4">
						<Card className="mb-3 border border-danger/20 bg-danger/10">
							<CardBody className="flex items-start gap-3">
								<AlertCircle className="w-5 h-5 text-danger mt-1" />
								<div className="flex-1">
									<p className="text-danger text-sm font-medium">Failed to start recording</p>
									<p className="text-foreground-500 text-xs break-words">{startError}</p>
									<div className="mt-2 flex gap-2">
										<Button size="sm" color="danger" variant="flat" onPress={openScreenRecordingSettings}>
											Open Screen Recording Settings
										</Button>
										<Button size="sm" variant="bordered" onPress={() => setStartError(null)}>
											Dismiss
										</Button>
									</div>
								</div>
							</CardBody>
						</Card>
					</div>
				)}
				<WindowPicker onWindowSelect={handleWindowSelect} onBack={handleBackToMain} />
				<SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
			</>
		);
	}

	return (
		<>
			<Card className="w-full h-full bg-transparent shadow-none border-none rounded-xl">
				<CardHeader className="pb-3 px-4 pt-6">
					<AppHeader
						title="Notari"
						subtitle="Local Recording Mode"
						showBackButton={false}
						showSettingsButton={true}
						onSettings={() => setShowSettings(true)}
						statusChip={{
							text: "Offline",
							color: "secondary",
							variant: "dot",
						}}
					/>
				</CardHeader>
				<Divider />
				<CardBody className="pt-6 px-4 pb-4">
					<div className="space-y-6">
						{/* Recording Status */}
						{hasActiveRecording && <RecordingStatus />}

						{/* Main Actions */}
						<div className="space-y-4">
							<div className="text-center space-y-2">
								<h3 className="text-sm font-medium text-foreground">
									{hasActiveRecording ? "Recording in Progress" : "What would you like to do?"}
								</h3>
								<p className="text-xs text-foreground-500">
									{hasActiveRecording
										? "Your recording session is active. Use the controls above to manage it."
										: "Create tamper-evident proof of your work or verify existing files"}
								</p>
							</div>

							<div className="space-y-3">
								<Button
									color="primary"
									size="lg"
									className="w-full font-medium transition-all duration-200 hover:scale-105 active:scale-95"
									onPress={handleStartRecording}
									isDisabled={hasActiveRecording || startRecordingMutation.isPending}
									isLoading={startRecordingMutation.isPending}
									startContent={
										<div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
											<div className="w-2 h-2 rounded-full bg-white"></div>
										</div>
									}
								>
									{hasActiveRecording ? "Recording Active" : "Start Recording Session"}
								</Button>

								<Button
									variant="bordered"
									size="lg"
									className="w-full font-medium transition-all duration-200 hover:scale-105 active:scale-95"
									onPress={onVerifyFile}
									startContent={<span className="text-lg">🔍</span>}
								>
									Verify Existing File
								</Button>
							</div>
						</div>

						{/* Info Section */}
						<div className="bg-content2 rounded-lg p-4 space-y-3">
							<h4 className="text-sm font-medium text-foreground">Local Mode Features</h4>
							<div className="space-y-2 text-xs text-foreground-500">
								<div className="flex items-start space-x-2">
									<span className="text-success">✓</span>
									<span>Record work sessions with cryptographic integrity</span>
								</div>
								<div className="flex items-start space-x-2">
									<span className="text-success">✓</span>
									<span>Generate tamper-evident proofs locally</span>
								</div>
								<div className="flex items-start space-x-2">
									<span className="text-success">✓</span>
									<span>Verify file authenticity and timestamps</span>
								</div>
								<div className="flex items-start space-x-2">
									<span className="text-warning">⚠</span>
									<span>Files stored locally only (not backed up online)</span>
								</div>
							</div>
						</div>
					</div>
				</CardBody>
			</Card>

			{/* Settings Modal */}
			<SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
		</>
	);
}
