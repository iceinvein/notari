import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Progress,
  Tab,
  Tabs,
} from "@heroui/react";
import { useState } from "react";
import type { ProofPack, WorkSession } from "../../types";
import { ProofPackConfiguration } from "./ProofPackConfiguration";
import { ProofPackExport } from "./ProofPackExport";
import { ProofPackPreview } from "./ProofPackPreview";
import { SessionSelection } from "./SessionSelection";

type WizardStep = "select" | "configure" | "preview" | "export";

export function ProofPackWizard() {
  const [currentStep, setCurrentStep] = useState<WizardStep>("select");
  const [selectedSessions, setSelectedSessions] = useState<WorkSession[]>([]);
  const [proofPackConfig, setProofPackConfig] = useState({
    title: "",
    description: "",
    tags: [] as string[],
    includeAIAnalysis: true,
    includeTimeline: true,
    compressionLevel: "medium" as "low" | "medium" | "high",
  });
  const [generatedProofPack, setGeneratedProofPack] =
    useState<ProofPack | null>(null);

  const steps = [
    {
      key: "select",
      title: "Select Sessions",
      description: "Choose work sessions to include",
    },
    {
      key: "configure",
      title: "Configure",
      description: "Set proof pack options",
    },
    {
      key: "preview",
      title: "Preview",
      description: "Review before generation",
    },
    {
      key: "export",
      title: "Export",
      description: "Generate and export proof pack",
    },
  ];

  const getCurrentStepIndex = () => {
    return steps.findIndex((step) => step.key === currentStep);
  };

  const getProgressValue = () => {
    return ((getCurrentStepIndex() + 1) / steps.length) * 100;
  };

  const canProceedToNext = () => {
    switch (currentStep) {
      case "select":
        return selectedSessions.length > 0;
      case "configure":
        return proofPackConfig.title.trim().length > 0;
      case "preview":
        return true;
      case "export":
        return false;
      default:
        return false;
    }
  };

  const handleNext = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1].key as WizardStep);
    }
  };

  const handlePrevious = () => {
    const currentIndex = getCurrentStepIndex();
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1].key as WizardStep);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "select":
        return (
          <SessionSelection
            selectedSessions={selectedSessions}
            onSelectionChange={setSelectedSessions}
          />
        );
      case "configure":
        return (
          <ProofPackConfiguration
            config={proofPackConfig}
            onConfigChange={setProofPackConfig}
            selectedSessions={selectedSessions}
          />
        );
      case "preview":
        return (
          <ProofPackPreview
            config={proofPackConfig}
            selectedSessions={selectedSessions}
            onGenerate={setGeneratedProofPack}
          />
        );
      case "export":
        return (
          <ProofPackExport
            proofPack={generatedProofPack}
            onComplete={() => {
              // Reset wizard
              setCurrentStep("select");
              setSelectedSessions([]);
              setProofPackConfig({
                title: "",
                description: "",
                tags: [],
                includeAIAnalysis: true,
                includeTimeline: true,
                compressionLevel: "medium",
              });
              setGeneratedProofPack(null);
            }}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Create Proof Pack
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Bundle your work sessions into a verifiable proof package
        </p>
      </div>

      {/* Progress Indicator */}
      <Card>
        <CardBody className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Step {getCurrentStepIndex() + 1} of {steps.length}:{" "}
                {steps[getCurrentStepIndex()].title}
              </h3>
              <span className="text-sm text-gray-500">
                {Math.round(getProgressValue())}% Complete
              </span>
            </div>
            <Progress
              value={getProgressValue()}
              color="primary"
              className="w-full"
            />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {steps[getCurrentStepIndex()].description}
            </p>
          </div>
        </CardBody>
      </Card>

      {/* Step Navigation */}
      <Card>
        <CardHeader>
          <Tabs
            selectedKey={currentStep}
            onSelectionChange={(key) => setCurrentStep(key as WizardStep)}
            variant="underlined"
            className="w-full"
          >
            {steps.map((step, index) => (
              <Tab
                key={step.key}
                title={
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index <= getCurrentStepIndex()
                          ? "bg-primary text-white"
                          : "bg-gray-200 text-gray-500"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span
                      className={
                        index <= getCurrentStepIndex()
                          ? "text-primary"
                          : "text-gray-500"
                      }
                    >
                      {step.title}
                    </span>
                  </div>
                }
                isDisabled={index > getCurrentStepIndex() + 1}
              />
            ))}
          </Tabs>
        </CardHeader>
      </Card>

      {/* Step Content */}
      <div className="min-h-[400px]">{renderCurrentStep()}</div>

      {/* Navigation Buttons */}
      <Card>
        <CardBody>
          <div className="flex items-center justify-between">
            <Button
              variant="flat"
              onPress={handlePrevious}
              isDisabled={getCurrentStepIndex() === 0}
            >
              Previous
            </Button>
            <div className="flex space-x-2">
              <Button
                variant="flat"
                onPress={() => {
                  // Reset wizard
                  setCurrentStep("select");
                  setSelectedSessions([]);
                  setGeneratedProofPack(null);
                }}
              >
                Start Over
              </Button>
              {getCurrentStepIndex() < steps.length - 1 && (
                <Button
                  color="primary"
                  onPress={handleNext}
                  isDisabled={!canProceedToNext()}
                >
                  Next
                </Button>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
