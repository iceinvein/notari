// Verification API interface
import type {
  BatchVerificationResult,
  ProofPack,
  VerificationReport,
  VerificationResult,
  VerificationStatus,
} from "../../types";

export interface VerificationAPI {
  verifyProofPack(proofPack: ProofPack): Promise<VerificationResult>;
  getVerificationStatus(verificationId: string): Promise<VerificationStatus>;
  batchVerify(proofPacks: ProofPack[]): Promise<BatchVerificationResult>;
  generateVerificationReport(
    result: VerificationResult,
  ): Promise<VerificationReport>;
  getVerificationHistory(proofPackId: string): Promise<VerificationReport[]>;
}

export interface VerificationConfig {
  strictMode: boolean;
  checkBlockchain: boolean;
  requireSignatures: boolean;
  timeoutMs: number;
  maxRetries: number;
}
