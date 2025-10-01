import { Button } from "@heroui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@heroui/popover";
import { Slider } from "@heroui/slider";
import { Spinner } from "@heroui/spinner";
import { invoke } from "@tauri-apps/api/core";
import {
	Maximize,
	Minimize,
	Pause,
	Play,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { logger } from "../utils/logger";
import AppHeader from "./AppHeader";

type VideoPlayerProps = {
	recordingPath: string;
	password: string;
	onClose: () => void;
	onSettings?: () => void;
};

export function VideoPlayer({
	recordingPath,
	password,
	onClose,
	onSettings,
}: VideoPlayerProps) {
	const videoRef = useRef<HTMLVideoElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [videoUrl, setVideoUrl] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// Playback state
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const [volume, setVolume] = useState(1);
	const [isMuted, setIsMuted] = useState(false);
	const [isFullscreen, setIsFullscreen] = useState(false);

	// UI state
	const [showControls, setShowControls] = useState(true);
	const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);

	useEffect(() => {
		let mounted = true;
		let streamId: string | null = null;
		let blobUrl: string | null = null;

		const startPlayback = async () => {
			try {
				setIsLoading(true);
				setError(null);

				logger.info("VideoPlayer", `Starting video playback for: ${recordingPath}`);

				// Get stream ID
				const url = await invoke<string>("start_video_playback", {
					recordingPath,
					password,
				});

				if (!mounted) return;

				// Extract stream ID from URL
				streamId = url.split("/").pop() || null;
				logger.info("VideoPlayer", `Got stream ID: ${streamId}`);

				if (!streamId) {
					throw new Error("Failed to get stream ID");
				}

				// Get video metadata
				const [fileSize, isEncrypted] = await invoke<[number, boolean]>("get_video_metadata", {
					streamId,
				});

				logger.info("VideoPlayer", `Video metadata: size=${fileSize}, encrypted=${isEncrypted}`);

				// Create blob URL by fetching the entire video via chunks
				const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
				const chunks: Uint8Array[] = [];
				let offset = 0;

				while (offset < fileSize) {
					const end = Math.min(offset + CHUNK_SIZE - 1, fileSize - 1);

					logger.info("VideoPlayer", `Fetching chunk: ${offset}-${end}`);

					const chunk = await invoke<number[]>("get_video_chunk", {
						streamId,
						start: offset,
						end,
					});

					if (!mounted) return;

					chunks.push(new Uint8Array(chunk));
					offset = end + 1;
				}

				logger.info("VideoPlayer", `Fetched ${chunks.length} chunks, creating blob...`);

				// Create blob from chunks
				const blob = new Blob(chunks as BlobPart[], { type: "video/mp4" });
				blobUrl = URL.createObjectURL(blob);

				logger.info("VideoPlayer", `Created blob URL: ${blobUrl}`);

				setVideoUrl(blobUrl);
				setIsLoading(false);
			} catch (err) {
				if (!mounted) return;

				logger.error(
					"VideoPlayer",
					"Failed to start playback",
					err instanceof Error ? err : undefined
				);
				setError(err instanceof Error ? err.message : String(err));
				setIsLoading(false);
			}
		};

		startPlayback();

		return () => {
			mounted = false;
			// Cleanup stream
			if (streamId) {
				logger.info("VideoPlayer", `Cleaning up stream: ${streamId}`);
				invoke("stop_video_playback", { streamId }).catch((err) => {
					logger.error(
						"VideoPlayer",
						"Failed to stop playback",
						err instanceof Error ? err : undefined
					);
				});
			}
			// Revoke blob URL using local ref, not state
			if (blobUrl?.startsWith("blob:")) {
				URL.revokeObjectURL(blobUrl);
			}
		};
	}, [recordingPath, password]);

	// Handle fullscreen changes
	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement);
		};

		document.addEventListener("fullscreenchange", handleFullscreenChange);
		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
		};
	}, []);

	// Auto-hide controls in fullscreen
	useEffect(() => {
		if (!isFullscreen) {
			setShowControls(true);
			return;
		}

		const handleMouseMove = () => {
			setShowControls(true);

			if (controlsTimeout) {
				clearTimeout(controlsTimeout);
			}

			const timeout = setTimeout(() => {
				if (isPlaying) {
					setShowControls(false);
				}
			}, 3000);

			setControlsTimeout(timeout);
		};

		document.addEventListener("mousemove", handleMouseMove);
		return () => {
			document.removeEventListener("mousemove", handleMouseMove);
			if (controlsTimeout) {
				clearTimeout(controlsTimeout);
			}
		};
	}, [isFullscreen, isPlaying, controlsTimeout]);

	const togglePlay = useCallback(() => {
		if (!videoRef.current) return;

		if (isPlaying) {
			videoRef.current.pause();
			return
		}

		videoRef.current.play();
	}, [isPlaying]);

	const toggleMute = useCallback(() => {
		if (!videoRef.current) return;
		videoRef.current.muted = !isMuted;
		setIsMuted(!isMuted);
	}, [isMuted]);

	const handleVolumeChange = useCallback(
		(value: number | number[]) => {
			const vol = Array.isArray(value) ? value[0] : value;
			if (videoRef.current) {
				videoRef.current.volume = vol;
				setVolume(vol);
				if (vol === 0) {
					setIsMuted(true);
				} else if (isMuted) {
					setIsMuted(false);
				}
			}
		},
		[isMuted]
	);

	const handleSeek = useCallback((value: number | number[]) => {
		const time = Array.isArray(value) ? value[0] : value;
		if (videoRef.current) {
			videoRef.current.currentTime = time;
			setCurrentTime(time);
		}
	}, []);

	const toggleFullscreen = useCallback(() => {
		if (!containerRef.current) return;

		if (document.fullscreenElement) {
			document.exitFullscreen();
		} else {
			containerRef.current.requestFullscreen();
		}
	}, []);

	const formatTime = (seconds: number) => {
		const hours = Math.floor(seconds / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);

		if (hours > 0) {
			return `${hours}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
		}
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	const handleMouseEnter = useCallback(() => {
		setShowControls(true);
	}, []);

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyPress = (e: KeyboardEvent) => {
			if (!videoRef.current) return;

			switch (e.key) {
				case " ":
				case "k":
					e.preventDefault();
					togglePlay();
					break;
				case "f":
					e.preventDefault();
					toggleFullscreen();
					break;
				case "m":
					e.preventDefault();
					toggleMute();
					break;
				case "ArrowUp":
					e.preventDefault();
					handleVolumeChange(Math.min(1, volume + 0.1));
					break;
				case "ArrowDown":
					e.preventDefault();
					handleVolumeChange(Math.max(0, volume - 0.1));
					break;
			}
		};

		window.addEventListener("keydown", handleKeyPress);
		return () => window.removeEventListener("keydown", handleKeyPress);
	}, [volume, togglePlay, toggleFullscreen, toggleMute, handleVolumeChange]);

	if (error) {
		return (
			<div className="flex flex-col items-center justify-center h-full p-8 bg-black">
				<div className="text-center max-w-md">
					<p className="text-danger text-lg mb-4">Failed to load video</p>
					<p className="text-default-500 mb-6">{error}</p>
					<Button color="primary" onPress={onClose}>
						Close
					</Button>
				</div>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="flex flex-col items-center justify-center h-full bg-black">
				<Spinner size="lg" color="primary" />
				<p className="text-white mt-4">Loading video...</p>
			</div>
		);
	}

	return (
		<div
			ref={containerRef}
			className="relative flex flex-col h-full bg-black"
			onMouseEnter={handleMouseEnter}
			role="application"
			aria-label="Video player"
		>
			{/* Header - Always visible */}
			<div className="absolute top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/90 to-transparent p-4">
				<AppHeader
					title="Video Player"
					subtitle={recordingPath.split("/").pop() || "Recording"}
					showBackButton={true}
					onBack={onClose}
					showSettingsButton={!!onSettings}
					onSettings={onSettings}
				/>
			</div>

			{/* Video */}
			<div className="flex-1 flex items-center justify-center">
				<video
					ref={videoRef}
					src={videoUrl || undefined}
					className="max-w-full max-h-full"
					onPlay={() => setIsPlaying(true)}
					onPause={() => setIsPlaying(false)}
					onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
					onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
					onEnded={() => setIsPlaying(false)}
					onError={(e) => {
						const videoError = e.currentTarget.error;
						const errorCode = videoError?.code;
						const errorMessage = videoError?.message || "Unknown error";

						// Map error codes to readable messages
						const errorMessages: Record<number, string> = {
							1: "MEDIA_ERR_ABORTED - Video loading was aborted",
							2: "MEDIA_ERR_NETWORK - Network error while loading video",
							3: "MEDIA_ERR_DECODE - Video decoding failed (codec issue)",
							4: "MEDIA_ERR_SRC_NOT_SUPPORTED - Video format not supported",
						};

						const readableError = errorCode ? errorMessages[errorCode] || `Error code ${errorCode}` : "Unknown error";

						logger.error(
							"VideoPlayer",
							`Video element error: ${readableError} - ${errorMessage}`,
							videoError ? new Error(`${errorCode}: ${errorMessage}`) : undefined,
							{ url: videoUrl, errorCode, errorMessage },
						);
						setError(readableError);
					}}
				>
					{/* Screen recordings don't have captions */}
					<track kind="captions" />
				</video>
			</div>

			{/* Controls Overlay */}
			<div
				className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 ${
					showControls ? "opacity-100" : "opacity-0"
				}`}
			>
				<div className="p-4 space-y-2">
					{/* Progress bar */}
					<Slider
						size="sm"
						value={currentTime}
						maxValue={duration}
						step={0.01}
						onChange={handleSeek}
						className="w-full"
						aria-label="Video progress"
					/>

					{/* Controls */}
					<div className="flex items-center gap-2">
						{/* Play/Pause */}
						<Button
							isIconOnly
							size="sm"
							variant="light"
							onPress={togglePlay}
							className="text-white"
							aria-label={isPlaying ? "Pause" : "Play"}
						>
							{isPlaying ? <Pause size={20} /> : <Play size={20} />}
						</Button>

						{/* Time */}
						<div className="text-sm text-white font-mono whitespace-nowrap min-w-[100px] text-center">
							{formatTime(currentTime)} / {formatTime(duration)}
						</div>

						<div className="flex-1" />

						{/* Volume with Popover */}
						<Popover placement="top">
							<PopoverTrigger>
								<Button
									isIconOnly
									size="sm"
									variant="light"
									className="text-white"
									aria-label="Volume"
								>
									{isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="p-2">
								<div className="flex flex-col items-center gap-2 h-32">
									<Slider
										size="sm"
										value={volume}
										maxValue={1}
										step={0.01}
										onChange={handleVolumeChange}
										orientation="vertical"
										className="h-full"
										aria-label="Volume level"
									/>
									<Button
										isIconOnly
										size="sm"
										variant="light"
										onPress={toggleMute}
										aria-label={isMuted ? "Unmute" : "Mute"}
									>
										{isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
									</Button>
								</div>
							</PopoverContent>
						</Popover>

						{/* Fullscreen */}
						<Button
							isIconOnly
							size="sm"
							variant="light"
							onPress={toggleFullscreen}
							className="text-white"
							aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
						>
							{isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
