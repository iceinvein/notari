import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import type React from "react";
import ThemeToggle from "./ThemeToggle";

export type AppMode = "login" | "onboarding" | "logged-in" | "record";

interface DevModeSelectorProps {
  currentMode: AppMode;
  onModeChange: (mode: AppMode) => void;
  onDisableDevMode: () => void;
}

const DevModeSelector: React.FC<DevModeSelectorProps> = ({
  currentMode,
  onModeChange,
  onDisableDevMode,
}) => {
  const modes: { key: AppMode; label: string; description: string; color: string }[] = [
    {
      key: "login",
      label: "Login Mode",
      description: "User needs to sign in",
      color: "bg-red-600",
    },
    {
      key: "onboarding",
      label: "Onboarding Mode",
      description: "First-time user setup",
      color: "bg-yellow-600",
    },
    {
      key: "logged-in",
      label: "Logged In Mode",
      description: "Authenticated user dashboard",
      color: "bg-green-600",
    },
    {
      key: "record",
      label: "Record Mode",
      description: "Local recording without login",
      color: "bg-purple-600",
    },
  ];

  return (
    <Card className="w-full h-full bg-transparent shadow-none border-none rounded-xl">
      <CardHeader className="pb-3 px-4 pt-6">
        <div className="flex flex-col w-full text-center">
          <h2 className="text-xl font-bold text-orange-400">🛠️ Dev Mode</h2>
          <p className="text-xs text-foreground-500 mt-1">Select app mode for testing</p>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="pt-6 px-4 pb-4">
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="text-xs text-foreground-500 text-center">
              Current Mode: <span className="text-foreground font-medium">{currentMode}</span>
            </div>

            <div className="space-y-2">
              {modes.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => onModeChange(mode.key)}
                  className={`w-full p-3 rounded-lg border transition-all duration-200 text-left ${
                    currentMode === mode.key
                      ? "border-primary bg-primary/20"
                      : "border-default-300 bg-content2 hover:bg-content3"
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${mode.color}`}></div>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-foreground">{mode.label}</div>
                      <div className="text-xs text-foreground-500">{mode.description}</div>
                    </div>
                    {currentMode === mode.key && (
                      <div className="text-primary">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                          aria-label="Selected"
                        >
                          <title>Selected</title>
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-foreground-600 mb-3">Theme</h3>
              <ThemeToggle variant="full" size="md" />
            </div>

            <Button
              color="danger"
              variant="bordered"
              size="sm"
              className="w-full"
              onPress={onDisableDevMode}
            >
              Disable Dev Mode
            </Button>

            <div className="text-xs text-foreground-500 text-center">
              Dev mode is enabled. Press Ctrl+Shift+D to toggle.
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default DevModeSelector;
