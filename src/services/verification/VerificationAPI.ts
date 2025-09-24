import { invoke } from "@tauri-apps/api/core";
import type {
  BatchVerificationResult,
  ProofPack,
  VerificationReport,
  VerificationResult,
  VerificationStatus,
} from "../../types";
import type { MerkleProof } from "../../types/blockchain.types";

export interface VerificationConfig {
  strictMode: boolean;
  checkBlockchain: boolean;
  requireSignatures: boolean;
  timeoutMs: number;
  maxRetries: number;
}

export interface VerifierInfo {
  id: string;
  name?: string;
  organization?: string;
  ipAddress: string;
  userAgent: string;
}

export interface VerificationAnalytics {
  verificationId: string;
  proofPackId: string;
  verifierInfo: VerifierInfo;
  timestamp: number;
  processingTime: number;
  resultSummary: {
    isValid: boolean;
    trustScore: number;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningChecks: number;
  };
  checksPerformed: string[];
}

export interface VerificationStats {
  periodStart: number;
  periodEnd: number;
  totalVerifications: number;
  successfulVerifications: number;
  failedVerifications: number;
  uniqueVerifiers: number;
  uniqueProofPacks: number;
  avgProcessingTime: number;
  avgTrustScore: number;
}

export interface AuditEntry {
  id: string;
  timestamp: number;
  eventType:
    | "VerificationStarted"
    | "VerificationCompleted"
    | "VerificationFailed"
    | "RateLimitExceeded"
    | "InvalidRequest";
  verificationId: string;
  proofPackId: string;
  verifierInfo: VerifierInfo;
  resultSummary?: {
    isValid: boolean;
    trustScore: number;
    totalChecks: number;
    passedChecks: number;
    failedChecks: number;
    warningChecks: number;
  };
  metadata: Record<string, unknown>;
}

export interface VerificationEngineStatus {
  isInitialized: boolean;
  activeVerifications: number;
  version: string;
}

/**
 * Verification API service for validating Proof Packs
 */
export class VerificationAPI {
  private isInitialized = false;

