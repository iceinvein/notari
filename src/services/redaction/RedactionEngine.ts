import { invoke } from '@tauri-apps/api/core';
import type {
  PartialVerificationResult,
  ProofPack,
  RedactedProofPack,
  RedactionArea,
  RedactionData,
  RedactionPlan,
  RedactionProof,
  RedactionImpact,

} from "../../types";
import { cryptoManager } from '../crypto/CryptoManager';

export interface RedactionEngine {
  markForRedaction(
    proofPack: ProofPack,
    areas: RedactionArea[],
  ): Promise<RedactionPlan>;
  applyRedactions(plan: RedactionPlan): Promise<RedactedProofPack>;
  verifyRedactedPack(
    pack: RedactedProofPack,
  ): Promise<PartialVerificationResult>;
  generateRedactionProof(areas: RedactionArea[]): Promise<RedactionProof[]>;
  validateRedactionIntegrity(pack: RedactedProofPack): Promise<boolean>;
}

export interface RedactionCapabilities {
  supportedTypes: string[];
  zeroKnowledgeProofs: boolean;
  partialVerification: boolean;
  commitmentSchemes: string[];
}

interface RedactionResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export class TauriRedactionEngine implements RedactionEngine {
  private readonly commitmentSchemes = ['Pedersen', 'KZG'];

  async markForRedaction(
    proofPack: ProofPack,
    areas: RedactionArea[],
  ): Promise<RedactionPlan> {
    // Analyze the impact of redacting these areas
    const estimatedImpact = await this.analyzeRedactionImpact(proofPack, areas);
    
    // Generate warnings based on the analysis
    const warnings = this.generateRedactionWarnings(proofPack, areas, estimatedImpact);

    const plan: RedactionPlan = {
      proofPackId: proofPack.id,
      areas,
      estimatedImpact,
      warnings,
    };

    return plan;
  }

