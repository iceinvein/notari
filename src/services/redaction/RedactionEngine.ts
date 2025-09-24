// Redaction Engine interface
import type {
  PartialVerificationResult,
  ProofPack,
  RedactedProofPack,
  RedactionArea,
  RedactionPlan,
  RedactionProof,
} from "../../types";

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
