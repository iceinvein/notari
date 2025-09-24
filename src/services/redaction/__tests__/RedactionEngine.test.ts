import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProofPack, RedactionArea, RedactionPlan } from '../../../types';

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

// Mock crypto manager
vi.mock('../../crypto/CryptoManager', () => ({
  cryptoManager: {
    hash: vi.fn().mockResolvedValue({
      hash: 'mocked-hash-value',
      algorithm: 'SHA-256',
      timestamp: Date.now(),
    }),
  },
}));

// Import after mocking
const { TauriRedactionEngine } = await import('../RedactionEngine');

describe('TauriRedactionEngine', () => {
  let engine: InstanceType<typeof TauriRedactionEngine>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
    engine = new TauriRedactionEngine();
  });

  const mockProofPack: ProofPack = {
    id: 'test-pack-123',
    version: '1.0',
    metadata: {
      creator: 'test-user',
      created: Date.now(),
      sessions: ['session1', 'session2'],
      totalDuration: 3600,
    },
    evidence: {
      sessions: [
        {
          sessionId: 'session1',
          encryptedContent: new ArrayBuffer(0),
          contentHash: 'hash1',
          timestamp: Date.now(),
        },
        {
          sessionId: 'session2',
          encryptedContent: new ArrayBuffer(0),
          contentHash: 'hash2',
          timestamp: Date.now(),
        },
      ],
      aiAnalysis: [],
      timeline: [],
      systemContext: {
        operatingSystem: 'macOS',
        platform: 'darwin',
        deviceId: 'test-device',
        timezone: 'UTC',
        locale: 'en-US',
        screenResolution: { width: 1920, height: 1080 },
      },
    },
    verification: {
      integrityHash: 'test-integrity-hash',
      signatures: [],
      timestamp: Date.now(),
      version: '1.0',
    },
  };

  const mockRedactionArea: RedactionArea = {
    id: 'area-123',
    type: 'rectangle',
    coordinates: { x: 10, y: 10, width: 100, height: 50 },
    sessionId: 'session1',
    timestamp: Date.now(),
    reason: 'Personal information',
  };

  describe('markForRedaction', () => {
    it('creates redaction plan with impact analysis', async () => {
      const plan = await engine.markForRedaction(mockProofPack, [mockRedactionArea]);

      expect(plan.proofPackId).toBe('test-pack-123');
      expect(plan.areas).toHaveLength(1);
      expect(plan.areas[0]).toEqual(mockRedactionArea);
      expect(plan.estimatedImpact.verificationCapability).toBe('partial');
      expect(plan.estimatedImpact.affectedSessions).toContain('session1');
      expect(plan.warnings).toHaveLength(0);
    });

    it('detects limited verification capability with many redactions', async () => {
      const manyAreas = Array.from({ length: 5 }, (_, i) => ({
        ...mockRedactionArea,
        id: `area-${i}`,
        sessionId: `session${i % 2 + 1}`,
      }));

      const plan = await engine.markForRedaction(mockProofPack, manyAreas);

      expect(plan.estimatedImpact.verificationCapability).toBe('limited');
      expect(plan.warnings).toContain('All sessions will be affected by redactions');
    });

    it('detects critical data removal', async () => {
      const largeArea: RedactionArea = {
        ...mockRedactionArea,
        coordinates: { x: 0, y: 0, width: 1000, height: 1000 },
        reason: 'Critical information',
      };

      const plan = await engine.markForRedaction(mockProofPack, [largeArea]);

      expect(plan.estimatedImpact.criticalDataRemoved).toBe(true);
      expect(plan.warnings).toContain('Redacting large or critical areas may affect proof validity');
    });
  });

  describe('applyRedactions', () => {
    it('applies redactions successfully', async () => {
      const plan: RedactionPlan = {
        proofPackId: 'test-pack-123',
        areas: [mockRedactionArea],
        estimatedImpact: {
          verificationCapability: 'partial',
          affectedSessions: ['session1'],
          criticalDataRemoved: false,
        },
        warnings: [],
      };

      const mockRedactedPack = {
        originalId: 'test-pack-123',
        redactedId: 'redacted-test-pack-123',
        redactionData: {
          areas: [mockRedactionArea],
          proofs: [],
          redactedHash: 'hash1',
          originalHash: 'hash2',
          redactionTime: Date.now(),
        },
        partialVerificationCapable: true,
      };

      mockInvoke.mockResolvedValue({
        success: true,
        data: mockRedactedPack,
      });

      const result = await engine.applyRedactions(plan);

      expect(result.originalId).toBe('test-pack-123');
      expect(result.partialVerificationCapable).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith('apply_redactions_backend', expect.any(Object));
    });

    it('throws error when backend fails', async () => {
      const plan: RedactionPlan = {
        proofPackId: 'test-pack-123',
        areas: [mockRedactionArea],
        estimatedImpact: {
          verificationCapability: 'partial',
          affectedSessions: ['session1'],
          criticalDataRemoved: false,
        },
        warnings: [],
      };

      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Backend error',
      });

      await expect(engine.applyRedactions(plan)).rejects.toThrow('Failed to apply redactions');
    });
  });

  describe('generateRedactionProof', () => {
    it('generates proofs for all areas', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        data: 'proof-data',
      });

      const proofs = await engine.generateRedactionProof([mockRedactionArea]);

      expect(proofs).toHaveLength(1);
      expect(proofs[0].areaId).toBe('area-123');
      expect(proofs[0].algorithm).toBe('Pedersen');
      expect(proofs[0].commitmentHash).toBe('mocked-hash-value');
    });

    it('handles proof generation failure', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Proof generation failed',
      });

      await expect(engine.generateRedactionProof([mockRedactionArea]))
        .rejects.toThrow('Failed to generate proof for area area-123');
    });
  });

  describe('validateRedactionIntegrity', () => {
    it('validates redacted pack integrity', async () => {
      const mockRedactedPack = {
        originalId: 'test-pack-123',
        redactedId: 'redacted-test-pack-123',
        redactionData: {
          areas: [mockRedactionArea],
          proofs: [{
            areaId: 'area-123',
            commitmentHash: 'hash',
            proof: 'proof',
            algorithm: 'Pedersen',
          }],
          redactedHash: 'a'.repeat(64),
          originalHash: 'b'.repeat(64),
          redactionTime: Date.now(),
        },
        partialVerificationCapable: true,
      };

      mockInvoke
        .mockResolvedValueOnce({ success: true, data: true }) // verify_commitment_proof
        .mockResolvedValueOnce({ success: true, data: true }); // validate_redaction_integrity_backend

      const isValid = await engine.validateRedactionIntegrity(mockRedactedPack);

      expect(isValid).toBe(true);
    });

    it('returns false for invalid commitment proofs', async () => {
      const mockRedactedPack = {
        originalId: 'test-pack-123',
        redactedId: 'redacted-test-pack-123',
        redactionData: {
          areas: [mockRedactionArea],
          proofs: [{
            areaId: 'area-123',
            commitmentHash: 'hash',
            proof: 'proof',
            algorithm: 'Pedersen',
          }],
          redactedHash: 'a'.repeat(64),
          originalHash: 'b'.repeat(64),
          redactionTime: Date.now(),
        },
        partialVerificationCapable: true,
      };

      mockInvoke.mockResolvedValue({ success: true, data: false });

      const isValid = await engine.validateRedactionIntegrity(mockRedactedPack);

      expect(isValid).toBe(false);
    });

    it('returns false for invalid hash format', async () => {
      const mockRedactedPack = {
        originalId: 'test-pack-123',
        redactedId: 'redacted-test-pack-123',
        redactionData: {
          areas: [mockRedactionArea],
          proofs: [],
          redactedHash: 'invalid-hash',
          originalHash: 'b'.repeat(64),
          redactionTime: Date.now(),
        },
        partialVerificationCapable: true,
      };

      const isValid = await engine.validateRedactionIntegrity(mockRedactedPack);

      expect(isValid).toBe(false);
    });
  });

  describe('verifyRedactedPack', () => {
    it('verifies redacted pack and calculates trust score', async () => {
      const mockRedactedPack = {
        originalId: 'test-pack-123',
        redactedId: 'redacted-test-pack-123',
        redactionData: {
          areas: [mockRedactionArea],
          proofs: [{
            areaId: 'area-123',
            commitmentHash: 'hash',
            proof: 'proof',
            algorithm: 'Pedersen',
          }],
          redactedHash: 'a'.repeat(64),
          originalHash: 'b'.repeat(64),
          redactionTime: Date.now(),
        },
        partialVerificationCapable: true,
      };

      mockInvoke
        .mockResolvedValueOnce({ success: true, data: true }) // verify_commitment_proof (integrity)
        .mockResolvedValueOnce({ success: true, data: true }) // validate_redaction_integrity_backend
        .mockResolvedValueOnce({ success: true, data: true }); // verify_commitment_proof (verification)

      const result = await engine.verifyRedactedPack(mockRedactedPack);

      expect(result.verifiablePortions).toBe(1);
      expect(result.redactedPortions).toBe(1);
      expect(result.overallTrustScore).toBeGreaterThan(0.3);
      expect(result.redactionIntegrity).toBe(true);
    });

    it('returns low trust score for failed integrity check', async () => {
      const mockRedactedPack = {
        originalId: 'test-pack-123',
        redactedId: 'redacted-test-pack-123',
        redactionData: {
          areas: [mockRedactionArea],
          proofs: [],
          redactedHash: 'invalid',
          originalHash: 'b'.repeat(64),
          redactionTime: Date.now(),
        },
        partialVerificationCapable: true,
      };

      const result = await engine.verifyRedactedPack(mockRedactedPack);

      expect(result.verifiablePortions).toBe(0);
      expect(result.overallTrustScore).toBe(0);
      expect(result.redactionIntegrity).toBe(false);
    });
  });

  describe('getCapabilities', () => {
    it('returns redaction capabilities', () => {
      const capabilities = engine.getCapabilities();

      expect(capabilities.supportedTypes).toContain('rectangle');
      expect(capabilities.supportedTypes).toContain('freeform');
      expect(capabilities.supportedTypes).toContain('text_pattern');
      expect(capabilities.zeroKnowledgeProofs).toBe(true);
      expect(capabilities.partialVerification).toBe(true);
      expect(capabilities.commitmentSchemes).toContain('Pedersen');
      expect(capabilities.commitmentSchemes).toContain('KZG');
    });
  });
});