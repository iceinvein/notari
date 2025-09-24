import { invoke } from '@tauri-apps/api/core';
import {
  SessionConfig,
  WorkSession,
  SessionStatus,
  CreateSessionRequest,
  SessionResponse,
  SessionListResponse,
  IntegrityResponse,
  StatusResponse,
  SessionIntegrityLog,
} from '../../types/session.types';

export class SessionManager {
  /**
   * Create a new work session
   */
  async createSession(userId: string, config: SessionConfig): Promise<WorkSession> {
    const request: CreateSessionRequest = { userId, config };
    const response: SessionResponse = await invoke('create_session', { request });
    
    if (!response.success || !response.session) {
      throw new Error(response.error || 'Failed to create session');
    }
    
    return response.session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<WorkSession | null> {
    const response: SessionResponse = await invoke('get_session', { sessionId });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to get session');
    }
    
    return response.session || null;
  }

  /**
   * Pause an active session
   */
  async pauseSession(sessionId: string): Promise<void> {
    const response: StatusResponse = await invoke('pause_session', { sessionId });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to pause session');
    }
  }

  /**
   * Resume a paused session
   */
  async resumeSession(sessionId: string): Promise<void> {
    const response: StatusResponse = await invoke('resume_session', { sessionId });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to resume session');
    }
  }

  /**
   * Stop a session (mark as completed)
   */
  async stopSession(sessionId: string): Promise<void> {
    const response: StatusResponse = await invoke('stop_session', { sessionId });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to stop session');
    }
  }

  /**
   * Mark a session as failed
   */
  async failSession(sessionId: string, reason: string): Promise<void> {
    const response: StatusResponse = await invoke('fail_session', { sessionId, reason });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to mark session as failed');
    }
  }

  /**
   * Store encrypted session data
   */
  async storeSessionData(sessionId: string, data: Uint8Array, filePath: string): Promise<void> {
    const response: StatusResponse = await invoke('store_session_data', {
      sessionId,
      data: Array.from(data),
      filePath,
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to store session data');
    }
  }

  /**
   * Verify session integrity
   */
  async verifySessionIntegrity(sessionId: string): Promise<{
    isValid: boolean;
    logs: SessionIntegrityLog[];
  }> {
    const response: IntegrityResponse = await invoke('verify_session_integrity', { sessionId });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to verify session integrity');
    }
    
    return {
      isValid: response.isValid,
      logs: response.logs,
    };
  }

  /**
   * Get sessions for a user
   */
  async getUserSessions(userId: string, limit?: number): Promise<WorkSession[]> {
    const response: SessionListResponse = await invoke('get_user_sessions', {
      userId,
      limit: limit || null,
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to get user sessions');
    }
    
    return response.sessions;
  }

  /**
   * Mark session as tampered
   */
  async markSessionTampered(sessionId: string, evidence: string): Promise<void> {
    const response: StatusResponse = await invoke('mark_session_tampered', {
      sessionId,
      evidence,
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to mark session as tampered');
    }
  }

  /**
   * Get active sessions for a user
   */
  async getActiveSessions(userId: string): Promise<WorkSession[]> {
    const sessions = await this.getUserSessions(userId);
    return sessions.filter(session => session.status === SessionStatus.Active);
  }

  /**
   * Get session duration in milliseconds
   */
  getSessionDuration(session: WorkSession): number {
    const endTime = session.endTime || Date.now();
    return endTime - session.startTime;
  }

  /**
   * Check if session has integrity issues
   */
  hasIntegrityIssues(session: WorkSession): boolean {
    return !!session.tamperEvidence;
  }

  /**
   * Format session duration for display
   */
  formatDuration(durationMs: number): string {
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  /**
   * Get session status display text
   */
  getStatusDisplay(status: SessionStatus): string {
    switch (status) {
      case SessionStatus.Active:
        return 'Recording';
      case SessionStatus.Paused:
        return 'Paused';
      case SessionStatus.Completed:
        return 'Completed';
      case SessionStatus.Failed:
        return 'Failed';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get session status color for UI
   */
  getStatusColor(status: SessionStatus): string {
    switch (status) {
      case SessionStatus.Active:
        return 'green';
      case SessionStatus.Paused:
        return 'yellow';
      case SessionStatus.Completed:
        return 'blue';
      case SessionStatus.Failed:
        return 'red';
      default:
        return 'gray';
    }
  }
}