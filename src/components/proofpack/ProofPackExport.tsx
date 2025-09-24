import { useState } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Chip,
  Progress,
  Divider,
  ButtonGroup,
} from "@heroui/react";
import type { ProofPack } from "../../types";

interface ProofPackExportProps {
  proofPack: ProofPack | null;
  onComplete: () => void;
}

export function ProofPackExport({ proofPack, onComplete }: ProofPackExportProps) {
  const [exportFormat, setExportFormat] = useState<"json" | "pdf">("json");
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [isAnchoring, setIsAnchoring] = useState(false);
  const [anchorProgress, setAnchorProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  if (!proofPack) {
    return (
      <Card>
        <CardBody className="text-center py-12">
          <div className="text-gray-500 dark:text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p>No proof pack generated yet</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (milliseconds: number) => {
    const minutes = Math.floor(milliseconds / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  const simulateExport = async () => {
    setIsExporting(true);
    setExportProgress(0);

    // Simulate export progress
    for (let i = 0; i <= 100; i += 10) {
      setExportProgress(i);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsExporting(false);
  };

  const simulateBlockchainAnchor = async () => {
    setIsAnchoring(true);
    setAnchorProgress(0);

    const steps = [
      "Connecting to blockchain network...",
      "Generating Merkle proof...",
      "Submitting transaction...",
      "Waiting for confirmation...",
      "Anchor complete!"
    ];

    for (let i = 0; i < steps.length; i++) {
      setAnchorProgress((i + 1) / steps.length * 100);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    setIsAnchoring(false);
    setIsComplete(true);
  };

  const handleExportAndAnchor = async () => {
    await simulateExport();
    await simulateBlockchainAnchor();
  };

  if (isComplete) {
    return (
      <Card className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
        <CardBody className="text-center py-12">
          <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-green-900 dark:text-green-100 mb-2">
            Proof Pack Complete!
          </h3>
          <p className="text-green-700 dark:text-green-200 mb-6">
            Your proof pack has been successfully generated and anchored on the blockchain.
          </p>
          
          <div className="space-y-4 max-w-md mx-auto">
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
              <div className="text-sm text-gray-600 dark:text-gray-400">Blockchain Transaction ID</div>
              <div className="font-mono text-sm break-all">0x1234...abcd</div>
            </div>
            
            <div className="flex space-x-2">
              <Button
                color="primary"
                className="flex-1"
                onPress={() => {
                  // In real app, this would download the file
                  console.log("Downloading proof pack...");
                }}
              >
                Download Proof Pack
              </Button>
              <Button
                variant="flat"
                className="flex-1"
                onPress={() => {
                  // In real app, this would copy verification URL
                  navigator.clipboard.writeText("https://verify.notari.com/proof-pack-123");
                }}
              >
                Copy Verification URL
              </Button>
            </div>
            
            <Button
              variant="flat"
              onPress={onComplete}
              className="w-full"
            >
              Create Another Proof Pack
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Proof Pack Summary */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Generated Proof Pack</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div>
              <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                {proofPack.metadata.title}
              </h4>
              {proofPack.metadata.description && (
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {proofPack.metadata.description}
                </p>
              )}
            </div>

            {proofPack.metadata.tags && proofPack.metadata.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {proofPack.metadata.tags.map((tag) => (
                  <Chip key={tag} variant="flat" color="primary" size="sm">
                    {tag}
                  </Chip>
                ))}
              </div>
            )}

            <Divider />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">ID:</span>
                <div className="font-mono text-xs">{proofPack.id.slice(-8)}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Sessions:</span>
                <div className="text-lg font-bold">{proofPack.metadata.sessions.length}</div>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Duration:</span>
                <div className="text-lg font-bold">
                  {formatDuration(proofPack.metadata.totalDuration)}
                </div>
              </div>
              <div>
                <span className="font-medium text-gray-700 dark:text-gray-300">Created:</span>
                <div className="text-sm">{formatDate(proofPack.metadata.created)}</div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Export Options</h3>
        </CardHeader>
        <CardBody>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Export Format</label>
              <ButtonGroup>
                <Button
                  variant={exportFormat === "json" ? "solid" : "flat"}
                  color={exportFormat === "json" ? "primary" : "default"}
                  onPress={() => setExportFormat("json")}
                >
                  JSON (Technical)
                </Button>
                <Button
                  variant={exportFormat === "pdf" ? "solid" : "flat"}
                  color={exportFormat === "pdf" ? "primary" : "default"}
                  onPress={() => setExportFormat("pdf")}
                >
                  PDF (Human-Readable)
                </Button>
              </ButtonGroup>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-medium mb-2">
                {exportFormat === "json" ? "JSON Format" : "PDF Format"}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {exportFormat === "json" 
                  ? "Machine-readable format suitable for programmatic verification and integration with other systems."
                  : "Human-readable format with visual timeline, charts, and formatted content suitable for sharing with non-technical stakeholders."
                }
              </p>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Export Progress */}
      {(isExporting || isAnchoring) && (
        <Card>
          <CardBody className="text-center py-8">
            <div className="space-y-4">
              {isExporting && (
                <div>
                  <h4 className="font-semibold mb-2">Exporting Proof Pack...</h4>
                  <Progress
                    value={exportProgress}
                    color="primary"
                    className="w-full max-w-md mx-auto"
                    showValueLabel
                  />
                </div>
              )}
              
              {isAnchoring && (
                <div>
                  <h4 className="font-semibold mb-2">Anchoring to Blockchain...</h4>
                  <Progress
                    value={anchorProgress}
                    color="success"
                    className="w-full max-w-md mx-auto"
                    showValueLabel
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    Creating immutable proof on Arweave network
                  </p>
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Action Buttons */}
      {!isExporting && !isAnchoring && (
        <Card>
          <CardBody>
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Ready to export and anchor your proof pack to the blockchain
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="flat"
                  onPress={simulateExport}
                >
                  Export Only
                </Button>
                <Button
                  color="primary"
                  onPress={handleExportAndAnchor}
                >
                  Export & Anchor to Blockchain
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Security Notice */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <CardBody>
          <div className="flex items-start space-x-3">
            <div className="w-5 h-5 text-blue-500 mt-0.5">
              <svg fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100">
                Blockchain Anchoring
              </h4>
              <p className="text-sm text-blue-700 dark:text-blue-200 mt-1">
                Anchoring to blockchain creates an immutable timestamp and proof of existence. 
                This enables independent verification without requiring access to your original data.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}