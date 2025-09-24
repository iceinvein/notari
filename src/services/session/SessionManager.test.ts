import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from './SessionManager';
import { SessionConfig, SessionStatus, WorkSession } from '../../types/session.types';

// Mock Tauri invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const { invoke } = await import('@tauri-apps/api/core');
const mockInvoke = vi.mocked(invoke);

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  
  const mockConfig: SessionConfig = {
    captureScreen: true,
    captureKeystrokes: true,
    captureMouse: false,
    privacyFilters: ['password'],
    qualitySettings: 'high',
  };

  const mockSession: WorkSession = {
    id: 'test-session-id',
    userId: 'test-user',
    startTime: Date.now(),
    status: SessionStatus.Active,
    captureConfig: mockConfig,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  beforeEach(() => {
    sessionManager = new SessionManager();
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a session successfully', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        session: mockSession,
      });

      const result = await sessionManager.createSession('test-user', mockConfig);

      expect(mockInvoke).toHaveBeenCalledWith('create_session', {
        request: { userId: 'test-user', config: mockConfig },
      });
      expect(result).toEqual(mockSession);
    });

    it('should throw error when creation fails', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Database error',
      });

      await expect(sessionManager.createSession('test-user', mockConfig))
        .rejects.toThrow('Database error');
    });
  });

  describe('getSession', () => {
    it('should retrieve a session successfully', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        session: mockSession,
      });

      const result = await sessionManager.getSession('test-session-id');

      expect(mockInvoke).toHaveBeenCalledWith('get_session', {
        sessionId: 'test-session-id',
      });
      expect(result).toEqual(mockSession);
    });

    it('should return null when session not found', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        session: null,
      });

      const result = await sessionManager.getSession('nonexistent-id');

      expect(result).toBeNull();
    });

    it('should throw error when retrieval fails', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Session not found',
      });

      await expect(sessionManager.getSession('test-session-id'))
        .rejects.toThrow('Session not found');
    });
  });

  describe('pauseSession', () => {
    it('should pause a session successfully', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
      });

      await sessionManager.pauseSession('test-session-id');

      expect(mockInvoke).toHaveBeenCalledWith('pause_session', {
        sessionId: 'test-session-id',
      });
    });

    it('should throw error when pause fails', async () => {
      mockInvoke.mockResolvedValue({
        success: false,
        error: 'Session not active',
      });

      await expect(sessionManager.pauseSession('test-session-id'))
        .rejects.toThrow('Session not active');
    });
  });

  describe('resumeSession', () => {
    it('should resume a session successfully', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
      });

      await sessionManager.resumeSession('test-session-id');

      expect(mockInvoke).toHaveBeenCalledWith('resume_session', {
        sessionId: 'test-session-id',
      });
    });
  });

  describe('stopSession', () => {
    it('should stop a session successfully', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
      });

      await sessionManager.stopSession('test-session-id');

      expect(mockInvoke).toHaveBeenCalledWith('stop_session', {
        sessionId: 'test-session-id',
      });
    });
  });

  describe('failSession', () => {
    it('should mark session as failed successfully', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
      });

      await sessionManager.failSession('test-session-id', 'Hardware failure');

      expect(mockInvoke).toHaveBeenCalledWith('fail_session', {
        sessionId: 'test-session-id',
        reason: 'Hardware failure',
      });
    });
  });

  describe('storeSessionData', () => {
    it('should store session data successfully', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
      });

      const testData = new Uint8Array([1, 2, 3, 4]);
      await sessionManager.storeSessionData('test-session-id', testData, '/path/to/file');

      expect(mockInvoke).toHaveBeenCalledWith('store_session_data', {
        sessionId: 'test-session-id',
        data: [1, 2, 3, 4],
        filePath: '/path/to/file',
      });
    });
  });

  describe('verifySessionIntegrity', () => {
    it('should verify session integrity successfully', async () => {
      const mockLogs = [
        {
          id: 1,
          sessionId: 'test-session-id',
          eventType: 'session_created',
          timestamp: Date.now(),
        },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        isValid: true,
        logs: mockLogs,
      });

      const result = await sessionManager.verifySessionIntegrity('test-session-id');

      expect(result.isValid).toBe(true);
      expect(result.logs).toEqual(mockLogs);
    });

    it('should handle integrity verification failure', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        isValid: false,
        logs: [],
      });

      const result = await sessionManager.verifySessionIntegrity('test-session-id');

      expect(result.isValid).toBe(false);
    });
  });

  describe('getUserSessions', () => {
    it('should get user sessions successfully', async () => {
      const mockSessions = [mockSession];

      mockInvoke.mockResolvedValue({
        success: true,
        sessions: mockSessions,
      });

      const result = await sessionManager.getUserSessions('test-user');

      expect(mockInvoke).toHaveBeenCalledWith('get_user_sessions', {
        userId: 'test-user',
        limit: null,
      });
      expect(result).toEqual(mockSessions);
    });

    it('should get user sessions with limit', async () => {
      mockInvoke.mockResolvedValue({
        success: true,
        sessions: [mockSession],
      });

      await sessionManager.getUserSessions('test-user', 10);

      expect(mockInvoke).toHaveBeenCalledWith('get_user_sessions', {
        userId: 'test-user',
        limit: 10,
      });
    });
  });

  describe('getActiveSessions', () => {
    it('should filter active sessions', async () => {
      const activeSessions = [
        { ...mockSession, status: SessionStatus.Active },
        { ...mockSession, id: 'session-2', status: SessionStatus.Active },
      ];
      const allSessions = [
        ...activeSessions,
        { ...mockSession, id: 'session-3', status: SessionStatus.Completed },
        { ...mockSession, id: 'session-4', status: SessionStatus.Paused },
      ];

      mockInvoke.mockResolvedValue({
        success: true,
        sessions: allSessions,
      });

      const result = await sessionManager.getActiveSessions('test-user');

      expect(result).toHaveLength(2);
      expect(result.every(s => s.status === SessionStatus.Active)).toBe(true);
    });
  });

  describe('utility methods', () => {
    it('should calculate session duration correctly', () => {
      const session: WorkSession = {
        ...mockSession,
        startTime: 1000,
        endTime: 5000,
      };

      const duration = sessionManager.getSessionDuration(session);
      expect(duration).toBe(4000);
    });

    it('should calculate duration for active session', () => {
      const session: WorkSession = {
        ...mockSession,
        startTime: Date.now() - 5000,
        endTime: undefined,
      };

      const duration = sessionManager.getSessionDuration(session);
      expect(duration).toBeGreaterThan(4000);
      expect(duration).toBeLessThan(6000);
    });

    it('should detect integrity issues', () => {
      const cleanSession = { ...mockSession };
      const tamperedSession = { ...mockSession, tamperEvidence: 'File modified' };

      expect(sessionManager.hasIntegrityIssues(cleanSession)).toBe(false);
      expect(sessionManager.hasIntegrityIssues(tamperedSession)).toBe(true);
    });

    it('should format duration correctly', () => {
      expect(sessionManager.formatDuration(30000)).toBe('30s');
      expect(sessionManager.formatDuration(90000)).toBe('1m 30s');
      expect(sessionManager.formatDuration(3661000)).toBe('1h 1m 1s');
    });

    it('should get status display text', () => {
      expect(sessionManager.getStatusDisplay(SessionStatus.Active)).toBe('Recording');
      expect(sessionManager.getStatusDisplay(SessionStatus.Paused)).toBe('Paused');
      expect(sessionManager.getStatusDisplay(SessionStatus.Completed)).toBe('Completed');
      expect(sessionManager.getStatusDisplay(SessionStatus.Failed)).toBe('Failed');
    });

    it('should get status colors', () => {
      expect(sessionManager.getStatusColor(SessionStatus.Active)).toBe('green');
      expect(sessionManager.getStatusColor(SessionStatus.Paused)).toBe('yellow');
      expect(sessionManager.getStatusColor(SessionStatus.Completed)).toBe('blue');
      expect(sessionManager.getStatusColor(SessionStatus.Failed)).toBe('red');
    });
  });
});