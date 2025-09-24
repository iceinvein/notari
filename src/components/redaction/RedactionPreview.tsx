import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Divider,
  Progress,
} from "@heroui/react";
import type { ProofPack, RedactionArea } from "../../types";

interface RedactionPreviewProps {
  proofPack: ProofPack;
  redactionAreas: RedactionArea[];
}

export function RedactionPreview({ redactionAreas }: RedactionPreviewProps) {
  const calculateRedactionStats = () => {
    const totalAreas = redactionAreas.length;
    const totalRedactedPixels = redactionAreas.reduce((sum, area) => {
      if (area.coordinates) {
        return sum + area.coordinates.width * area.coordinates.height;
      }
      return sum;
    }, 0);

    // Mock total content area (in real app this would be calculated from actual content)
    const totalContentArea = 800 * 600; // Approximate content area
    const redactionPercentage = Math.min(
      (totalRedactedPixels / totalContentArea) * 100,
      100,
    );

    return {
      totalAreas,
      totalRedactedPixels,
      redactionPercentage: Math.round(redactionPercentage * 10) / 10,
    };
  };

  const getVerificationImpact = (redactionPercentage: number) => {
    if (redactionPercentage < 10) {
      return {
        level: "minimal" as const,
        color: "success" as const,
        description: "Minimal impact on verification capabilities",
        trustScore: 95,
      };
    } else if (redactionPercentage < 30) {
      return {
        level: "moderate" as const,
        color: "warning" as const,
        description: "Some verification features may be limited",
        trustScore: 80,
      };
    } else {
      return {
        level: "significant" as const,
        color: "danger" as const,
        description: "Significant impact on verification capabilities",
        trustScore: 60,
      };
    }
  };

  const stats = calculateRedactionStats();
  const impact = getVerificationImpact(stats.redactionPercentage);

  const mockRedactedContent = `
    This is a sample document content that would be displayed in the redaction interface.
    
    Personal Information:
    Name: ████████
    Email: ████████████████████
    Phone: ██████████████
    
    Financial Information:
    Account Number: ████████████████████
    Balance: ████████
    
    Work Content:
    The research methodology involves analyzing data patterns to identify
    correlations between user behavior and system performance metrics.
    
    Confidential Notes:
    Internal project code: ████████████████████
    Meeting notes with stakeholders regarding budget allocation.
  `;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Redaction Preview</h3>
      </CardHeader>
      <CardBody>
        <div className="space-y-6">
          {/* Redaction Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {stats.totalAreas}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Redaction Areas
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-warning">
                {stats.redactionPercentage}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Content Redacted
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-success">
                {impact.trustScore}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Trust Score
              </div>
            </div>
          </div>

          <Divider />

          {/* Verification Impact */}
          <div>
            <h4 className="font-semibold mb-3">
              Verification Impact Assessment
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Impact Level:</span>
                <Chip color={impact.color} variant="flat" size="sm">
                  {impact.level.toUpperCase()}
                </Chip>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Redaction Coverage:</span>
                <span className="text-sm">{stats.redactionPercentage}%</span>
              </div>
              <Progress
                value={stats.redactionPercentage}
                color={impact.color}
                className="w-full"
              />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {impact.description}
              </p>
            </div>
          </div>

          <Divider />

          {/* Preview of Redacted Content */}
          <div>
            <h4 className="font-semibold mb-3">Redacted Content Preview</h4>
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border max-h-64 overflow-y-auto">
              <div className="space-y-2 text-sm">
                {mockRedactedContent.split("\n").map((line, index) => (
                  <div
                    key={`redacted-line-${index}-${line.slice(0, 10)}`}
                    className={line.trim() === "" ? "h-2" : ""}
                  >
                    {line.trim() !== "" && (
                      <p
                        className={
                          line.includes("████")
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-800 dark:text-gray-200"
                        }
                      >
                        {line.trim()}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              ████ represents redacted content that will be cryptographically
              hidden
            </p>
          </div>

          <Divider />

          {/* Cryptographic Guarantees */}
          <div>
            <h4 className="font-semibold mb-3">Cryptographic Guarantees</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 text-green-500 mt-0.5">
                  <svg
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    role="img"
                    aria-label="Success checkmark"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-sm">Commitment Proofs</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Cryptographic proof that redacted content existed
                  </div>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 text-green-500 mt-0.5">
                  <svg
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    role="img"
                    aria-label="Success checkmark"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-sm">
                    Partial Verification
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Non-redacted content remains fully verifiable
                  </div>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 text-green-500 mt-0.5">
                  <svg
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    role="img"
                    aria-label="Success checkmark"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-sm">
                    Integrity Preservation
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Overall proof pack integrity maintained
                  </div>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 text-green-500 mt-0.5">
                  <svg
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    role="img"
                    aria-label="Success checkmark"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <div className="font-medium text-sm">Zero-Knowledge</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    Redacted content cannot be recovered
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
