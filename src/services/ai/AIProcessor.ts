// AI Processor interface
import type {
  AIAnalysis,
  AnomalyFlag,
  EncryptedSessionData,
  WorkSummary,
} from "../../types";

export interface AIProcessor {
  analyzeSession(sessionData: EncryptedSessionData): Promise<AIAnalysis>;
  generateSummary(analysis: AIAnalysis): Promise<WorkSummary>;
  detectAnomalies(sessionData: EncryptedSessionData): Promise<AnomalyFlag[]>;
  updateModels(): Promise<void>;
  getModelInfo(): ModelInfo;
}

export interface ModelInfo {
  version: string;
  capabilities: string[];
  lastUpdated: number;
  accuracy: number;
  supportedContentTypes: string[];
}
