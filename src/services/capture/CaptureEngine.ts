// Capture Engine interface
import type {
  EncryptedSessionData,
  SessionConfig,
  SessionId,
  SessionStatus,
} from "../../types";

export interface CaptureEngine {
  startSession(config: SessionConfig): Promise<SessionId>;
  stopSession(sessionId: SessionId): Promise<EncryptedSessionData>;
  pauseSession(sessionId: SessionId): Promise<void>;
  resumeSession(sessionId: SessionId): Promise<void>;
  getSessionStatus(sessionId: SessionId): SessionStatus;
  getSupportedFeatures(): CaptureFeatures;
}

export interface CaptureFeatures {
  screenCapture: boolean;
  keystrokeCapture: boolean;
  mouseCapture: boolean;
  applicationTracking: boolean;
  hardwareAcceleration: boolean;
  privacyFiltering: boolean;
}
