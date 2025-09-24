import { useState, useEffect } from "react";
import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Input,
  Progress,
  Chip,
  Divider,
  Spinner,
} from "@heroui/react";
import { VerificationReport } from "./VerificationReport";
import { TrustScoreVisualization } from "./TrustScoreVisualization";
import type { VerificationResult } from "../../types";

export function VerificationResults() {
  const [verificationUrl, setVerificationUrl] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState("");
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [recentVerifications, setRecentVerifications] = useState<VerificationResult[]>([]);

  // Mock recent verifications
  useEffect(() => {
    const mockVerifications: VerificationResult[] = [
      {
        isValid: true,
        trustScore: 95,
        verificationTime: Date.now() - 3600000,
        checks: [
          { type: "signature", status: "passed", message: "Cryptographic signature valid" },
          { type: "hash", status: "passed", message: "Content integrity verified" },
          { type: "blockchain", status: "passed", message: "Blockchain anchor confirmed" },
          { type: "timestamp", status: "passed", message: "Timestamp verification successful" },
        ],
        warnings: [],
        errors: [],
      },
      {
        isValid: true,
        trustScore: 87,
        verificationTime: Date.now() - 7200000,
        checks: [
          { type: "signature", status: "passed", message: "Cryptographic signature valid" },
          { type: "hash", status: "passed", message: "Content integrity verified" },
          { type: "blockchain", status: "warning", message: "Blockchain confirmation pending" },
          { type: "timestamp", status: "passed", message: "Timestamp verification successful" },
        ],
        warnings: ["Blockchain confirmation still pending"],
        errors: [],
      },
    ];
    setRecentVerifications(mockVerifications);
  }, []);

  const simulateVerification = async () => {
    setIsVerifying(true);
    setVerificationProgress(0);
    setVerificationResult(null);

    const steps = [
      { message: "Parsing proof pack...", duration: 800 },
      { message: "Verifying cryptographic signatures...", duration: 1200 },
      { message: "Checking content integrity...", duration: 1000 },
      { message: "Validating blockchain anchor...", duration: 1500 },
      { message: "Verifying timestamps...", duration: 800 },
      { message: "Calculating trust score...", duration: 600 },
      { message: "Generating verification report...", duration: 400 },
    ];

    let progress = 0;
    const progressIncrement = 100 / steps.length;

    for (const step of steps) {
      setCurrentStep(step.message);
      await new Promise(resolve => setTimeout(resolve, step.duration));
      progress += progressIncrement;
      setVerificationProgress(Math.min(progress, 100));
    }

    // Generate mock verification result
    const mockResult: VerificationResult = {
      isValid: Math.random() > 0.1, // 90% chance of valid
      trustScore: Math.floor(Math.random() * 30) + 70, // 70-100
      verificationTime: Date.now(),
      checks: [
        {
          type: "signature",
          status: "passed",
          message: "Cryptographic signature is valid and matches the proof pack content",
          details: { algorithm: "ECDSA-P256", keyId: "key-123" }
        },
        {
          type: "hash",
          status: "passed",
          message: "Content integrity hash verification successful",
          details: { algorithm: "SHA-256", expectedHash: "abc123...", actualHash: "abc123..." }
        },
        {
          type: "blockchain",
          status: Math.random() > 0.2 ? "passed" : "warning",
          message: Math.random() > 0.2 
            ? "Blockchain anchor confirmed on Arweave network" 
            : "Blockchain anchor found but confirmation pending",
          details: { 
            network: "Arweave", 
            transactionId: "tx-456", 
            blockHeight: 1234567,
            confirmations: Math.random() > 0.2 ? 15 : 2
          }
        },
        {
          type: "timestamp",
          status: "passed",
          message: "Timestamp verification successful",
          details: { 
            createdAt: new Date().toISOString(),
            tolerance: "±5 minutes",
            verified: true
          }
        },
        {
          type: "integrity",
          status: Math.random() > 0.1 ? "passed" : "warning",
          message: Math.random() > 0.1 
            ? "All integrity checks passed" 
            : "Minor integrity warnings detected",
          details: { 
            totalChecks: 15,
            passed: Math.random() > 0.1 ? 15 : 14,
            warnings: Math.random() > 0.1 ? 0 : 1
          }
        },
      ],
      warnings: Math.random() > 0.7 ? ["Some blockchain confirmations are still pending"] : [],
      errors: Math.random() > 0.9 ? ["Minor timestamp discrepancy detected"] : [],
    };

    setCurrentStep("Verification complete!");
    setVerificationResult(mockResult);
    setRecentVerifications(prev => [mockResult, ...prev.slice(0, 4)]);
    setIsVerifying(false);
  };

  const handleVerify = () => {
    if (!verificationUrl.trim()) return;
    simulateVerification();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "passed": return "success";
      case "warning": return "warning";
      case "failed": return "danger";
      default: return "default";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Verification Center
        </h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">
          Verify the authenticity and integrity of proof packs
        </p>
      </div>

      {/* Verification Input */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Verify Proof Pack</h3>
        </CardHeader>
        <CardBody>
          <div className="flex space-x-4">
            <Input
              placeholder="Enter proof pack URL or upload file..."
              value={verificationUrl}
              onValueChange={setVerificationUrl}
              className="flex-1"
              startContent={
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
              }
            />
            <Button
              color="primary"
              onPress={handleVerify}
              isDisabled={!verificationUrl.trim() || isVerifying}
              isLoading={isVerifying}
            >
              Verify
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            Paste a verification URL or drag and drop a proof pack file to verify its authenticity
          </p>
        </CardBody>
      </Card>

      {/* Verification Progress */}
      {isVerifying && (
        <Card>
          <CardBody className="text-center py-8">
            <Spinner size="lg" className="mb-4" />
            <h3 className="text-lg font-semibold mb-2">Verifying Proof Pack</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">{currentStep}</p>
            <Progress
              value={verificationProgress}
              color="primary"
              className="w-full max-w-md mx-auto"
              showValueLabel
            />
          </CardBody>
        </Card>
      )}

      {/* Verification Result */}
      {verificationResult && (
        <div className="space-y-6">
          {/* Trust Score Visualization */}
          <TrustScoreVisualization result={verificationResult} />

          {/* Detailed Checks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between w-full">
                <h3 className="text-lg font-semibold">Verification Checks</h3>
                <Chip
                  color={verificationResult.isValid ? "success" : "danger"}
                  variant="flat"
                >
                  {verificationResult.isValid ? "VALID" : "INVALID"}
                </Chip>
              </div>
            </CardHeader>
            <CardBody>
              <div className="space-y-4">
                {verificationResult.checks.map((check, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${
                      check.status === "passed" ? "bg-green-100 text-green-600" :
                      check.status === "warning" ? "bg-yellow-100 text-yellow-600" :
                      "bg-red-100 text-red-600"
                    }`}>
                      {check.status === "passed" ? "✓" : check.status === "warning" ? "⚠" : "✗"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-medium capitalize">{check.type} Check</span>
                        <Chip
                          size="sm"
                          color={getStatusColor(check.status)}
                          variant="flat"
                        >
                          {check.status.toUpperCase()}
                        </Chip>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {check.message}
                      </p>
                      {check.details && (
                        <div className="mt-2 text-xs text-gray-500 font-mono">
                          {Object.entries(check.details).map(([key, value]) => (
                            <div key={key}>
                              {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Warnings and Errors */}
              {(verificationResult.warnings.length > 0 || verificationResult.errors.length > 0) && (
                <>
                  <Divider className="my-4" />
                  {verificationResult.warnings.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-yellow-600">Warnings</h4>
                      {verificationResult.warnings.map((warning, index) => (
                        <div key={index} className="flex items-center space-x-2 text-sm text-yellow-600">
                          <span>⚠</span>
                          <span>{warning}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {verificationResult.errors.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium text-red-600">Errors</h4>
                      {verificationResult.errors.map((error, index) => (
                        <div key={index} className="flex items-center space-x-2 text-sm text-red-600">
                          <span>✗</span>
                          <span>{error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardBody>
          </Card>

          {/* Verification Report */}
          <VerificationReport result={verificationResult} />
        </div>
      )}

      {/* Recent Verifications */}
      {recentVerifications.length > 0 && (
        <Card>
          <CardHeader>
            <h3 className="text-lg font-semibold">Recent Verifications</h3>
          </CardHeader>
          <CardBody>
            <div className="space-y-3">
              {recentVerifications.map((result, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${result.isValid ? "bg-green-500" : "bg-red-500"}`} />
                    <div>
                      <div className="font-medium">
                        Trust Score: {result.trustScore}%
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(result.verificationTime).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Chip
                      size="sm"
                      color={result.isValid ? "success" : "danger"}
                      variant="flat"
                    >
                      {result.isValid ? "VALID" : "INVALID"}
                    </Chip>
                    <Button size="sm" variant="flat">
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}