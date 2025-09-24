// Redaction system types
export interface RedactionData {
  areas: RedactionArea[];
  proofs: RedactionProof[];
  redactedHash: string;
  originalHash: string;
  redactionTime: number;
}

export interface RedactionArea {
  id: string;
  type: "rectangle" | "freeform" | "text_pattern";
  coordinates?: Rectangle;
  pattern?: string;
  sessionId: string;
  timestamp: number;
  reason: string;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RedactionProof {
  areaId: string;
  commitmentHash: string;
  proof: string;
  algorithm: string;
}

export interface RedactionPlan {
  proofPackId: string;
  areas: RedactionArea[];
  estimatedImpact: RedactionImpact;
  warnings: string[];
}

export interface RedactionImpact {
  verificationCapability: "full" | "partial" | "limited";
  affectedSessions: string[];
  criticalDataRemoved: boolean;
}

export interface RedactedProofPack {
  originalId: string;
  redactedId: string;
  redactionData: RedactionData;
  partialVerificationCapable: boolean;
}

export interface PartialVerificationResult {
  verifiablePortions: number;
  redactedPortions: number;
  overallTrustScore: number;
  redactionIntegrity: boolean;
}
