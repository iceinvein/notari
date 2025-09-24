// Verification system types
import type { BlockchainAnchor, MerkleProof } from "./blockchain.types";
import type { CryptoSignature } from "./crypto.types";

export interface VerificationData {
  signatures: CryptoSignature[];
  merkleRoot: string;
  blockchainAnchor?: BlockchainAnchor;
  integrityHash: string;
  createdAt: number;
}

export interface VerificationResult {
  isValid: boolean;
  trustScore: number;
  verificationTime: number;
  checks: VerificationCheck[];
  warnings: string[];
  errors: string[];
}

export interface VerificationCheck {
  type: "signature" | "hash" | "blockchain" | "timestamp" | "integrity";
  status: "passed" | "failed" | "warning";
  message: string;
  details?: Record<string, unknown>;
}

export interface VerificationStatus {
  id: string;
  status: "pending" | "completed" | "failed";
  progress: number;
  startTime: number;
  endTime?: number;
  result?: VerificationResult;
}

export interface VerificationReport {
  proofPackId: string;
  verificationId: string;
  result: VerificationResult;
  timestamp: number;
  verifierInfo: VerifierInfo;
  merkleProof?: MerkleProof;
}

export interface VerifierInfo {
  id: string;
  name?: string;
  organization?: string;
  ipAddress: string;
  userAgent: string;
}

export interface BatchVerificationResult {
  results: VerificationResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
  processingTime: number;
}
