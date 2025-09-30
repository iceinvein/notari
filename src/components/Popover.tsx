import { useEffect, useRef, useState } from "react";
import LoggedInMode from "./modes/LoggedInMode";
import LoginMode from "./modes/LoginMode";
import OnboardingMode from "./modes/OnboardingMode";
import RecordMode from "./modes/RecordMode";

export type AppMode = "login" | "onboarding" | "logged-in" | "record";

export default function Popover() {
	const containerRef = useRef<HTMLDivElement>(null);

	// App mode state
	const [currentMode, setCurrentMode] = useState<AppMode>(() => {
		const savedMode = localStorage.getItem("notari-current-mode") as AppMode;
		return savedMode || "login";
	});

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

	// Render the appropriate mode
	const renderCurrentMode = () => {
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
				return <RecordMode onStartRecording={handleStartRecording} />;
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
}
