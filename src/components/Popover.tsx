import type React from "react";
import { useEffect, useRef, useState } from "react";
import DevMode from "./DevMode";
import DevModeSelector, { type AppMode } from "./DevModeSelector";
import LoggedInMode from "./modes/LoggedInMode";
import LoginMode from "./modes/LoginMode";
import OnboardingMode from "./modes/OnboardingMode";
import RecordMode from "./modes/RecordMode";

const Popover: React.FC = () => {
	const containerRef = useRef<HTMLDivElement>(null);
	// Dev mode state
	const [isDevMode, setIsDevMode] = useState(() => {
		// Check if dev mode is enabled via localStorage or environment
		return localStorage.getItem("notari-dev-mode") === "true" || import.meta.env.DEV;
	});

	// App mode state
	const [currentMode, setCurrentMode] = useState<AppMode>(() => {
		const savedMode = localStorage.getItem("notari-current-mode") as AppMode;
		return savedMode || "login";
	});

	// Keyboard shortcuts
	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			// Ctrl+Shift+D: Toggle dev mode
			if (event.ctrlKey && event.shiftKey && event.key === "D") {
				event.preventDefault();
				setIsDevMode((prev) => {
					const newDevMode = !prev;
					localStorage.setItem("notari-dev-mode", newDevMode.toString());
					return newDevMode;
				});
			}
			// Ctrl+Shift+L: Go to dev logs (even in production)
			else if (event.ctrlKey && event.shiftKey && event.key === "L") {
				event.preventDefault();
				setCurrentMode("dev-logs");
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, []);

	// Focus management
	useEffect(() => {
		if (containerRef.current) {
			containerRef.current.focus();
		}
	}, []);

	// Save current mode to localStorage
	useEffect(() => {
		localStorage.setItem("notari-current-mode", currentMode);
	}, [currentMode]);

	// Mode change handlers
	const handleModeChange = (mode: AppMode) => {
		setCurrentMode(mode);
	};

	const handleDisableDevMode = () => {
		setIsDevMode(false);
		localStorage.setItem("notari-dev-mode", "false");
	};

	// App flow handlers
	const handleLogin = () => {
		setCurrentMode("logged-in");
	};

	const handleSignUp = () => {
		setCurrentMode("onboarding");
	};

	const handleOnboardingComplete = () => {
		setCurrentMode("logged-in");
	};

	const handleOnboardingBack = () => {
		setCurrentMode("login");
	};

	const handleLogout = () => {
		setCurrentMode("login");
	};

	const handleStartSession = () => {
		// TODO: Implement session start logic
		// console.log("Starting new session...");
	};

	const handleRecordOnly = () => {
		setCurrentMode("record");
	};

	const handleStartRecording = () => {
		// TODO: Implement recording start logic
		// console.log("Starting recording session...");
	};

	const handleVerifyFile = () => {
		// TODO: Implement file verification logic
		// console.log("Verifying file...");
	};

	const handleBackToLogin = () => {
		setCurrentMode("login");
	};

	// Render the appropriate mode
	const renderCurrentMode = () => {
		if (isDevMode) {
			return (
				<DevModeSelector
					currentMode={currentMode}
					onModeChange={handleModeChange}
					onDisableDevMode={handleDisableDevMode}
				/>
			);
		}

		switch (currentMode) {
			case "login":
				return (
					<LoginMode
						onLogin={handleLogin}
						onSignUp={handleSignUp}
						onRecordOnly={handleRecordOnly}
					/>
				);
			case "onboarding":
				return (
					<OnboardingMode onComplete={handleOnboardingComplete} onBack={handleOnboardingBack} />
				);
			case "logged-in":
				return <LoggedInMode onLogout={handleLogout} onStartSession={handleStartSession} />;
			case "record":
				return (
					<RecordMode
						onStartRecording={handleStartRecording}
						onVerifyFile={handleVerifyFile}
						onBackToLogin={handleBackToLogin}
					/>
				);
			case "dev-logs":
				return <DevMode onBack={() => setCurrentMode("login")} />;
			default:
				return (
					<LoginMode
						onLogin={handleLogin}
						onSignUp={handleSignUp}
						onRecordOnly={handleRecordOnly}
					/>
				);
		}
	};

	return (
		<div
			ref={containerRef}
			className="w-full h-full outline-none animate-in fade-in-0 slide-in-from-top-2 duration-200 rounded-xl overflow-hidden bg-background/95 backdrop-blur-md shadow-2xl border border-divider"
			tabIndex={-1}
		>
			{renderCurrentMode()}
		</div>
	);
};

export default Popover;
