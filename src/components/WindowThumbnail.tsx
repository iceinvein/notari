import { Monitor } from "lucide-react";
import type React from "react";
import { useWindowThumbnailQuery } from "../lib/tauri-queries";
import type { WindowInfo } from "../types/window";

interface WindowThumbnailProps {
	window: WindowInfo;
	className?: string;
}

const WindowThumbnail: React.FC<WindowThumbnailProps> = ({ window, className = "" }) => {
	// Fetch thumbnail using React Query
	const { data: fetchedThumbnail, isLoading } = useWindowThumbnailQuery(window.id);

	// Use fetched thumbnail, fallback to window.thumbnail, then to default
	const displayThumbnail = fetchedThumbnail || window.thumbnail;

	if (displayThumbnail) {
		return (
			<div
				className={`w-20 h-16 bg-content2 rounded-xl overflow-hidden border border-divider ${className}`}
			>
				<img
					src={displayThumbnail}
					alt={`${window.title} thumbnail`}
					className="w-full h-full object-cover"
					onError={(e) => {
						// Hide broken images
						e.currentTarget.style.display = 'none';
					}}
				/>
			</div>
		);
	}

	// Show loading state while fetching thumbnail
	if (isLoading) {
		return (
			<div
				className={`w-20 h-16 bg-content2 rounded-xl flex items-center justify-center border border-divider ${className}`}
			>
				<div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
			</div>
		);
	}

	// Default fallback for windows without thumbnails
	return (
		<div
			className={`w-20 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center border border-primary/20 ${className}`}
		>
			<Monitor className="w-6 h-6 text-primary/60" />
		</div>
	);
};

export default WindowThumbnail;
