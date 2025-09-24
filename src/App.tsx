import { useState } from "react";
import { MainLayout } from "./components/layout/MainLayout";
import { SessionManagement } from "./components/session/SessionManagement";
import { ProofPackWizard } from "./components/proofpack/ProofPackWizard";
import { RedactionInterface } from "./components/redaction/RedactionInterface";
import { VerificationResults } from "./components/verification/VerificationResults";

export type AppView = "sessions" | "proofpacks" | "redaction" | "verification";

function App() {
  const [currentView, setCurrentView] = useState<AppView>("sessions");

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

  return (
    <MainLayout currentView={currentView} onViewChange={setCurrentView}>
      {renderCurrentView()}
    </MainLayout>
  );
}

export default App;