  /**
   * Initialize the verification engine
   */
  async initialize(): Promise<void> {
    try {
      await invoke("initialize_verification_engine");
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize verification engine: ${error}`);
    }
  }

  /**
   * Verify a single Proof Pack
   */
  async verifyProofPack(
    proofPack: ProofPack,
    config?: VerificationConfig,
    verifierInfo?: VerifierInfo,
  ): Promise<VerificationResult> {
    this.ensureInitialized();

    const defaultVerifierInfo: VerifierInfo = {
      id: `verifier_${Date.now()}`,
      ipAddress: "127.0.0.1",
      userAgent: navigator.userAgent,
    };

    try {
      return await invoke("verify_proof_pack", {
        proofPack,
        config: config || this.getDefaultConfig(),
        verifierInfo: verifierInfo || defaultVerifierInfo,
      });
    } catch (error) {
      throw new Error(`Verification failed: ${error}`);
    }
  }

  /**
   * Start asynchronous verification (returns verification ID immediately)
   */
  async startAsyncVerification(
    proofPack: ProofPack,
    config?: VerificationConfig,
    verifierInfo?: VerifierInfo,
  ): Promise<string> {
    this.ensureInitialized();

    const defaultVerifierInfo: VerifierInfo = {
      id: `verifier_${Date.now()}`,
      ipAddress: "127.0.0.1",
      userAgent: navigator.userAgent,
    };

    try {
      return await invoke("start_async_verification", {
        proofPack,
        config: config || this.getDefaultConfig(),
        verifierInfo: verifierInfo || defaultVerifierInfo,
      });
    } catch (error) {
      throw new Error(`Failed to start verification: ${error}`);
    }
  }

  /**
   * Get verification status by ID
   */
  async getVerificationStatus(
    verificationId: string,
  ): Promise<VerificationStatus> {
    this.ensureInitialized();

    try {
      return await invoke("get_verification_status", { verificationId });
    } catch (error) {
      throw new Error(`Failed to get verification status: ${error}`);
    }
  }

  /**
   * Verify multiple Proof Packs in batch
   */
  async batchVerify(
    proofPacks: ProofPack[],
    config?: VerificationConfig,
    verifierInfo?: VerifierInfo,
  ): Promise<BatchVerificationResult> {
    this.ensureInitialized();

    const defaultVerifierInfo: VerifierInfo = {
      id: `batch_verifier_${Date.now()}`,
      ipAddress: "127.0.0.1",
      userAgent: navigator.userAgent,
    };

    try {
      return await invoke("batch_verify_proof_packs", {
        proofPacks,
        config: config || this.getDefaultConfig(),
        verifierInfo: verifierInfo || defaultVerifierInfo,
      });
    } catch (error) {
      throw new Error(`Batch verification failed: ${error}`);
    }
  }

  /**
   * Generate Merkle proof for a hash
   */
  async generateMerkleProof(
    hash: string,
    anchorId: string,
  ): Promise<MerkleProof> {
    this.ensureInitialized();

    try {
      return await invoke("generate_verification_merkle_proof", {
        hash,
        anchorId,
      });
    } catch (error) {
      throw new Error(`Failed to generate Merkle proof: ${error}`);
    }
  }

  /**
   * Get verification analytics for a specific verification
   */
  async getVerificationAnalytics(
    verificationId: string,
  ): Promise<VerificationAnalytics | null> {
    this.ensureInitialized();

    try {
      return await invoke("get_verification_analytics", { verificationId });
    } catch (error) {
      throw new Error(`Failed to get verification analytics: ${error}`);
    }
  }

  /**
   * Get verification history for a Proof Pack
   */
  async getVerificationHistory(
    proofPackId: string,
  ): Promise<VerificationAnalytics[]> {
    this.ensureInitialized();

    try {
      return await invoke("get_proof_pack_verification_history", {
        proofPackId,
      });
    } catch (error) {
      throw new Error(`Failed to get verification history: ${error}`);
    }
  }

  /**
   * Get verification statistics
   */
  async getVerificationStats(
    startTime?: number,
    endTime?: number,
  ): Promise<VerificationStats> {
    this.ensureInitialized();

    try {
      return await invoke("get_verification_stats", { startTime, endTime });
    } catch (error) {
      throw new Error(`Failed to get verification stats: ${error}`);
    }
  }

  /**
   * Get audit trail
   */
  async getAuditTrail(
    startTime?: number,
    endTime?: number,
    eventType?: string,
  ): Promise<AuditEntry[]> {
    this.ensureInitialized();

    try {
      return await invoke("get_verification_audit_trail", {
        startTime,
        endTime,
        eventType,
      });
    } catch (error) {
      throw new Error(`Failed to get audit trail: ${error}`);
    }
  }

  /**
   * Generate verification report
   */
  async generateVerificationReport(
    verificationId: string,
  ): Promise<VerificationReport> {
    this.ensureInitialized();

    try {
      return await invoke("generate_verification_report", { verificationId });
    } catch (error) {
      throw new Error(`Failed to generate verification report: ${error}`);
    }
  }

  /**
   * Clean up old verification data
   */
  async cleanupVerificationData(retentionDays: number): Promise<number> {
    this.ensureInitialized();

    try {
      return await invoke("cleanup_verification_data", { retentionDays });
    } catch (error) {
      throw new Error(`Failed to cleanup verification data: ${error}`);
    }
  }

  /**
   * Get verification engine status
   */
  async getEngineStatus(): Promise<VerificationEngineStatus> {
    try {
      return await invoke("get_verification_engine_status");
    } catch (error) {
      throw new Error(`Failed to get engine status: ${error}`);
    }
  }

  /**
   * Poll verification status until completion
   */
  async pollVerificationStatus(
    verificationId: string,
    intervalMs = 1000,
    timeoutMs = 30000,
  ): Promise<VerificationResult> {
    const startTime = Date.now();

    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.getVerificationStatus(verificationId);

          if (status.status === "completed" && status.result) {
            resolve(status.result);
            return;
          }

          if (status.status === "failed") {
            reject(new Error("Verification failed"));
            return;
          }

          if (Date.now() - startTime > timeoutMs) {
            reject(new Error("Verification timeout"));
            return;
          }

          setTimeout(poll, intervalMs);
        } catch (error) {
          reject(error);
        }
      };

      poll();
    });
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error(
        "Verification API not initialized. Call initialize() first.",
      );
    }
  }

  private getDefaultConfig(): VerificationConfig {
    return {
      strictMode: false,
      checkBlockchain: true,
      requireSignatures: true,
      timeoutMs: 30000,
      maxRetries: 3,
    };
  }
}

// Export singleton instance
export const verificationAPI = new VerificationAPI();
