import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";
import type { ProofPack, VerificationResult } from "../../types";
import {
  VerificationAPI,
  type VerificationConfig,
  type VerifierInfo,
} from "./VerificationAPI";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

const mockInvoke = invoke as any;

// Mock navigator
Object.defineProperty(window, "navigator", {
  value: {
    userAgent: "test-user-agent",
  },
  writable: true,
});

describe("VerificationAPI", () => {
  let verificationAPI: VerificationAPI;
  let mockProofPack: ProofPack;
  let mockVerifierInfo: VerifierInfo;
  let mockConfig: VerificationConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    verificationAPI = new VerificationAPI();

    mockProofPack = {
      id: "test-proof-pack-id",
      version: "1.0",
      metadata: {
        creator: "test-user",
        created: Date.now(),
        sessions: ["session1"],
        totalDuration: 3600,
      },
      evidence: {
        sessions: [],
        aiAnalysis: [],
        timeline: [],
      },
      verification: {
        integrityHash: "test-hash",
        signatures: [],
        timestamp: Date.now(),
        version: "1.0",
      },
    };

    mockVerifierInfo = {
      id: "test-verifier",
      name: "Test Verifier",
      organization: "Test Org",
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    };

    mockConfig = {
      strictMode: false,
      checkBlockchain: true,
      requireSignatures: true,
      timeoutMs: 30000,
      maxRetries: 3,
    };
  });

  describe("initialization", () => {
    it("should initialize successfully", async () => {
      mockInvoke.mockResolvedValueOnce(
        "Verification engine initialized successfully",
      );

      await verificationAPI.initialize();

      expect(mockInvoke).toHaveBeenCalledWith("initialize_verification_engine");
    });

    it("should throw error if initialization fails", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Initialization failed"));

      await expect(verificationAPI.initialize()).rejects.toThrow(
        "Failed to initialize verification engine: Error: Initialization failed",
      );
    });

    it("should throw error when calling methods before initialization", async () => {
      await expect(
        verificationAPI.verifyProofPack(mockProofPack),
      ).rejects.toThrow("Verification API not initialized");
    });
  });

  describe("verifyProofPack", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce("initialized");
      await verificationAPI.initialize();
      vi.clearAllMocks();
    });

    it("should verify proof pack successfully", async () => {
      const mockResult: VerificationResult = {
        isValid: true,
        trustScore: 95.0,
        verificationTime: 1500,
        checks: [],
        warnings: [],
        errors: [],
      };

      mockInvoke.mockResolvedValueOnce(mockResult);

      const result = await verificationAPI.verifyProofPack(
        mockProofPack,
        mockConfig,
        mockVerifierInfo,
      );

      expect(result).toEqual(mockResult);
      expect(mockInvoke).toHaveBeenCalledWith("verify_proof_pack", {
        proofPack: mockProofPack,
        config: mockConfig,
        verifierInfo: mockVerifierInfo,
      });
    });

    it("should use default config and verifier info when not provided", async () => {
      const mockResult: VerificationResult = {
        isValid: true,
        trustScore: 95.0,
        verificationTime: 1500,
        checks: [],
        warnings: [],
        errors: [],
      };

      mockInvoke.mockResolvedValueOnce(mockResult);

      await verificationAPI.verifyProofPack(mockProofPack);

      expect(mockInvoke).toHaveBeenCalledWith("verify_proof_pack", {
        proofPack: mockProofPack,
        config: {
          strictMode: false,
          checkBlockchain: true,
          requireSignatures: true,
          timeoutMs: 30000,
          maxRetries: 3,
        },
        verifierInfo: expect.objectContaining({
          ipAddress: "127.0.0.1",
          userAgent: "test-user-agent",
        }),
      });
    });

    it("should handle verification failure", async () => {
      mockInvoke.mockRejectedValueOnce(new Error("Verification failed"));

      await expect(
        verificationAPI.verifyProofPack(mockProofPack),
      ).rejects.toThrow("Verification failed: Error: Verification failed");
    });
  });

  describe("startAsyncVerification", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce("initialized");
      await verificationAPI.initialize();
      vi.clearAllMocks();
    });

    it("should start async verification and return verification ID", async () => {
      const verificationId = "test-verification-id";
      mockInvoke.mockResolvedValueOnce(verificationId);

      const result = await verificationAPI.startAsyncVerification(
        mockProofPack,
        mockConfig,
        mockVerifierInfo,
      );

      expect(result).toBe(verificationId);
      expect(mockInvoke).toHaveBeenCalledWith("start_async_verification", {
        proofPack: mockProofPack,
        config: mockConfig,
        verifierInfo: mockVerifierInfo,
      });
    });
  });

  describe("getVerificationStatus", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce("initialized");
      await verificationAPI.initialize();
      vi.clearAllMocks();
    });

    it("should get verification status", async () => {
      const mockStatus = {
        id: "test-verification-id",
        status: "Completed",
        progress: 100.0,
        startTime: Date.now(),
        endTime: Date.now(),
        result: {
          isValid: true,
          trustScore: 95.0,
          verificationTime: 1500,
          checks: [],
          warnings: [],
          errors: [],
        },
      };

      mockInvoke.mockResolvedValueOnce(mockStatus);

      const result = await verificationAPI.getVerificationStatus(
        "test-verification-id",
      );

      expect(result).toEqual(mockStatus);
      expect(mockInvoke).toHaveBeenCalledWith("get_verification_status", {
        verificationId: "test-verification-id",
      });
    });
  });

  describe("batchVerify", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce("initialized");
      await verificationAPI.initialize();
      vi.clearAllMocks();
    });

    it("should batch verify multiple proof packs", async () => {
      const mockBatchResult = {
        results: [
          {
            isValid: true,
            trustScore: 95.0,
            verificationTime: 1500,
            checks: [],
            warnings: [],
            errors: [],
          },
        ],
        summary: {
          total: 1,
          passed: 1,
          failed: 0,
          warnings: 0,
        },
        processingTime: 2000,
      };

      mockInvoke.mockResolvedValueOnce(mockBatchResult);

      const result = await verificationAPI.batchVerify(
        [mockProofPack],
        mockConfig,
        mockVerifierInfo,
      );

      expect(result).toEqual(mockBatchResult);
      expect(mockInvoke).toHaveBeenCalledWith("batch_verify_proof_packs", {
        proofPacks: [mockProofPack],
        config: mockConfig,
        verifierInfo: mockVerifierInfo,
      });
    });
  });

  describe("generateMerkleProof", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce("initialized");
      await verificationAPI.initialize();
      vi.clearAllMocks();
    });

    it("should generate Merkle proof", async () => {
      const mockProof = {
        root: "merkle-root",
        leaf: "test-hash",
        path: [],
        index: 0,
      };

      mockInvoke.mockResolvedValueOnce(mockProof);

      const result = await verificationAPI.generateMerkleProof(
        "test-hash",
        "anchor-id",
      );

      expect(result).toEqual(mockProof);
      expect(mockInvoke).toHaveBeenCalledWith(
        "generate_verification_merkle_proof",
        {
          hash: "test-hash",
          anchorId: "anchor-id",
        },
      );
    });
  });

  describe("getVerificationAnalytics", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce("initialized");
      await verificationAPI.initialize();
      vi.clearAllMocks();
    });

    it("should get verification analytics", async () => {
      const mockAnalytics = {
        verificationId: "test-verification-id",
        proofPackId: "test-proof-pack-id",
        verifierInfo: mockVerifierInfo,
        timestamp: Date.now(),
        processingTime: 1500,
        resultSummary: {
          isValid: true,
          trustScore: 95.0,
          totalChecks: 5,
          passedChecks: 5,
          failedChecks: 0,
          warningChecks: 0,
        },
        checksPerformed: ["signature", "hash", "blockchain"],
      };

      mockInvoke.mockResolvedValueOnce(mockAnalytics);

      const result = await verificationAPI.getVerificationAnalytics(
        "test-verification-id",
      );

      expect(result).toEqual(mockAnalytics);
      expect(mockInvoke).toHaveBeenCalledWith("get_verification_analytics", {
        verificationId: "test-verification-id",
      });
    });
  });

  describe("getVerificationHistory", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce("initialized");
      await verificationAPI.initialize();
      vi.clearAllMocks();
    });

    it("should get verification history for proof pack", async () => {
      const mockHistory = [
        {
          verificationId: "verification-1",
          proofPackId: "test-proof-pack-id",
          verifierInfo: mockVerifierInfo,
          timestamp: Date.now(),
          processingTime: 1500,
          resultSummary: {
            isValid: true,
            trustScore: 95.0,
            totalChecks: 5,
            passedChecks: 5,
            failedChecks: 0,
            warningChecks: 0,
          },
          checksPerformed: ["signature", "hash"],
        },
      ];

      mockInvoke.mockResolvedValueOnce(mockHistory);

      const result =
        await verificationAPI.getVerificationHistory("test-proof-pack-id");

      expect(result).toEqual(mockHistory);
      expect(mockInvoke).toHaveBeenCalledWith(
        "get_proof_pack_verification_history",
        {
          proofPackId: "test-proof-pack-id",
        },
      );
    });
  });

  describe("getVerificationStats", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce("initialized");
      await verificationAPI.initialize();
      vi.clearAllMocks();
    });

    it("should get verification statistics", async () => {
      const mockStats = {
        periodStart: Date.now() - 86400000,
        periodEnd: Date.now(),
        totalVerifications: 10,
        successfulVerifications: 8,
        failedVerifications: 2,
        uniqueVerifiers: 5,
        uniqueProofPacks: 7,
        avgProcessingTime: 1500,
        avgTrustScore: 92.5,
      };

      mockInvoke.mockResolvedValueOnce(mockStats);

      const startTime = Date.now() - 86400000;
      const endTime = Date.now();
      const result = await verificationAPI.getVerificationStats(
        startTime,
        endTime,
      );

      expect(result).toEqual(mockStats);
      expect(mockInvoke).toHaveBeenCalledWith("get_verification_stats", {
        startTime,
        endTime,
      });
    });
  });

  describe("pollVerificationStatus", () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce("initialized");
      await verificationAPI.initialize();
      vi.clearAllMocks();
    });

    it("should poll until verification completes", async () => {
      const mockResult: VerificationResult = {
        isValid: true,
        trustScore: 95.0,
        verificationTime: 1500,
        checks: [],
        warnings: [],
        errors: [],
      };

      // First call returns in progress, second call returns completed
      mockInvoke
        .mockResolvedValueOnce({
          id: "test-verification-id",
          status: "pending",
          progress: 50.0,
          startTime: Date.now(),
          result: null,
        })
        .mockResolvedValueOnce({
          id: "test-verification-id",
          status: "completed",
          progress: 100.0,
          startTime: Date.now(),
          endTime: Date.now(),
          result: mockResult,
        });

      const result = await verificationAPI.pollVerificationStatus(
        "test-verification-id",
        100, // 100ms interval for faster test
        5000, // 5s timeout
      );

      expect(result).toEqual(mockResult);
      expect(mockInvoke).toHaveBeenCalledTimes(2);
    });

    it("should timeout if verification takes too long", async () => {
      mockInvoke.mockResolvedValue({
        id: "test-verification-id",
        status: "InProgress",
        progress: 50.0,
        startTime: Date.now(),
        result: null,
      });

      await expect(
        verificationAPI.pollVerificationStatus(
          "test-verification-id",
          100, // 100ms interval
          200, // 200ms timeout
        ),
      ).rejects.toThrow("Verification timeout");
    });

    it("should reject if verification fails", async () => {
      mockInvoke.mockResolvedValueOnce({
        id: "test-verification-id",
        status: "failed",
        progress: 0.0,
        startTime: Date.now(),
        endTime: Date.now(),
        result: null,
      });

      await expect(
        verificationAPI.pollVerificationStatus("test-verification-id"),
      ).rejects.toThrow("Verification failed");
    });
  });

  describe("getEngineStatus", () => {
    it("should get engine status without initialization", async () => {
      const mockStatus = {
        isInitialized: false,
        activeVerifications: 0,
        version: "1.0.0",
      };

      mockInvoke.mockResolvedValueOnce(mockStatus);

      const result = await verificationAPI.getEngineStatus();

      expect(result).toEqual(mockStatus);
      expect(mockInvoke).toHaveBeenCalledWith("get_verification_engine_status");
    });
  });
});
