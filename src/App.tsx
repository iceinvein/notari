import { useState } from "react";
import { AdaptiveLayout } from "./components/layout/AdaptiveLayout";
import { ProofPackWizard } from "./components/proofpack/ProofPackWizard";
import { RedactionInterface } from "./components/redaction/RedactionInterface";
import { SessionManagement } from "./components/session/SessionManagement";
import { VerificationResults } from "./components/verification/VerificationResults";
import { useAppMode } from "./contexts/AppModeContext";

export type AppView = "sessions" | "proofpacks" | "redaction" | "verification";

function App() {
  const [currentView, setCurrentView] = useState<AppView>("sessions");
  const { isTrayMode } = useAppMode();

  const renderCurrentView = () => {
    switch (currentView) {
      case "sessions":
        return <SessionManagement />;
      case "proofpacks":
        return <ProofPackWizard />;
      case "redaction":
        return <RedactionInterface />;
      case "verification":
        return <VerificationResults />;
      default:
        return <SessionManagement />;
    }
  };

  // In tray mode, show a simplified interface with option to open full app
  if (isTrayMode) {
    return (
      <AdaptiveLayout title="Notari" showNavigation={false}>
        <div className="p-4 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            This is the compact tray interface. For full functionality, open the
            main application.
          </p>
          <button
            onClick={async () => {
              const { invoke } = await import("@tauri-apps/api/core");
              await invoke("show_main_window");
            }}
            className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 transition-colors"
          >
            Open Full App
          </button>
        </div>
      </AdaptiveLayout>
    );
  }

  return (
    <AdaptiveLayout currentView={currentView} onViewChange={setCurrentView}>
      {renderCurrentView()}
    </AdaptiveLayout>
  );
}

export default App;
