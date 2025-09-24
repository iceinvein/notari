import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Chip,
  Progress,
  Select,
  SelectItem,
} from "@heroui/react";
import { useState } from "react";
import type { ProofPack, RedactionArea } from "../../types";
import { RedactionCanvas } from "./RedactionCanvas";
import { RedactionControls } from "./RedactionControls";
import { RedactionPreview } from "./RedactionPreview";

export function RedactionInterface() {
  const [selectedProofPack, setSelectedProofPack] = useState<ProofPack | null>(
    null,
  );
  const [redactionAreas, setRedactionAreas] = useState<RedactionArea[]>([]);
  const [currentTool, setCurrentTool] = useState<"select" | "redact">("select");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);

  // Mock proof packs for demonstration
  const mockProofPacks: ProofPack[] = [
    {
      id: "proof-pack-1",
      version: "1.0",
      metadata: {
        creator: "user-1",
        created: Date.now() - 86400000, // 1 day ago
        sessions: ["session-1", "session-2"],
        totalDuration: 7200000, // 2 hours
        title: "Research Paper Draft",
        description: "Working on academic research paper",
        tags: ["research", "academic", "writing"],
      },
      evidence: {
        sessions: [],
        aiAnalysis: [],
        timeline: [],
        systemContext: {
          operatingSystem: "macOS",
          platform: "darwin",
          deviceId: "device-123",
          timezone: "America/New_York",
          locale: "en-US",
          screenResolution: { width: 1920, height: 1080 },
        },
      },
      verification: {
        integrityHash: "hash-123",
        timestamp: Date.now(),
        version: "1.0",
      },
    },
  ];

  const handleProofPackSelect = (proofPackId: string) => {
    const proofPack = mockProofPacks.find((pp) => pp.id === proofPackId);
    setSelectedProofPack(proofPack || null);
    setRedactionAreas([]); // Reset redaction areas when switching proof packs
  };

  const handleAddRedactionArea = (area: RedactionArea) => {
    setRedactionAreas((prev) => [...prev, area]);
  };

  const handleRemoveRedactionArea = (areaId: string) => {
    setRedactionAreas((prev) => prev.filter((area) => area.id !== areaId));
  };

  const handleApplyRedactions = async () => {
    if (!selectedProofPack || redactionAreas.length === 0) return;

    setIsProcessing(true);
    setProcessingProgress(0);

    // Simulate redaction processing
    const steps = [
      "Analyzing redaction areas...",
      "Generating cryptographic commitments...",
      "Creating redacted proof pack...",
      "Verifying redaction integrity...",
      "Finalizing redacted version...",
    ];

    for (let i = 0; i < steps.length; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setProcessingProgress(((i + 1) / steps.length) * 100);
    }

    setIsProcessing(false);
    // In real app, this would create a new redacted proof pack
  };

  const getRedactionImpact = () => {
    if (redactionAreas.length === 0) return { level: "none", percentage: 0 };

    // Mock calculation based on redaction areas
    const totalArea = redactionAreas.reduce((sum, area) => {
      if (area.coordinates) {
        return sum + area.coordinates.width * area.coordinates.height;
      }
      return sum + 1000; // Default area for non-visual redactions
    }, 0);

    const percentage = Math.min(Math.round((totalArea / 100000) * 100), 100);

    let level: "low" | "medium" | "high";
    if (percentage < 20) level = "low";
    else if (percentage < 50) level = "medium";
    else level = "high";

    return { level, percentage };
  };

  const impact = getRedactionImpact();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Redaction Interface
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Selectively redact sensitive information while maintaining proof
          integrity
        </p>
      </div>

      {/* Proof Pack Selection */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Select Proof Pack</h3>
        </CardHeader>
        <CardBody>
          <Select
            label="Choose a proof pack to redact"
            placeholder="Select proof pack..."
            selectedKeys={selectedProofPack ? [selectedProofPack.id] : []}
            onSelectionChange={(keys) => {
              const selectedId = Array.from(keys)[0] as string;
              handleProofPackSelect(selectedId);
            }}
          >
            {mockProofPacks.map((proofPack) => (
              <SelectItem
                key={proofPack.id}
                textValue={proofPack.metadata.title || proofPack.id}
              >
                <div>
                  <div className="font-medium">
                    {proofPack.metadata.title ||
                      `Proof Pack ${proofPack.id.slice(-4)}`}
                  </div>
                  <div className="text-sm text-gray-500">
                    {proofPack.metadata.sessions.length} sessions • Created{" "}
                    {new Date(proofPack.metadata.created).toLocaleDateString()}
                  </div>
                </div>
              </SelectItem>
            ))}
          </Select>
        </CardBody>
      </Card>

      {selectedProofPack && (
        <>
          {/* Redaction Tools */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Canvas Area */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between w-full">
                    <h3 className="text-lg font-semibold">Content Preview</h3>
                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant={currentTool === "select" ? "solid" : "flat"}
                        color={currentTool === "select" ? "primary" : "default"}
                        onPress={() => setCurrentTool("select")}
                      >
                        Select
                      </Button>
                      <Button
                        size="sm"
                        variant={currentTool === "redact" ? "solid" : "flat"}
                        color={currentTool === "redact" ? "warning" : "default"}
                        onPress={() => setCurrentTool("redact")}
                      >
                        Redact
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardBody>
                  <RedactionCanvas
                    proofPack={selectedProofPack}
                    redactionAreas={redactionAreas}
                    currentTool={currentTool}
                    onAddRedactionArea={handleAddRedactionArea}
                  />
                </CardBody>
              </Card>
            </div>

            {/* Controls Panel */}
            <div className="space-y-4">
              <RedactionControls
                redactionAreas={redactionAreas}
                onRemoveArea={handleRemoveRedactionArea}
                onClearAll={() => setRedactionAreas([])}
              />

              {/* Redaction Impact */}
              <Card>
                <CardHeader>
                  <h4 className="font-semibold">Redaction Impact</h4>
                </CardHeader>
                <CardBody>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Content Redacted:</span>
                      <span className="font-medium">{impact.percentage}%</span>
                    </div>
                    <Progress
                      value={impact.percentage}
                      color={
                        impact.level === "low"
                          ? "success"
                          : impact.level === "medium"
                            ? "warning"
                            : "danger"
                      }
                      className="w-full"
                    />
                    <div className="flex items-center space-x-2">
                      <Chip
                        size="sm"
                        color={
                          impact.level === "low"
                            ? "success"
                            : impact.level === "medium"
                              ? "warning"
                              : "danger"
                        }
                        variant="flat"
                      >
                        {impact.level.toUpperCase()} IMPACT
                      </Chip>
                      <span className="text-xs text-gray-500">
                        {redactionAreas.length} area
                        {redactionAreas.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </CardBody>
              </Card>

              {/* Apply Redactions */}
              <Card>
                <CardBody>
                  <Button
                    color="primary"
                    className="w-full"
                    onPress={handleApplyRedactions}
                    isDisabled={redactionAreas.length === 0 || isProcessing}
                    isLoading={isProcessing}
                  >
                    {isProcessing ? "Processing..." : "Apply Redactions"}
                  </Button>
                  {isProcessing && (
                    <Progress
                      value={processingProgress}
                      color="primary"
                      className="w-full mt-2"
                      showValueLabel
                    />
                  )}
                </CardBody>
              </Card>
            </div>
          </div>

          {/* Redaction Preview */}
          {redactionAreas.length > 0 && (
            <RedactionPreview
              proofPack={selectedProofPack}
              redactionAreas={redactionAreas}
            />
          )}

          {/* Security Notice */}
          <Card className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <CardBody>
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 text-amber-500 mt-0.5">
                  <svg
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    role="img"
                    aria-label="Warning icon"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h4 className="font-medium text-amber-900 dark:text-amber-100">
                    Privacy & Verification Impact
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-200 mt-1">
                    Redacted areas will be cryptographically hidden but their
                    existence will be provable. High redaction levels may impact
                    the verifiability of your proof pack for some use cases.
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}
    </div>
  );
}
