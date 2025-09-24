import { Card, CardBody, CardHeader, Chip, Progress } from "@heroui/react";
import type { VerificationResult } from "../../types";

interface TrustScoreVisualizationProps {
  result: VerificationResult;
}

export function TrustScoreVisualization({
  result,
}: TrustScoreVisualizationProps) {
  const getTrustLevel = (score: number) => {
    if (score >= 90)
      return {
        level: "Excellent",
        color: "success" as const,
        description: "Highly trustworthy proof pack",
      };
    if (score >= 80)
      return {
        level: "Good",
        color: "primary" as const,
        description: "Reliable proof pack with minor issues",
      };
    if (score >= 70)
      return {
        level: "Fair",
        color: "warning" as const,
        description: "Acceptable but with some concerns",
      };
    return {
      level: "Poor",
      color: "danger" as const,
      description: "Significant verification issues detected",
    };
  };

  const getChecksSummary = () => {
    const passed = result.checks.filter(
      (check) => check.status === "passed",
    ).length;
    const warnings = result.checks.filter(
      (check) => check.status === "warning",
    ).length;
    const failed = result.checks.filter(
      (check) => check.status === "failed",
    ).length;

    return { passed, warnings, failed, total: result.checks.length };
  };

  const trustLevel = getTrustLevel(result.trustScore);
  const checksSummary = getChecksSummary();

  return (
    <Card
      className={`border-2 ${
        result.isValid
          ? "border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800"
          : "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
      }`}
    >
      <CardHeader>
        <div className="flex items-center justify-between w-full">
          <h3 className="text-lg font-semibold">Verification Summary</h3>
          <Chip
            color={result.isValid ? "success" : "danger"}
            variant="solid"
            size="lg"
          >
            {result.isValid ? "✓ VERIFIED" : "✗ FAILED"}
          </Chip>
        </div>
      </CardHeader>
      <CardBody>
        <div className="space-y-6">
          {/* Trust Score Circle */}
          <div className="flex items-center justify-center">
            <div className="relative">
              {/* Outer circle */}
              <div className="w-32 h-32 rounded-full border-8 border-gray-200 dark:border-gray-700 flex items-center justify-center">
                {/* Inner content */}
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 dark:text-white">
                    {result.trustScore}%
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    Trust Score
                  </div>
                </div>
              </div>

              {/* Progress overlay */}
              <svg
                className="absolute inset-0 w-32 h-32 transform -rotate-90"
                role="img"
                aria-label="Trust score progress circle"
              >
                <circle
                  cx="64"
                  cy="64"
                  r="56"
                  stroke="currentColor"
                  strokeWidth="8"
                  fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 56}`}
                  strokeDashoffset={`${2 * Math.PI * 56 * (1 - result.trustScore / 100)}`}
                  className={`${
                    trustLevel.color === "success"
                      ? "text-green-500"
                      : trustLevel.color === "primary"
                        ? "text-blue-500"
                        : trustLevel.color === "warning"
                          ? "text-yellow-500"
                          : "text-red-500"
                  } transition-all duration-1000 ease-out`}
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          {/* Trust Level */}
          <div className="text-center">
            <Chip
              color={trustLevel.color}
              variant="flat"
              size="lg"
              className="mb-2"
            >
              {trustLevel.level} Trust Level
            </Chip>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {trustLevel.description}
            </p>
          </div>

          {/* Verification Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {checksSummary.passed}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Passed
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {checksSummary.warnings}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Warnings
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {checksSummary.failed}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Failed
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {checksSummary.total}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total
              </div>
            </div>
          </div>

          {/* Progress Bars */}
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Cryptographic Integrity</span>
                <span>
                  {Math.round(
                    (checksSummary.passed / checksSummary.total) * 100,
                  )}
                  %
                </span>
              </div>
              <Progress
                value={(checksSummary.passed / checksSummary.total) * 100}
                color="success"
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Blockchain Verification</span>
                <span>
                  {result.checks.find((c) => c.type === "blockchain")
                    ?.status === "passed"
                    ? "100%"
                    : "75%"}
                </span>
              </div>
              <Progress
                value={
                  result.checks.find((c) => c.type === "blockchain")?.status ===
                  "passed"
                    ? 100
                    : 75
                }
                color={
                  result.checks.find((c) => c.type === "blockchain")?.status ===
                  "passed"
                    ? "success"
                    : "warning"
                }
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Timestamp Accuracy</span>
                <span>
                  {result.checks.find((c) => c.type === "timestamp")?.status ===
                  "passed"
                    ? "100%"
                    : "0%"}
                </span>
              </div>
              <Progress
                value={
                  result.checks.find((c) => c.type === "timestamp")?.status ===
                  "passed"
                    ? 100
                    : 0
                }
                color={
                  result.checks.find((c) => c.type === "timestamp")?.status ===
                  "passed"
                    ? "success"
                    : "danger"
                }
                className="w-full"
              />
            </div>
          </div>

          {/* Verification Time */}
          <div className="text-center text-sm text-gray-500">
            Verified on {new Date(result.verificationTime).toLocaleString()}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
