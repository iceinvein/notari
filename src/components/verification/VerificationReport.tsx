import {
  Card,
  CardHeader,
  CardBody,
  Button,
  Divider,
  Chip,
} from "@heroui/react";
import type { VerificationResult } from "../../types";

interface VerificationReportProps {
  result: VerificationResult;
}

export function VerificationReport({ result }: VerificationReportProps) {
  const generateReportData = () => {
    return {
      reportId: `VR-${Date.now().toString(36).toUpperCase()}`,
      timestamp: new Date(result.verificationTime).toISOString(),
      verificationDuration: Math.floor(Math.random() * 5000) + 1000, // 1-6 seconds
      verifierInfo: {
        version: "Notari Verifier v1.0.0",
        platform: "Web Browser",
        location: "United States",
      },
      technicalDetails: {
        cryptographicAlgorithms: ["ECDSA-P256", "SHA-256", "AES-256-GCM"],
        blockchainNetworks: ["Arweave", "Ethereum"],
        verificationProtocol: "Notari Verification Protocol v1.0",
      },
    };
  };

  const reportData = generateReportData();

  const downloadReport = (format: "pdf" | "json") => {
    // In a real app, this would generate and download the actual report
    const reportContent = {
      reportId: reportData.reportId,
      timestamp: reportData.timestamp,
      verificationResult: result,
      technicalDetails: reportData.technicalDetails,
      verifierInfo: reportData.verifierInfo,
    };

    if (format === "json") {
      const blob = new Blob([JSON.stringify(reportContent, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `verification-report-${reportData.reportId}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // For PDF, we would use a library like jsPDF
      console.log("PDF download would be implemented here");
    }
  };

  const shareReport = () => {
    const shareUrl = `https://verify.notari.com/report/${reportData.reportId}`;
    navigator.clipboard.writeText(shareUrl);
    // In a real app, you might show a toast notification here
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <h3 className="text-lg font-semibold">Verification Report</h3>
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant="flat"
              onPress={() => downloadReport("json")}
            >
              Download JSON
            </Button>
            <Button
              size="sm"
              variant="flat"
              onPress={() => downloadReport("pdf")}
            >
              Download PDF
            </Button>
            <Button
              size="sm"
              color="primary"
              onPress={shareReport}
            >
              Share Report
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        <div className="space-y-6">
          {/* Report Header */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Report Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Report ID:</span>
                  <span className="font-mono">{reportData.reportId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Generated:</span>
                  <span>{new Date(result.verificationTime).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                  <span>{reportData.verificationDuration}ms</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">Verifier Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Version:</span>
                  <span>{reportData.verifierInfo.version}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Platform:</span>
                  <span>{reportData.verifierInfo.platform}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Location:</span>
                  <span>{reportData.verifierInfo.location}</span>
                </div>
              </div>
            </div>
          </div>

          <Divider />

          {/* Verification Summary */}
          <div>
            <h4 className="font-semibold mb-3">Verification Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {result.trustScore}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Trust Score</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  {result.checks.filter(c => c.status === "passed").length}/{result.checks.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Checks Passed</div>
              </div>
              
              <div className="text-center p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <Chip
                  color={result.isValid ? "success" : "danger"}
                  variant="flat"
                  size="lg"
                >
                  {result.isValid ? "VALID" : "INVALID"}
                </Chip>
              </div>
            </div>
          </div>

          <Divider />

          {/* Technical Details */}
          <div>
            <h4 className="font-semibold mb-3">Technical Details</h4>
            <div className="space-y-4">
              <div>
                <h5 className="font-medium mb-2">Cryptographic Algorithms</h5>
                <div className="flex flex-wrap gap-2">
                  {reportData.technicalDetails.cryptographicAlgorithms.map((algo) => (
                    <Chip key={algo} size="sm" variant="flat">
                      {algo}
                    </Chip>
                  ))}
                </div>
              </div>
              
              <div>
                <h5 className="font-medium mb-2">Blockchain Networks</h5>
                <div className="flex flex-wrap gap-2">
                  {reportData.technicalDetails.blockchainNetworks.map((network) => (
                    <Chip key={network} size="sm" variant="flat" color="primary">
                      {network}
                    </Chip>
                  ))}
                </div>
              </div>
              
              <div>
                <h5 className="font-medium mb-2">Verification Protocol</h5>
                <Chip variant="flat" color="secondary">
                  {reportData.technicalDetails.verificationProtocol}
                </Chip>
              </div>
            </div>
          </div>

          <Divider />

          {/* Detailed Check Results */}
          <div>
            <h4 className="font-semibold mb-3">Detailed Check Results</h4>
            <div className="space-y-3">
              {result.checks.map((check, index) => (
                <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium capitalize">{check.type} Verification</h5>
                    <Chip
                      size="sm"
                      color={
                        check.status === "passed" ? "success" :
                        check.status === "warning" ? "warning" : "danger"
                      }
                      variant="flat"
                    >
                      {check.status.toUpperCase()}
                    </Chip>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    {check.message}
                  </p>
                  {check.details && (
                    <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded text-xs font-mono">
                      <pre>{JSON.stringify(check.details, null, 2)}</pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Warnings and Errors */}
          {(result.warnings.length > 0 || result.errors.length > 0) && (
            <>
              <Divider />
              <div>
                <h4 className="font-semibold mb-3">Issues and Warnings</h4>
                <div className="space-y-3">
                  {result.warnings.map((warning, index) => (
                    <div key={index} className="flex items-start space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <span className="text-yellow-600 mt-0.5">⚠</span>
                      <div>
                        <div className="font-medium text-yellow-800 dark:text-yellow-200">Warning</div>
                        <div className="text-sm text-yellow-700 dark:text-yellow-300">{warning}</div>
                      </div>
                    </div>
                  ))}
                  
                  {result.errors.map((error, index) => (
                    <div key={index} className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <span className="text-red-600 mt-0.5">✗</span>
                      <div>
                        <div className="font-medium text-red-800 dark:text-red-200">Error</div>
                        <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Legal Disclaimer */}
          <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
            <h5 className="font-medium mb-2">Legal Disclaimer</h5>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              This verification report is generated by the Notari verification system and represents 
              the cryptographic and technical validation of the submitted proof pack at the time of 
              verification. This report does not constitute legal advice or guarantee the authenticity 
              of the underlying work or content. Users should consult with legal professionals for 
              matters requiring legal validation.
            </p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}