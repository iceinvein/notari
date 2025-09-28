import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { Divider } from "@heroui/divider";
import type React from "react";
import { useState } from "react";
import ThemeToggle from "../ThemeToggle";
import WindowPicker from "../WindowPicker";

interface WindowInfo {
  id: string;
  title: string;
  application: string;
  is_minimized: boolean;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  thumbnail?: string;
}

interface RecordModeProps {
  onStartRecording: () => void;
  onVerifyFile: () => void;
  onBackToLogin: () => void;
}

type RecordView = "main" | "window-picker";

const RecordMode: React.FC<RecordModeProps> = ({
  onStartRecording,
  onVerifyFile,
  onBackToLogin,
}) => {
  const [currentView, setCurrentView] = useState<RecordView>("main");
  const [_selectedWindow, setSelectedWindow] = useState<WindowInfo | null>(null);

  const handleStartRecording = () => {
    setCurrentView("window-picker");
  };

  const handleWindowSelect = (window: WindowInfo) => {
    setSelectedWindow(window);
    // TODO: Start actual recording with selected window
    onStartRecording();
    setCurrentView("main");
  };

  const handleBackToMain = () => {
    setCurrentView("main");
  };

  if (currentView === "window-picker") {
    return <WindowPicker onWindowSelect={handleWindowSelect} onBack={handleBackToMain} />;
  }
  return (
    <Card className="w-full h-full bg-transparent shadow-none border-none rounded-xl">
      <CardHeader className="pb-3 px-4 pt-6">
        <div className="flex flex-col w-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-lg">🛡️</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Notari</h2>
                <p className="text-xs text-foreground-500">Local Recording Mode</p>
              </div>
            </div>
            <Chip
              size="sm"
              color="secondary"
              variant="dot"
              classNames={{
                base: "bg-secondary/20 border-secondary/50",
                content: "text-secondary text-xs",
              }}
            >
              Offline
            </Chip>
          </div>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="pt-6 px-4 pb-4">
        <div className="space-y-6">
          {/* Main Actions */}
          <div className="space-y-4">
            <div className="text-center space-y-2">
              <h3 className="text-sm font-medium text-foreground">What would you like to do?</h3>
              <p className="text-xs text-foreground-500">
                Create tamper-evident proof of your work or verify existing files
              </p>
            </div>

            <div className="space-y-3">
              <Button
                color="primary"
                size="lg"
                className="w-full font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                onPress={handleStartRecording}
                startContent={
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white"></div>
                  </div>
                }
              >
                Start Recording Session
              </Button>

              <Button
                variant="bordered"
                size="lg"
                className="w-full font-medium transition-all duration-200 hover:scale-105 active:scale-95"
                onPress={onVerifyFile}
                startContent={<span className="text-lg">🔍</span>}
              >
                Verify Existing File
              </Button>
            </div>
          </div>

          {/* Info Section */}
          <div className="bg-content2 rounded-lg p-4 space-y-3">
            <h4 className="text-sm font-medium text-foreground">Local Mode Features</h4>
            <div className="space-y-2 text-xs text-foreground-500">
              <div className="flex items-start space-x-2">
                <span className="text-success">✓</span>
                <span>Record work sessions with cryptographic integrity</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-success">✓</span>
                <span>Generate tamper-evident proofs locally</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-success">✓</span>
                <span>Verify file authenticity and timestamps</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-warning">⚠</span>
                <span>Files stored locally only (not backed up online)</span>
              </div>
            </div>
          </div>

          {/* Theme Toggle */}
          <div>
            <ThemeToggle variant="full" size="md" />
          </div>

          {/* Footer Actions */}
          <div className="flex space-x-2">
            <Button variant="light" size="sm" className="flex-1 text-xs" onPress={onBackToLogin}>
              Back to Login
            </Button>
            <Button variant="light" size="sm" className="flex-1 text-xs">
              Settings
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default RecordMode;
