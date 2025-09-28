import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/modal";
import { Tab, Tabs } from "@heroui/tabs";
import { Bug, FileText, Info, Palette, Settings, Shield, Smartphone } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useApplicationPreferences } from "../hooks/useApplicationPreferences";
import { preferencesLogger } from "../utils/logger";
import ApplicationSelector from "./ApplicationSelector";
import DevMode from "./DevMode";
import LogViewer from "./LogViewer";
import ThemeToggle from "./ThemeToggle";

interface SettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
	const [selectedTab, setSelectedTab] = useState("applications");
	const [devModeEnabled, setDevModeEnabled] = useState(() => {
		return localStorage.getItem("notari-dev-mode") === "true";
	});
	const [clickCount, setClickCount] = useState(0);
	const [showResetConfirm, setShowResetConfirm] = useState(false);
	const { resetToDefaults } = useApplicationPreferences();

	// Debug: Check if resetToDefaults is available
	useEffect(() => {
		preferencesLogger.info("SettingsModal: Component mounted, checking resetToDefaults function", {
			available: typeof resetToDefaults === "function",
		});
		preferencesLogger.info("SettingsModal: Test log to verify logging is working");
	}, [resetToDefaults]);

	const handleResetApplications = () => {
		preferencesLogger.info("SettingsModal: Reset button clicked");
		setShowResetConfirm(true);
	};

	const handleConfirmReset = async () => {
		preferencesLogger.info("SettingsModal: User confirmed reset, starting process...");
		setShowResetConfirm(false);

		try {
			await resetToDefaults();
			preferencesLogger.info("SettingsModal: Reset completed successfully");
			alert("Applications reset to defaults successfully!");
		} catch (error) {
			preferencesLogger.error(
				"SettingsModal: Reset failed",
				error instanceof Error ? error : new Error(String(error))
			);
			alert(
				`Failed to reset applications: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	};

	const handleCancelReset = () => {
		preferencesLogger.info("SettingsModal: User cancelled reset");
		setShowResetConfirm(false);
	};

	// Dev mode activation - click version number 7 times
	const handleVersionClick = () => {
		const newCount = clickCount + 1;
		setClickCount(newCount);

		if (newCount >= 7) {
			setDevModeEnabled(true);
			localStorage.setItem("notari-dev-mode", "true");
			setClickCount(0);
		}

		// Reset click count after 3 seconds of inactivity
		setTimeout(() => setClickCount(0), 3000);
	};

	return (
		<>
			<Modal
				isOpen={isOpen}
				onClose={onClose}
				size="2xl"
				scrollBehavior="inside"
				classNames={{
					base: "bg-background",
					header: "border-b border-divider",
					body: "py-4",
					footer: "border-t border-divider",
				}}
			>
				<ModalContent>
					<ModalHeader className="flex items-center space-x-3">
						<Settings className="w-5 h-5 text-primary" />
						<span className="text-lg font-semibold">Settings</span>
					</ModalHeader>

					<ModalBody>
						<Tabs
							selectedKey={selectedTab}
							onSelectionChange={(key) => setSelectedTab(key as string)}
							color="primary"
							variant="underlined"
							classNames={{
								tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
								cursor: "w-full bg-primary",
								tab: "max-w-fit px-0 h-12",
								tabContent: "group-data-[selected=true]:text-primary",
							}}
						>
							<Tab
								key="applications"
								title={
									<div className="flex items-center space-x-2">
										<Smartphone className="w-4 h-4" />
										<span>Applications</span>
									</div>
								}
							>
								<div className="space-y-4 pt-4">
									<ApplicationSelector
										title="Manage Recording Applications"
										description="Control which applications can be recorded during your sessions."
										showAddCustom={true}
										compact={false}
									/>

									<Divider />

									<div className="flex items-center justify-between p-3 bg-content1 rounded-lg">
										<div>
											<p className="text-sm font-medium text-foreground">Reset to Defaults</p>
											<p className="text-xs text-foreground-500">
												Restore Chrome and VSCode as the only enabled applications
											</p>
										</div>
										<Button
											size="sm"
											variant="bordered"
											color="warning"
											onPress={handleResetApplications}
										>
											Reset
										</Button>
									</div>
								</div>
							</Tab>

							<Tab
								key="appearance"
								title={
									<div className="flex items-center space-x-2">
										<Palette className="w-4 h-4" />
										<span>Appearance</span>
									</div>
								}
							>
								<div className="space-y-4 pt-4">
									<Card className="bg-content1">
										<CardHeader>
											<h4 className="text-sm font-medium text-foreground">Theme</h4>
										</CardHeader>
										<Divider />
										<CardBody>
											<ThemeToggle variant="full" size="md" />
										</CardBody>
									</Card>
								</div>
							</Tab>

							<Tab
								key="logs"
								title={
									<div className="flex items-center space-x-2">
										<FileText className="w-4 h-4" />
										<span>Logs</span>
									</div>
								}
							>
								<div className="pt-4">
									<LogViewer />
								</div>
							</Tab>

							{devModeEnabled && (
								<Tab
									key="developer"
									title={
										<div className="flex items-center space-x-2">
											<Bug className="w-4 h-4" />
											<span>Developer</span>
										</div>
									}
								>
									<div className="pt-4">
										<DevMode onBack={() => {}} />
									</div>
								</Tab>
							)}

							<Tab
								key="about"
								title={
									<div className="flex items-center space-x-2">
										<Info className="w-4 h-4" />
										<span>About</span>
									</div>
								}
							>
								<div className="space-y-4 pt-4">
									<Card className="bg-content1">
										<CardBody className="text-center space-y-4">
											<div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto">
												<Shield className="w-8 h-8 text-primary-foreground" />
											</div>
											<div>
												<h3 className="text-lg font-semibold text-foreground">Notari</h3>
												<button
													className="text-sm text-foreground-500 cursor-pointer select-none bg-transparent border-none p-0 hover:text-foreground-400 transition-colors"
													onClick={handleVersionClick}
													type="button"
												>
													Version 0.1.0
													{clickCount > 0 && clickCount < 7 && (
														<span className="ml-2 text-xs text-primary">({clickCount}/7)</span>
													)}
												</button>
											</div>
											<p className="text-xs text-foreground-400 leading-relaxed">
												Tamper-evident proof-of-work verification through cryptographically secure
												session capture and blockchain anchoring.
											</p>
										</CardBody>
									</Card>
								</div>
							</Tab>
						</Tabs>
					</ModalBody>
				</ModalContent>
			</Modal>

			{/* Reset Confirmation Modal */}
			<Modal
				isOpen={showResetConfirm}
				onClose={handleCancelReset}
				size="md"
				classNames={{
					base: "bg-background",
					header: "border-b border-divider",
					body: "py-4",
					footer: "border-t border-divider",
				}}
			>
				<ModalContent>
					<ModalHeader className="flex items-center space-x-3">
						<Settings className="w-5 h-5 text-warning" />
						<span className="text-lg font-semibold">Reset Applications</span>
					</ModalHeader>

					<ModalBody>
						<div className="space-y-4">
							<p className="text-foreground">
								Are you sure you want to reset to default applications?
							</p>

							<div className="bg-warning-50 dark:bg-warning-900/20 border border-warning-200 dark:border-warning-800 rounded-lg p-3">
								<p className="text-sm text-warning-700 dark:text-warning-300 font-medium mb-2">
									This will:
								</p>
								<ul className="text-sm text-warning-600 dark:text-warning-400 space-y-1 ml-4">
									<li>• Remove all custom applications</li>
									<li>• Reset to Chrome and Visual Studio Code only</li>
									<li>• Enable both default applications</li>
								</ul>
							</div>

							<p className="text-sm text-foreground-500">This action cannot be undone.</p>
						</div>
					</ModalBody>

					<ModalFooter>
						<Button variant="light" onPress={handleCancelReset}>
							Cancel
						</Button>
						<Button color="warning" onPress={handleConfirmReset}>
							Reset to Defaults
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
		</>
	);
};

export default SettingsModal;
