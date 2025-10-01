import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/modal";
import { Tab, Tabs } from "@heroui/tabs";
import { Circle, Play, Shield } from "lucide-react";
import { useState } from "react";

import { useStartRecordingMutation } from "../../hooks/useRecordingSystem";
import AppHeader from "../AppHeader";
import SettingsModal from "../SettingsModal";
import RecordedVideosTab from "../tabs/RecordedVideosTab";
import RecordingTab from "../tabs/RecordingTab";
import VerifyTab from "../tabs/VerifyTab";
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
};

export default function RecordMode({ onStartRecording }: RecordModeProps) {
	const [selectedTab, setSelectedTab] = useState("recording");
	const [showSettings, setShowSettings] = useState(false);
	const [showWindowPicker, setShowWindowPicker] = useState(false);
	const [encryptionPassword, setEncryptionPassword] = useState("");
	const [recordingTitle, setRecordingTitle] = useState("");
	const [recordingDescription, setRecordingDescription] = useState("");
	const [recordingTags, setRecordingTags] = useState<string[]>([]);
	const startRecordingMutation = useStartRecordingMutation();

	const handleWindowSelect = async (window: WindowInfo) => {
		try {
			// Start recording with or without password and metadata
			const password = encryptionPassword || null;
			await startRecordingMutation.mutateAsync({
				windowId: window.id,
				encryptionPassword: password,
				recordingTitle: recordingTitle || undefined,
				recordingDescription: recordingDescription || undefined,
				recordingTags: recordingTags.length > 0 ? recordingTags : undefined,
			});

			// Close window picker and reset form
			setShowWindowPicker(false);
			setEncryptionPassword("");
			setRecordingTitle("");
			setRecordingDescription("");
			setRecordingTags([]);

			// Call parent handler
			onStartRecording();
		} catch (error) {
			console.error("Failed to start recording:", error);
		}
	};

	const handleOpenWindowPicker = () => {
		setShowWindowPicker(true);
	};

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
				<CardBody className="p-0 overflow-hidden flex flex-col">
					<Tabs
						selectedKey={selectedTab}
						onSelectionChange={(key) => setSelectedTab(key as string)}
						color="primary"
						variant="underlined"
						classNames={{
							base: "w-full",
							tabList: "gap-6 w-full relative rounded-none p-0 px-4 border-b border-divider",
							cursor: "w-full bg-primary",
							tab: "max-w-fit px-0 h-12",
							tabContent: "group-data-[selected=true]:text-primary",
							panel: "flex-1 overflow-auto",
						}}
					>
						<Tab
							key="recording"
							title={
								<div className="flex items-center space-x-2">
									<Circle className="w-4 h-4" />
									<span>Recording</span>
								</div>
							}
						>
							<RecordingTab
								onOpenWindowPicker={handleOpenWindowPicker}
								encryptionPassword={encryptionPassword}
								setEncryptionPassword={setEncryptionPassword}
								recordingTitle={recordingTitle}
								setRecordingTitle={setRecordingTitle}
								recordingDescription={recordingDescription}
								setRecordingDescription={setRecordingDescription}
								recordingTags={recordingTags}
								setRecordingTags={setRecordingTags}
							/>
						</Tab>

						<Tab
							key="videos"
							title={
								<div className="flex items-center space-x-2">
									<Play className="w-4 h-4" />
									<span>Recorded Videos</span>
								</div>
							}
						>
							<RecordedVideosTab onSettings={() => setShowSettings(true)} />
						</Tab>

						<Tab
							key="verify"
							title={
								<div className="flex items-center space-x-2">
									<Shield className="w-4 h-4" />
									<span>Verify</span>
								</div>
							}
						>
							<VerifyTab />
						</Tab>
					</Tabs>
				</CardBody>
			</Card>

			{/* Settings Modal */}
			<SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

			{/* Window Picker Modal */}
			<Modal
				isOpen={showWindowPicker}
				onClose={() => setShowWindowPicker(false)}
				size="5xl"
				classNames={{
					base: "bg-background",
					backdrop: "bg-black/50",
				}}
			>
				<ModalContent>
					<ModalHeader className="flex items-center space-x-3 px-4">
						<span className="text-lg font-semibold">Select Window to Record</span>
					</ModalHeader>
					<ModalBody className="p-4">
						<WindowPicker
							onWindowSelect={handleWindowSelect}
							onBack={() => setShowWindowPicker(false)}
						/>
					</ModalBody>
				</ModalContent>
			</Modal>
		</>
	);
}
