import { Button } from "@heroui/button";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Divider } from "@heroui/divider";
import { Progress } from "@heroui/progress";
import type React from "react";
import { useState } from "react";

interface OnboardingModeProps {
  onComplete: () => void;
  onBack: () => void;
}

const OnboardingMode: React.FC<OnboardingModeProps> = ({ onComplete, onBack }) => {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "Welcome to Notari",
      content: (
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">🛡️</span>
          </div>
          <p className="text-sm text-foreground-600 leading-relaxed">
            Notari provides tamper-evident proof-of-work verification through cryptographically
            secure session capture and blockchain anchoring.
          </p>
        </div>
      ),
    },
    {
      title: "How It Works",
      content: (
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-primary-foreground">1</span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground">Secure Capture</h4>
                <p className="text-xs text-foreground-500">
                  Record your work sessions with cryptographic integrity
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-primary-foreground">2</span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground">AI Analysis</h4>
                <p className="text-xs text-foreground-500">
                  Analyze content patterns and work authenticity
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs text-primary-foreground">3</span>
              </div>
              <div>
                <h4 className="text-sm font-medium text-foreground">Blockchain Proof</h4>
                <p className="text-xs text-foreground-500">
                  Immutable verification on the blockchain
                </p>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Ready to Start",
      content: (
        <div className="space-y-4 text-center">
          <div className="w-16 h-16 bg-success rounded-full flex items-center justify-center mx-auto">
            <span className="text-2xl">✅</span>
          </div>
          <p className="text-sm text-foreground-600 leading-relaxed">
            You're all set! Start creating verifiable proof of your work with Notari.
          </p>
        </div>
      ),
    },
  ];

  const currentStepData = steps[currentStep];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    } else {
      onBack();
    }
  };

  return (
    <Card className="w-full h-full bg-transparent shadow-none border-none rounded-xl">
      <CardHeader className="pb-3 px-4 pt-6">
        <div className="flex flex-col w-full text-center">
          <h2 className="text-2xl font-bold text-foreground">{currentStepData.title}</h2>
          <div className="mt-4 space-y-2">
            <Progress
              value={((currentStep + 1) / steps.length) * 100}
              color="primary"
              size="sm"
              classNames={{
                base: "w-full",
                track: "bg-default-200",
                indicator: "bg-primary",
              }}
            />
            <div className="text-xs text-foreground-500">
              Step {currentStep + 1} of {steps.length}
            </div>
          </div>
        </div>
      </CardHeader>
      <Divider />
      <CardBody className="pt-6 px-4 pb-4">
        <div className="space-y-6">
          <div className="min-h-[200px] flex items-center justify-center">
            {currentStepData.content}
          </div>

          <div className="flex space-x-3">
            <Button variant="bordered" size="lg" className="flex-1" onPress={handlePrevious}>
              {currentStep === 0 ? "Back" : "Previous"}
            </Button>
            <Button
              color="primary"
              size="lg"
              className="flex-1 font-medium transition-all duration-200"
              onPress={handleNext}
            >
              {currentStep === steps.length - 1 ? "Get Started" : "Next"}
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
};

export default OnboardingMode;