  async applyRedactions(plan: RedactionPlan): Promise<RedactedProofPack> {
    try {
      // Generate redaction proofs for all areas
      const proofs = await this.generateRedactionProof(plan.areas);
      
      // Create separate hashes for redacted and non-redacted portions
      const { redactedHash, originalHash } = await this.generateSeparateHashes(plan);
      
      // Create redaction data
      const redactionData: RedactionData = {
        areas: plan.areas,
        proofs,
        redactedHash,
        originalHash,
        redactionTime: Date.now(),
      };

      // Generate new ID for redacted pack
      const redactedId = `redacted-${plan.proofPackId}-${Date.now()}`;

      // Call Rust backend to perform the actual redaction
      const response: RedactionResponse<RedactedProofPack> = await invoke('apply_redactions_backend', {
        plan: {
          proofPackId: plan.proofPackId,
          areas: plan.areas,
          estimatedImpact: plan.estimatedImpact,
          warnings: plan.warnings,
        },
        redactionData: {
          ...redactionData,
          redactedId,
        },
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to apply redactions in backend');
      }

      return response.data;
    } catch (error) {
      throw new Error(`Failed to apply redactions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async verifyRedactedPack(
    pack: RedactedProofPack,
  ): Promise<PartialVerificationResult> {
    try {
      // Verify redaction integrity first
      const integrityValid = await this.validateRedactionIntegrity(pack);
      
      if (!integrityValid) {
        return {
          verifiablePortions: 0,
          redactedPortions: pack.redactionData.areas.length,
          overallTrustScore: 0,
          redactionIntegrity: false,
        };
      }

      // Calculate verification metrics
      const totalAreas = pack.redactionData.areas.length;
      const verifiableAreas = pack.redactionData.proofs.filter(proof => 
        this.verifyCommitmentProof(proof)
      ).length;

      const trustScore = pack.partialVerificationCapable 
        ? Math.max(0.3, (verifiableAreas / Math.max(totalAreas, 1)) * 0.8)
        : 0.1;

      return {
        verifiablePortions: verifiableAreas,
        redactedPortions: totalAreas,
        overallTrustScore: trustScore,
        redactionIntegrity: true,
      };
    } catch (error) {
      throw new Error(`Failed to verify redacted pack: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateRedactionProof(areas: RedactionArea[]): Promise<RedactionProof[]> {
    const proofs: RedactionProof[] = [];

    for (const area of areas) {
      try {
        // Generate commitment hash for the area
        const areaData = this.serializeRedactionArea(area);
        const hashResult = await cryptoManager.hash(areaData, 'SHA-256');
        
        // Generate zero-knowledge proof using Rust backend
        const response: RedactionResponse<string> = await invoke('generate_commitment_proof', {
          areaId: area.id,
          areaData: Array.from(new Uint8Array(areaData)),
          algorithm: 'Pedersen',
        });

        if (!response.success || !response.data) {
          throw new Error(response.error || 'Failed to generate commitment proof');
        }

        const proof: RedactionProof = {
          areaId: area.id,
          commitmentHash: hashResult.hash,
          proof: response.data,
          algorithm: 'Pedersen',
        };

        proofs.push(proof);
      } catch (error) {
        throw new Error(`Failed to generate proof for area ${area.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return proofs;
  }

  async validateRedactionIntegrity(pack: RedactedProofPack): Promise<boolean> {
    try {
      // Verify all redaction proofs
      for (const proof of pack.redactionData.proofs) {
        const isValid = await this.verifyCommitmentProof(proof);
        if (!isValid) {
          return false;
        }
      }

      // Verify hash integrity
      const hashValid = await this.verifyHashIntegrity(pack.redactionData);
      if (!hashValid) {
        return false;
      }

      // Call Rust backend for additional integrity checks
      const response: RedactionResponse<boolean> = await invoke('validate_redaction_integrity_backend', {
        redactionData: pack.redactionData,
      });

      return response.success && (response.data || false);
    } catch (error) {
      console.error('Redaction integrity validation failed:', error);
      return false;
    }
  }

  getCapabilities(): RedactionCapabilities {
    return {
      supportedTypes: ['rectangle', 'freeform', 'text_pattern'],
      zeroKnowledgeProofs: true,
      partialVerification: true,
      commitmentSchemes: this.commitmentSchemes,
    };
  }

  private async analyzeRedactionImpact(
    proofPack: ProofPack,
    areas: RedactionArea[]
  ): Promise<RedactionImpact> {
    const affectedSessions = [...new Set(areas.map(area => area.sessionId))];
    const totalSessions = proofPack.evidence.sessions.length;
    
    // Determine verification capability based on redaction coverage
    let verificationCapability: 'full' | 'partial' | 'limited';
    const redactionCoverage = affectedSessions.length / totalSessions;
    
    if (redactionCoverage < 0.2) {
      verificationCapability = 'full';
    } else if (redactionCoverage < 0.6) {
      verificationCapability = 'partial';
    } else {
      verificationCapability = 'limited';
    }

    // Check if critical data is being removed
    const criticalDataRemoved = areas.some(area => 
      area.reason?.toLowerCase().includes('critical') ||
      area.reason?.toLowerCase().includes('essential') ||
      (area.coordinates && area.coordinates.width * area.coordinates.height > 50000) // Large areas
    );

    return {
      verificationCapability,
      affectedSessions,
      criticalDataRemoved,
    };
  }

  private generateRedactionWarnings(
    proofPack: ProofPack,
    areas: RedactionArea[],
    impact: RedactionImpact
  ): string[] {
    const warnings: string[] = [];

    if (impact.verificationCapability === 'limited') {
      warnings.push('Extensive redactions may significantly limit verification capabilities');
    }

    if (impact.criticalDataRemoved) {
      warnings.push('Redacting large or critical areas may affect proof validity');
    }

    if (impact.affectedSessions.length === proofPack.evidence.sessions.length) {
      warnings.push('All sessions will be affected by redactions');
    }

    const largeAreas = areas.filter(area => 
      area.coordinates && area.coordinates.width * area.coordinates.height > 100000
    );
    
    if (largeAreas.length > 0) {
      warnings.push(`${largeAreas.length} large redaction area(s) detected`);
    }

    return warnings;
  }

  private async generateSeparateHashes(plan: RedactionPlan): Promise<{
    redactedHash: string;
    originalHash: string;
  }> {
    // Serialize the redaction plan for hashing
    const planData = new TextEncoder().encode(JSON.stringify({
      proofPackId: plan.proofPackId,
      areas: plan.areas,
      timestamp: Date.now(),
    }));

    const originalHashResult = await cryptoManager.hash(planData, 'SHA-256');
    
    // Create redacted version hash (areas replaced with placeholders)
    const redactedPlanData = new TextEncoder().encode(JSON.stringify({
      proofPackId: plan.proofPackId,
      areas: plan.areas.map(area => ({
        ...area,
        coordinates: area.coordinates ? { x: 0, y: 0, width: 0, height: 0 } : null,
      })),
      timestamp: Date.now(),
    }));

    const redactedHashResult = await cryptoManager.hash(redactedPlanData, 'SHA-256');

    return {
      originalHash: originalHashResult.hash,
      redactedHash: redactedHashResult.hash,
    };
  }

  private serializeRedactionArea(area: RedactionArea): ArrayBuffer {
    const serialized = JSON.stringify({
      id: area.id,
      type: area.type,
      coordinates: area.coordinates,
      sessionId: area.sessionId,
      timestamp: area.timestamp,
      reason: area.reason,
    });
    
    return new TextEncoder().encode(serialized).buffer;
  }

  private async verifyCommitmentProof(proof: RedactionProof): Promise<boolean> {
    try {
      const response: RedactionResponse<boolean> = await invoke('verify_commitment_proof', {
        proof: {
          areaId: proof.areaId,
          commitmentHash: proof.commitmentHash,
          proof: proof.proof,
          algorithm: proof.algorithm,
        },
      });

      return response.success && (response.data || false);
    } catch (error) {
      console.error(`Failed to verify commitment proof for area ${proof.areaId}:`, error);
      return false;
    }
  }

  private async verifyHashIntegrity(redactionData: RedactionData): Promise<boolean> {
    try {
      // Verify that the hashes are consistent
      const currentTime = Date.now();
      const timeDiff = currentTime - redactionData.redactionTime;
      
      // Allow some time tolerance (5 minutes)
      if (timeDiff > 5 * 60 * 1000) {
        console.warn('Redaction data is older than expected');
      }

      // Verify hash format
      const hashPattern = /^[a-f0-9]{64}$/i;
      return hashPattern.test(redactionData.originalHash) && 
             hashPattern.test(redactionData.redactedHash);
    } catch (error) {
      console.error('Hash integrity verification failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const redactionEngine = new TauriRedactionEngine();
