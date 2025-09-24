import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CaptureEngine, SessionConfig, PermissionStatus } from './CaptureEngine';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri's invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

describe('CaptureEngine', () => {
  let captureEngine: CaptureEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    captureEngine = CaptureEngine.getInstance();
    // Reset the initialized state for testing
    (captureEngine as any).initialized = false;
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = CaptureEngine.getInstance();
      const instance2 = CaptureEngine.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await captureEngine.initialize();

      expect(mockInvoke).toHaveBeenCalledWith('initialize_capture_engine');
      expect((captureEngine as any).initialized).toBe(true);
    });

    it('should not initialize twice', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await captureEngine.initialize();
      await captureEngine.initialize();

      expect(mockInvoke).toHaveBeenCalledTimes(1);
    });

    it('should throw error on initialization failure', async () => {
      const errorMessage = 'Initialization failed';
      mockInvoke.mockRejectedValueOnce(new Error(errorMessage));

      await expect(captureEngine.initialize()).rejects.toThrow(
        `Failed to initialize capture engine: Error: ${errorMessage}`
      );
    });
  });

  describe('Session Management', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await captureEngine.initialize();
      vi.clearAllMocks();
    });

    it('should start a session successfully', async () => {
      const config: SessionConfig = CaptureEngine.createDefaultConfig();
      const mockSessionId = 'test-session-123';
      
      mockInvoke.mockResolvedValueOnce({ sessionId: mockSessionId });

      const sessionId = await captureEngine.startSession(config);

      expect(sessionId).toBe(mockSessionId);
      expect(mockInvoke).toHaveBeenCalledWith('start_capture_session', {
        request: {
          capture_screen: config.captureScreen,
          capture_keystrokes: config.captureKeystrokes,
          capture_mouse: config.captureMouse,
          privacy_filters: config.privacyFilters.map(filter => ({
            filter_type: filter.filterType,
            enabled: filter.enabled,
          })),
          quality_settings: {
            screen_fps: config.qualitySettings.screenFps,
            screen_resolution_scale: config.qualitySettings.screenResolutionScale,
            compression_level: config.qualitySettings.compressionLevel,
          },
        },
      });
    });

    it('should stop a session successfully', async () => {
      const sessionId = 'test-session-123';
      const mockEncryptedData = {
        sessionId,
        encryptedDataSize: 1024,
        encryptionAlgorithm: 'AES-256-GCM',
        createdAt: '2023-01-01T00:00:00Z',
      };

      mockInvoke.mockResolvedValueOnce(mockEncryptedData);

      const result = await captureEngine.stopSession(sessionId);

      expect(result).toEqual(mockEncryptedData);
      expect(mockInvoke).toHaveBeenCalledWith('stop_capture_session', {
        session_id: sessionId,
      });
    });

    it('should pause a session successfully', async () => {
      const sessionId = 'test-session-123';
      mockInvoke.mockResolvedValueOnce(undefined);

      await captureEngine.pauseSession(sessionId);

      expect(mockInvoke).toHaveBeenCalledWith('pause_capture_session', {
        session_id: sessionId,
      });
    });

    it('should resume a session successfully', async () => {
      const sessionId = 'test-session-123';
      mockInvoke.mockResolvedValueOnce(undefined);

      await captureEngine.resumeSession(sessionId);

      expect(mockInvoke).toHaveBeenCalledWith('resume_capture_session', {
        session_id: sessionId,
      });
    });

    it('should get session status successfully', async () => {
      const sessionId = 'test-session-123';
      const mockStatus = 'active';
      mockInvoke.mockResolvedValueOnce({ status: mockStatus });

      const status = await captureEngine.getSessionStatus(sessionId);

      expect(status).toBe(mockStatus);
      expect(mockInvoke).toHaveBeenCalledWith('get_session_status', {
        session_id: sessionId,
      });
    });

    it('should throw error when not initialized', async () => {
      const uninitializedEngine = new (CaptureEngine as any)();
      const config = CaptureEngine.createDefaultConfig();

      await expect(uninitializedEngine.startSession(config)).rejects.toThrow(
        'Capture engine not initialized'
      );
    });
  });

  describe('Permissions', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await captureEngine.initialize();
      vi.clearAllMocks();
    });

    it('should check permissions successfully', async () => {
      const mockPermissions: PermissionStatus = {
        screenCapture: true,
        inputMonitoring: false,
        accessibility: true,
      };

      mockInvoke.mockResolvedValueOnce(mockPermissions);

      const permissions = await captureEngine.checkPermissions();

      expect(permissions).toEqual(mockPermissions);
      expect(mockInvoke).toHaveBeenCalledWith('check_capture_permissions');
    });

    it('should request permissions successfully', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      await captureEngine.requestPermissions();

      expect(mockInvoke).toHaveBeenCalledWith('request_capture_permissions');
    });
  });

  describe('Configuration Helpers', () => {
    it('should create default configuration', () => {
      const config = CaptureEngine.createDefaultConfig();

      expect(config.captureScreen).toBe(true);
      expect(config.captureKeystrokes).toBe(true);
      expect(config.captureMouse).toBe(true);
      expect(config.privacyFilters).toHaveLength(4);
      expect(config.qualitySettings.screenFps).toBe(30);
      expect(config.qualitySettings.screenResolutionScale).toBe(1.0);
      expect(config.qualitySettings.compressionLevel).toBe(5);
    });

    it('should create test configuration', () => {
      const config = CaptureEngine.createTestConfig();

      expect(config.captureScreen).toBe(false);
      expect(config.captureKeystrokes).toBe(false);
      expect(config.captureMouse).toBe(false);
      expect(config.privacyFilters).toHaveLength(0);
      expect(config.qualitySettings.screenFps).toBe(10);
      expect(config.qualitySettings.screenResolutionScale).toBe(0.5);
      expect(config.qualitySettings.compressionLevel).toBe(8);
    });

    it('should validate configuration correctly', () => {
      const validConfig = CaptureEngine.createDefaultConfig();
      const errors = CaptureEngine.validateConfig(validConfig);
      expect(errors).toHaveLength(0);

      const invalidConfig: SessionConfig = {
        captureScreen: false,
        captureKeystrokes: false,
        captureMouse: false,
        privacyFilters: [],
        qualitySettings: {
          screenFps: 0, // Invalid
          screenResolutionScale: 3.0, // Invalid
          compressionLevel: 10, // Invalid
        },
      };

      const invalidErrors = CaptureEngine.validateConfig(invalidConfig);
      expect(invalidErrors).toContain('Screen FPS must be between 1 and 60');
      expect(invalidErrors).toContain('Screen resolution scale must be between 0.1 and 2.0');
      expect(invalidErrors).toContain('Compression level must be between 1 and 9');
      expect(invalidErrors).toContain('At least one capture type must be enabled');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await captureEngine.initialize();
      vi.clearAllMocks();
    });

    it('should handle session start errors', async () => {
      const config = CaptureEngine.createDefaultConfig();
      const errorMessage = 'Permission denied';
      mockInvoke.mockRejectedValueOnce(new Error(errorMessage));

      await expect(captureEngine.startSession(config)).rejects.toThrow(
        `Failed to start capture session: Error: ${errorMessage}`
      );
    });

    it('should handle session stop errors', async () => {
      const sessionId = 'test-session-123';
      const errorMessage = 'Session not found';
      mockInvoke.mockRejectedValueOnce(new Error(errorMessage));

      await expect(captureEngine.stopSession(sessionId)).rejects.toThrow(
        `Failed to stop capture session: Error: ${errorMessage}`
      );
    });

    it('should handle permission check errors', async () => {
      const errorMessage = 'Platform not supported';
      mockInvoke.mockRejectedValueOnce(new Error(errorMessage));

      await expect(captureEngine.checkPermissions()).rejects.toThrow(
        `Failed to check permissions: Error: ${errorMessage}`
      );
    });
  });

  describe('Privacy Filters', () => {
    it('should handle all privacy filter types', () => {
      const config = CaptureEngine.createDefaultConfig();
      
      expect(config.privacyFilters).toEqual([
        { filterType: 'password_fields', enabled: true },
        { filterType: 'credit_card_numbers', enabled: true },
        { filterType: 'social_security_numbers', enabled: true },
        { filterType: 'personal_emails', enabled: false },
      ]);
    });
  });

  describe('Quality Settings', () => {
    it('should validate quality settings ranges', () => {
      const configs = [
        {
          ...CaptureEngine.createDefaultConfig(),
          qualitySettings: { screenFps: 61, screenResolutionScale: 1.0, compressionLevel: 5 }
        },
        {
          ...CaptureEngine.createDefaultConfig(),
          qualitySettings: { screenFps: 30, screenResolutionScale: 2.1, compressionLevel: 5 }
        },
        {
          ...CaptureEngine.createDefaultConfig(),
          qualitySettings: { screenFps: 30, screenResolutionScale: 1.0, compressionLevel: 0 }
        },
      ];

      configs.forEach(config => {
        const errors = CaptureEngine.validateConfig(config);
        expect(errors.length).toBeGreaterThan(0);
      });
    });
  });
});