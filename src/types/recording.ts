// Recording system types for the frontend

export type VideoQuality = "High" | "Medium" | "Low";

export type RecordingPreferences = {
	save_directory?: string;
	filename_pattern: string;
	include_audio: boolean;
	video_quality: VideoQuality;
};

export type RecordingStatus =
	| "Idle"
	| "Preparing"
	| "Recording"
	| "Stopping"
	| "Processing"
	| "Completed"
	| "Failed"
	| { Error: string };

export type WindowMetadata = {
	title: string;
	app_name: string;
	app_bundle_id: string;
	width: number;
	height: number;
};

export type ActiveRecording = {
	session_id: string;
	window_id: string;
	start_time: string; // ISO 8601 timestamp
	output_path: string;
	status: RecordingStatus;
	preferences: RecordingPreferences;
	window_metadata?: WindowMetadata;
	recording_title?: string;
	recording_description?: string;
	recording_tags?: string[];
};

export type RecordingInfo = {
	session: ActiveRecording;
	duration_seconds: number;
	file_size_bytes?: number;
	estimated_final_size_bytes?: number;
};

export type RecordingSystemStatus = {
	has_active_recording: boolean;
	active_session?: ActiveRecording;
	preferences: RecordingPreferences;
	default_save_directory?: string;
};

// Default recording preferences
export const DEFAULT_RECORDING_PREFERENCES: RecordingPreferences = {
	filename_pattern: "notari_recording_{timestamp}",
	include_audio: false,
	video_quality: "High",
};

// Helper functions
export function isRecordingActive(status: RecordingStatus): boolean {
	return (
		status === "Preparing" ||
		status === "Recording" ||
		status === "Stopping" ||
		status === "Processing"
	);
}

export function isRecordingError(status: RecordingStatus): boolean {
	return status === "Failed" || (typeof status === "object" && "Error" in status);
}

export function getRecordingErrorMessage(status: RecordingStatus): string | null {
	if (status === "Failed") {
		return "Recording failed";
	}
	if (typeof status === "object" && "Error" in status) {
		return (status as { Error: string }).Error;
	}
	return null;
}

export function getRecordingStatusLabel(status: RecordingStatus): string {
	if (typeof status === "object" && "Error" in status) {
		return "Error";
	}
	return status;
}

export function getRecordingStatusColor(status: RecordingStatus): string {
	switch (status) {
		case "Idle":
			return "gray";
		case "Preparing":
			return "blue";
		case "Recording":
			return "red";
		case "Stopping":
			return "orange";
		case "Processing":
			return "purple";
		case "Completed":
			return "green";
		case "Failed":
			return "red";
		default:
			if (typeof status === "object" && "Error" in status) {
				return "red";
			}
			return "gray";
	}
}

export function formatRecordingDuration(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;

	if (hours > 0) {
		return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
	} else {
		return `${minutes}:${secs.toString().padStart(2, "0")}`;
	}
}

export function formatFileSize(bytes: number): string {
	const units = ["B", "KB", "MB", "GB"];
	let size = bytes;
	let unitIndex = 0;

	while (size >= 1024 && unitIndex < units.length - 1) {
		size /= 1024;
		unitIndex++;
	}

	return `${size.toFixed(1)} ${units[unitIndex]}`;
}
