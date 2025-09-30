import { Monitor } from "lucide-react";
import { useWindowThumbnailQuery } from "../lib/tauri-queries";
import type { WindowInfo } from "../types/window";

type WindowThumbnailProps = {
	window: WindowInfo;
	className?: string;
	variant?: "small" | "card";
};

export default function WindowThumbnail({
	window,
	className = "",
	variant = "small",
}: WindowThumbnailProps) {
	// Fetch thumbnail using React Query
	const { data: fetchedThumbnail, isLoading } = useWindowThumbnailQuery(window.id);

	// Use fetched thumbnail, fallback to window.thumbnail, then to default
	const displayThumbnail = fetchedThumbnail || window.thumbnail;

	if (displayThumbnail) {
		if (variant === "card") {
			return (
				<div className={`w-full bg-black overflow-hidden relative ${className}`}>
					<img
						src={displayThumbnail}
						alt={`${window.title} thumbnail`}
						className="w-full h-auto block"
						onError={(e) => {
							// Hide broken images
							e.currentTarget.style.display = "none";
						}}
					/>
				</div>
			);
		}
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
						e.currentTarget.style.display = "none";
					}}
				/>
			</div>
		);
	}

	// Show loading state while fetching thumbnail
	if (isLoading) {
		if (variant === "card") {
			return (
				<div
					className={`w-full aspect-video bg-content2 flex items-center justify-center min-h-[120px] ${className}`}
				>
					<div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
				</div>
			);
		}
		return (
			<div
				className={`w-20 h-16 bg-content2 rounded-xl flex items-center justify-center border border-divider ${className}`}
			>
				<div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
			</div>
		);
	}

	// Default fallback for windows without thumbnails
	if (variant === "card") {
		return (
			<div
				className={`w-full aspect-video bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center min-h-[120px] ${className}`}
			>
				<Monitor className="w-6 h-6 text-primary/60" />
			</div>
		);
	}
	return (
		<div
			className={`w-20 h-16 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl flex items-center justify-center border border-primary/20 ${className}`}
		>
			<Monitor className="w-6 h-6 text-primary/60" />
		</div>
	);
}
