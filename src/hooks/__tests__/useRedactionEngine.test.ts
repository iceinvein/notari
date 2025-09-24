import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProofPack, RedactionArea, RedactionPlan } from "../../types";

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

// Import after mocking
const { useRedactionEngine } = await import("../useRedactionEngine");

describe("useRedactionEngine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
  });

  const mockProofPack: ProofPack = {
    id: "test-pack-123",
    version: "1.0",
    metadata: {
      creator: "test-user",
      created: Date.now(),
      sessions: ["session1"],
      totalDuration: 3600,
    },
    evidence: {
      sessions: [
        {
          sessionId: "session1",
          encryptedContent: new ArrayBuffer(0),
          contentHash: "hash1",
          timestamp: Date.now(),
        },
      ],
      aiAnalysis: [],
      timeline: [],
      systemContext: {
        operatingSystem: "macOS",
        platform: "darwin",
        deviceId: "test-device",
        timezone: "UTC",
        locale: "en-US",
        screenResolution: { width: 1920, height: 1080 },
      },
    },
    verification: {
      integrityHash: "test-integrity-hash",
      signatures: [],
      timestamp: Date.now(),
      version: "1.0",
    },
  };

  const mockRedactionArea: RedactionArea = {
    id: "area-123",
    type: "rectangle",
    coordinates: { x: 10, y: 10, width: 100, height: 50 },
    sessionId: "session1",
    timestamp: Date.now(),
    reason: "Personal information",
  };

  describe("markForRedaction", () => {
    it("successfully creates redaction plan", async () => {
      const mockPlan: RedactionPlan = {
        proofPackId: "test-pack-123",
        areas: [mockRedactionArea],
        estimatedImpact: {
          verificationCapability: "partial",
          affectedSessions: ["session1"],
          criticalDataRemoved: false,
        },
        warnings: [],
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockPlan,
      });

      const { result } = renderHook(() => useRedactionEngine());

      const plan = await result.current.markForRedaction(mockProofPack, [
        mockRedactionArea,
      ]);

      expect(mockInvoke).toHaveBeenCalledWith("mark_for_redaction", {
        proofPackId: "test-pack-123",
        areas: [
          {
            ...mockRedactionArea,
            coordinates: {
              x: 10,
              y: 10,
              width: 100,
              height: 50,
            },
          },
        ],
      });

      expect(plan).toEqual(mockPlan);
    });

    it("throws error when backend fails", async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: "Backend error",
      });

      const { result } = renderHook(() => useRedactionEngine());

      await expect(
        result.current.markForRedaction(mockProofPack, [mockRedactionArea]),
      ).rejects.toThrow("Backend error");
    });
  });

  describe("applyRedactions", () => {
    it("successfully applies redactions", async () => {
      const mockPlan: RedactionPlan = {
        proofPackId: "test-pack-123",
        areas: [mockRedactionArea],
        estimatedImpact: {
          verificationCapability: "partial",
          affectedSessions: ["session1"],
          criticalDataRemoved: false,
        },
        warnings: [],
      };

      const mockRedactedPack = {
        originalId: "test-pack-123",
        redactedId: "redacted-test-pack-123",
        redactionData: {
          areas: [mockRedactionArea],
          proofs: [],
          redactedHash: "hash1",
          originalHash: "hash2",
          redactionTime: Date.now(),
        },
        partialVerificationCapable: true,
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockRedactedPack,
      });

      const { result } = renderHook(() => useRedactionEngine());

      const redactedPack = await result.current.applyRedactions(mockPlan);

      expect(mockInvoke).toHaveBeenCalledWith("apply_redactions", {
        plan: expect.objectContaining({
          proofPackId: "test-pack-123",
          areas: expect.arrayContaining([
            expect.objectContaining({
              id: "area-123",
              coordinates: {
                x: 10,
                y: 10,
                width: 100,
                height: 50,
              },
            }),
          ]),
        }),
      });

      expect(redactedPack).toEqual(mockRedactedPack);
    });
  });

  describe("generateRedactionProof", () => {
    it("generates proofs for redaction areas", async () => {
      const mockProofs = [
        {
          areaId: "area-123",
          commitmentHash: "commitment-hash",
          proof: "proof-data",
          algorithm: "Pedersen",
        },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockProofs,
      });

      const { result } = renderHook(() => useRedactionEngine());

      const proofs = await result.current.generateRedactionProof([
        mockRedactionArea,
      ]);

      expect(mockInvoke).toHaveBeenCalledWith("generate_redaction_proof", {
        areas: expect.arrayContaining([
          expect.objectContaining({
            id: "area-123",
          }),
        ]),
      });

      expect(proofs).toEqual(mockProofs);
    });
  });

  describe("validateRedactionIntegrity", () => {
    it("validates redacted pack integrity", async () => {
      const mockRedactedPack = {
        originalId: "test-pack-123",
        redactedId: "redacted-test-pack-123",
        redactionData: {
          areas: [mockRedactionArea],
          proofs: [],
          redactedHash: "hash1",
          originalHash: "hash2",
          redactionTime: Date.now(),
        },
        partialVerificationCapable: true,
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: true,
      });

      const { result } = renderHook(() => useRedactionEngine());

      const isValid =
        await result.current.validateRedactionIntegrity(mockRedactedPack);

      expect(mockInvoke).toHaveBeenCalledWith("validate_redaction_integrity", {
        redactedPack: expect.objectContaining({
          originalId: "test-pack-123",
          redactedId: "redacted-test-pack-123",
        }),
      });

      expect(isValid).toBe(true);
    });

    it("returns false for invalid pack", async () => {
      const mockRedactedPack = {
        originalId: "test-pack-123",
        redactedId: "redacted-test-pack-123",
        redactionData: {
          areas: [],
          proofs: [],
          redactedHash: "hash1",
          originalHash: "hash2",
          redactionTime: Date.now(),
        },
        partialVerificationCapable: true,
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: false,
      });

      const { result } = renderHook(() => useRedactionEngine());

      const isValid =
        await result.current.validateRedactionIntegrity(mockRedactedPack);

      expect(isValid).toBe(false);
    });
  });

  describe("verifyRedactedPack", () => {
    it("verifies redacted pack and returns partial verification result", async () => {
      const mockRedactedPack = {
        originalId: "test-pack-123",
        redactedId: "redacted-test-pack-123",
        redactionData: {
          areas: [mockRedactionArea],
          proofs: [],
          redactedHash: "hash1",
          originalHash: "hash2",
          redactionTime: Date.now(),
        },
        partialVerificationCapable: true,
      };

      const mockVerificationResult = {
        verifiablePortions: 1,
        redactedPortions: 1,
        overallTrustScore: 0.8,
        redactionIntegrity: true,
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockVerificationResult,
      });

      const { result } = renderHook(() => useRedactionEngine());

      const verificationResult =
        await result.current.verifyRedactedPack(mockRedactedPack);

      expect(mockInvoke).toHaveBeenCalledWith("verify_redacted_pack", {
        redactedPack: expect.objectContaining({
          originalId: "test-pack-123",
        }),
      });

      expect(verificationResult).toEqual(mockVerificationResult);
    });
  });
});
