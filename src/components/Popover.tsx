import type React from "react";
import { useEffect, useRef, useState } from "react";

import DevModeSelector, { type AppMode } from "./DevModeSelector";
import LoggedInMode from "./modes/LoggedInMode";
import LoginMode from "./modes/LoginMode";
import OnboardingMode from "./modes/OnboardingMode";

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

  // Keyboard shortcut to toggle dev mode (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === "D") {
        event.preventDefault();
        setIsDevMode((prev) => {
          const newDevMode = !prev;
          localStorage.setItem("notari-dev-mode", newDevMode.toString());
          return newDevMode;
        });
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
        return <LoginMode onLogin={handleLogin} onSignUp={handleSignUp} />;
      case "onboarding":
        return (
          <OnboardingMode onComplete={handleOnboardingComplete} onBack={handleOnboardingBack} />
        );
      case "logged-in":
        return <LoggedInMode onLogout={handleLogout} onStartSession={handleStartSession} />;
      default:
        return <LoginMode onLogin={handleLogin} onSignUp={handleSignUp} />;
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
