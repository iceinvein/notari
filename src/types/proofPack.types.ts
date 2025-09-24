// Proof Pack types
import type { AIAnalysis } from "./ai.types";
import type { RedactionData } from "./redaction.types";
import type { SessionId } from "./session.types";
import type { VerificationData } from "./verification.types";

export interface ProofPack {
  id: string;
  version: string;
  metadata: ProofPackMetadata;
  evidence: Evidence;
  verification: VerificationData;
  redactions?: RedactionData;
}

export interface ProofPackMetadata {
  creator: string;
  created: number;
  sessions: SessionId[];
  totalDuration: number;
  title?: string;
  description?: string;
  tags?: string[];
}

export interface Evidence {
  sessions: EncryptedSessionData[];
  aiAnalysis: AIAnalysis[];
  timeline: TimelineEvent[];
  systemContext: SystemContext;
}

export interface EncryptedSessionData {
  sessionId: SessionId;
  encryptedContent: ArrayBuffer;
  contentHash: string;
  timestamp: number;
}

export interface TimelineEvent {
  timestamp: number;
  type: "keystroke" | "mouse" | "screen_change" | "application_switch";
  data: Record<string, unknown>;
  sessionId: SessionId;
}

export interface SystemContext {
  operatingSystem: string;
  platform: string;
  deviceId: string;
  timezone: string;
  locale: string;
  screenResolution: {
    width: number;
    height: number;
  };
}
