import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { useState } from "react";
import AppHeader from "../AppHeader";
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
}

type RecordModeProps = {
	onStartRecording: () => void;
	onVerifyFile: () => void;
}

type RecordView = "main" | "window-picker";

export default function RecordMode({ onStartRecording, onVerifyFile }: RecordModeProps) {
	const [currentView, setCurrentView] = useState<RecordView>("main");
	const [_selectedWindow, setSelectedWindow] = useState<WindowInfo | null>(null);
	const [showSettings, setShowSettings] = useState(false);

	const handleStartRecording = () => {
		setCurrentView("window-picker");
	};

	const handleWindowSelect = (window: WindowInfo) => {
		setSelectedWindow(window);
		// TODO: Start actual recording with selected window
		onStartRecording();
		setCurrentView("main");
	};

	const handleBackToMain = () => {
		setCurrentView("main");
	};

	if (currentView === "window-picker") {
		return (
			<>
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
						{/* Main Actions */}
						<div className="space-y-4">
							<div className="text-center space-y-2">
								<h3 className="text-sm font-medium text-foreground">What would you like to do?</h3>
								<p className="text-xs text-foreground-500">
									Create tamper-evident proof of your work or verify existing files
								</p>
							</div>

							<div className="space-y-3">
								<Button
									color="primary"
									size="lg"
									className="w-full font-medium transition-all duration-200 hover:scale-105 active:scale-95"
									onPress={handleStartRecording}
									startContent={
										<div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
											<div className="w-2 h-2 rounded-full bg-white"></div>
										</div>
									}
								>
									Start Recording Session
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
