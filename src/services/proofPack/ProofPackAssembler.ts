// Proof Pack Assembler interface
import type { ProofPack, SessionId } from "../../types";

export interface ProofPackAssembler {
  createProofPack(
    sessions: SessionId[],
    config: PackConfig,
  ): Promise<ProofPack>;
  exportToPDF(proofPack: ProofPack): Promise<ArrayBuffer>;
  exportToJSON(proofPack: ProofPack): Promise<string>;
  validateIntegrity(proofPack: ProofPack): Promise<ProofPackValidationResult>;
  getPackageInfo(proofPackId: string): Promise<PackageInfo>;
}

export interface PackConfig {
  title?: string;
  description?: string;
  includeScreenshots: boolean;
  includeTimeline: boolean;
  includeAIAnalysis: boolean;
  compressionLevel: number;
}

export interface ProofPackValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  integrityScore: number;
}

export interface PackageInfo {
  id: string;
  size: number;
  sessionCount: number;
  duration: number;
  created: number;
}
