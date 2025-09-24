export interface SessionConfig {
  captureScreen: boolean;
  captureKeystrokes: boolean;
  captureMouse: boolean;
  privacyFilters: string[];
  qualitySettings: string;
}

export enum SessionStatus {
  Active = 'active',
  Paused = 'paused',
  Completed = 'completed',
  Failed = 'failed',
}

export interface WorkSession {
  id: string;
  userId: string;
  startTime: number;
  endTime?: number;
  status: SessionStatus;
  captureConfig: SessionConfig;
  encryptedDataPath?: string;
  integrityHash?: string;
  tamperEvidence?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SessionIntegrityLog {
  id?: number;
  sessionId: string;
  eventType: string;
  eventData?: string;
  timestamp: number;
  signature?: string;
}

export interface CreateSessionRequest {
  userId: string;
  config: SessionConfig;
}

export interface SessionResponse {
  success: boolean;
  session?: WorkSession;
  error?: string;
}

export interface SessionListResponse {
  success: boolean;
  sessions: WorkSession[];
  error?: string;
}

export interface IntegrityResponse {
  success: boolean;
  isValid: boolean;
  logs: SessionIntegrityLog[];
  error?: string;
}

export interface StatusResponse {
  success: boolean;
  error?: string;
}