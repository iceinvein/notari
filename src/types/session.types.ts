// Session management types
export type SessionId = string;
export type SessionStatus = "active" | "paused" | "completed" | "failed";

export interface SessionConfig {
  captureScreen: boolean;
  captureKeystrokes: boolean;
  captureMouse: boolean;
  privacyFilters: PrivacyFilter[];
  qualitySettings: CaptureQuality;
}

export interface PrivacyFilter {
  type: "application" | "window" | "region";
  pattern: string;
  action: "exclude" | "blur" | "redact";
}

export interface CaptureQuality {
  screenResolution: "full" | "half" | "quarter";
  frameRate: number;
  compressionLevel: number;
}

export interface WorkSession {
  id: SessionId;
  userId: string;
  startTime: number;
  endTime?: number;
  status: SessionStatus;
  captureConfig: SessionConfig;
  encryptedData: EncryptedBlob;
  checksums: string[];
}

export interface EncryptedBlob {
  data: ArrayBuffer;
  iv: ArrayBuffer;
  keyId: string;
  algorithm: string;
}

export interface TimeRange {
  start: number;
  end: number;
}
