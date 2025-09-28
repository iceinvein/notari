import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { FolderOpen, RotateCcw, Save } from "lucide-react";
import { useEffect, useState } from "react";
import {
	useGetDefaultSaveDirectoryQuery,
	useRecordingPreferencesQuery,
	useSelectSaveDirectoryMutation,
	useUpdateRecordingPreferencesMutation,
} from "../hooks/useRecordingSystem";
import type {
	RecordingPreferences as RecordingPreferencesType,
	VideoQuality,
} from "../types/recording";
import { DEFAULT_RECORDING_PREFERENCES } from "../types/recording";
import { recordingLogger } from "../utils/logger";

type RecordingPreferencesProps = {
	className?: string;
};

const VIDEO_QUALITY_OPTIONS: { key: VideoQuality; label: string; description: string }[] = [
	{ key: "High", label: "High Quality", description: "Best quality, larger file size" },
	{ key: "Medium", label: "Medium Quality", description: "Balanced quality and file size" },
	{ key: "Low", label: "Low Quality", description: "Smaller file size, lower quality" },
];

export default function RecordingPreferences({ className = "" }: RecordingPreferencesProps) {
	const { data: preferences, isLoading } = useRecordingPreferencesQuery();
	const { data: defaultSaveDirectory } = useGetDefaultSaveDirectoryQuery();
	const updatePreferencesMutation = useUpdateRecordingPreferencesMutation();
	const selectDirectoryMutation = useSelectSaveDirectoryMutation();

	const [localPreferences, setLocalPreferences] = useState<RecordingPreferencesType>(
		DEFAULT_RECORDING_PREFERENCES
	);
	const [hasChanges, setHasChanges] = useState(false);

	// Update local state when preferences are loaded
	useEffect(() => {
		if (preferences) {
			setLocalPreferences(preferences);
			setHasChanges(false);
		}
	}, [preferences]);

	const handlePreferenceChange = <K extends keyof RecordingPreferencesType>(
		key: K,
		value: RecordingPreferencesType[K]
	) => {
		setLocalPreferences((prev) => ({
			...prev,
			[key]: value,
		}));
		setHasChanges(true);
	};

	const handleSave = async () => {
		try {
			await updatePreferencesMutation.mutateAsync(localPreferences);
			setHasChanges(false);
		} catch (error) {
			console.error("Failed to save preferences:", error);
		}
	};

	const handleReset = () => {
		setLocalPreferences(preferences || DEFAULT_RECORDING_PREFERENCES);
		setHasChanges(false);
	};

	const handleSelectDirectory = async () => {
		// Prevent multiple simultaneous calls
		if (selectDirectoryMutation.isPending) {
			return;
		}

		// Add logging to track frontend execution
		recordingLogger.info("handleSelectDirectory called");

		try {
			recordingLogger.info("About to call selectDirectoryMutation.mutateAsync()");
			const selectedPath = await selectDirectoryMutation.mutateAsync();
			recordingLogger.info("selectDirectoryMutation completed with result", { selectedPath });
			if (selectedPath) {
				handlePreferenceChange("save_directory", selectedPath);
			}
		} catch (error) {
			recordingLogger.error(
				"selectDirectoryMutation failed",
				error instanceof Error ? error : new Error(String(error))
			);
			// Reset the mutation state to clear any pending state
			selectDirectoryMutation.reset();
		}
	};

	const handleUseDefaultDirectory = () => {
		handlePreferenceChange("save_directory", undefined);
	};

	if (isLoading) {
		return (
			<Card className={className}>
				<CardBody className="p-6">
					<div className="flex items-center justify-center h-32">
						<div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
					</div>
				</CardBody>
			</Card>
		);
	}

	const currentSaveDirectory = localPreferences.save_directory || defaultSaveDirectory || "Default";

	return (
		<Card className={className}>
			<CardHeader className="pb-3">
				<h3 className="text-lg font-semibold">Recording Preferences</h3>
			</CardHeader>
			<CardBody className="space-y-6">
				{/* File Settings */}
				<div className="space-y-4">
					<h4 className="text-md font-medium text-foreground-700">File Settings</h4>

					<div className="space-y-2">
						<span className="text-sm font-medium text-foreground-600">Save Directory</span>
						<div className="flex items-center space-x-2">
							<Input
								value={currentSaveDirectory}
								readOnly
								placeholder="Default save directory"
								className="flex-1"
							/>
							<Button
								variant="flat"
								size="sm"
								onPress={handleSelectDirectory}
								isLoading={selectDirectoryMutation.isPending}
								startContent={<FolderOpen className="w-4 h-4" />}
							>
								Browse
							</Button>
							{localPreferences.save_directory && (
								<Button variant="light" size="sm" onPress={handleUseDefaultDirectory}>
									Use Default
								</Button>
							)}
						</div>
						<p className="text-xs text-foreground-500">
							Choose where to save your recordings. Leave empty to use the default location.
						</p>
					</div>

					<div className="space-y-2">
						<Input
							label="Filename Pattern"
							value={localPreferences.filename_pattern}
							onChange={(e) => handlePreferenceChange("filename_pattern", e.target.value)}
							placeholder="notari_recording_{timestamp}"
						/>
						<p className="text-xs text-foreground-500">
							Use {"{timestamp}"} as a placeholder for the current date and time.
						</p>
					</div>
				</div>

				<Divider />

				{/* Recording Settings */}
				<div className="space-y-4">
					<h4 className="text-md font-medium text-foreground-700">Recording Settings</h4>

					<div className="space-y-2">
						<Select
							label="Video Quality"
							placeholder="Select video quality"
							selectionMode="single"
							selectedKeys={localPreferences.video_quality ? [localPreferences.video_quality] : []}
							onSelectionChange={(keys) => {
								const selectedKey = Array.from(keys)[0] as VideoQuality;
								handlePreferenceChange("video_quality", selectedKey);
							}}
						>
							{VIDEO_QUALITY_OPTIONS.map((option) => (
								<SelectItem key={option.key} textValue={option.label}>
									<div className="flex flex-col">
										<span className="font-medium">{option.label}</span>
										<span className="text-xs text-foreground-500">{option.description}</span>
									</div>
								</SelectItem>
							))}
						</Select>
					</div>

					<div className="flex items-center justify-between">
						<div className="space-y-1">
							<p className="text-sm font-medium text-foreground-600">Include System Audio</p>
							<p className="text-xs text-foreground-500">
								Record system audio along with the video (experimental)
							</p>
						</div>
						<Switch
							isSelected={localPreferences.include_audio}
							onValueChange={(checked) => handlePreferenceChange("include_audio", checked)}
						/>
					</div>
				</div>

				<Divider />

				{/* Action Buttons */}
				<div className="flex items-center justify-between">
					<Button
						variant="flat"
						onPress={handleReset}
						isDisabled={!hasChanges}
						startContent={<RotateCcw className="w-4 h-4" />}
					>
						Reset
					</Button>

					<div className="flex items-center space-x-2">
						<Button
							color="primary"
							onPress={handleSave}
							isLoading={updatePreferencesMutation.isPending}
							isDisabled={!hasChanges}
							startContent={<Save className="w-4 h-4" />}
						>
							Save Changes
						</Button>
					</div>
				</div>
			</CardBody>
		</Card>
	);
}
