import { invoke } from '@tauri-apps/api/core';

export interface SessionConfig {
  captureScreen: boolean;
  captureKeystrokes: boolean;
  captureMouse: boolean;
  privacyFilters: PrivacyFilter[];
  qualitySettings: CaptureQuality;
}

export interface PrivacyFilter {
  filterType: 'password_fields' | 'credit_card_numbers' | 'social_security_numbers' | 'personal_emails';
  enabled: boolean;
}

export interface CaptureQuality {
  screenFps: number;
  screenResolutionScale: number;
  compressionLevel: number;
}

export interface SessionResponse {
  sessionId: string;
}

export interface SessionStatusResponse {
  status: 'active' | 'paused' | 'completed' | string;
}

export interface PermissionStatus {
  screenCapture: boolean;
  inputMonitoring: boolean;
  accessibility: boolean;
}

export interface EncryptedSessionData {
  sessionId: string;
  encryptedDataSize: number;
  encryptionAlgorithm: string;
  createdAt: string;
}

export class CaptureEngine {
  private static instance: CaptureEngine | null = null;
  private initialized = false;

  private constructor() {}

  public static getInstance(): CaptureEngine {
    if (!CaptureEngine.instance) {
      CaptureEngine.instance = new CaptureEngine();
    }
    return CaptureEngine.instance;
  }

  /**
   * Initialize the capture engine
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await invoke('initialize_capture_engine');
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize capture engine: ${error}`);
    }
  }

  /**
   * Start a new capture session
   */
  public async startSession(config: SessionConfig): Promise<string> {
    if (!this.initialized) {
      throw new Error('Capture engine not initialized');
    }

    try {
      const request = {
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
      };

      const response: SessionResponse = await invoke('start_capture_session', { request });
      return response.sessionId;
    } catch (error) {
      throw new Error(`Failed to start capture session: ${error}`);
    }
  }

  /**
   * Stop a capture session and get encrypted data
   */
  public async stopSession(sessionId: string): Promise<EncryptedSessionData> {
    if (!this.initialized) {
      throw new Error('Capture engine not initialized');
    }

    try {
      const response: EncryptedSessionData = await invoke('stop_capture_session', { 
        session_id: sessionId 
      });
      return response;
    } catch (error) {
      throw new Error(`Failed to stop capture session: ${error}`);
    }
  }

  /**
   * Pause a capture session
   */
  public async pauseSession(sessionId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Capture engine not initialized');
    }

    try {
      await invoke('pause_capture_session', { session_id: sessionId });
    } catch (error) {
      throw new Error(`Failed to pause capture session: ${error}`);
    }
  }

  /**
   * Resume a paused capture session
   */
  public async resumeSession(sessionId: string): Promise<void> {
    if (!this.initialized) {
      throw new Error('Capture engine not initialized');
    }

    try {
      await invoke('resume_capture_session', { session_id: sessionId });
    } catch (error) {
      throw new Error(`Failed to resume capture session: ${error}`);
    }
  }

  /**
   * Get the status of a capture session
   */
  public async getSessionStatus(sessionId: string): Promise<string> {
    if (!this.initialized) {
      throw new Error('Capture engine not initialized');
    }

    try {
      const response: SessionStatusResponse = await invoke('get_session_status', { 
        session_id: sessionId 
      });
      return response.status;
    } catch (error) {
      throw new Error(`Failed to get session status: ${error}`);
    }
  }

  /**
   * Check current permissions status
   */
  public async checkPermissions(): Promise<PermissionStatus> {
    if (!this.initialized) {
      throw new Error('Capture engine not initialized');
    }

    try {
      const response: PermissionStatus = await invoke('check_capture_permissions');
      return {
        screenCapture: response.screenCapture,
        inputMonitoring: response.inputMonitoring,
        accessibility: response.accessibility,
      };
    } catch (error) {
      throw new Error(`Failed to check permissions: ${error}`);
    }
  }

  /**
   * Request required permissions
   */
  public async requestPermissions(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Capture engine not initialized');
    }

    try {
      await invoke('request_capture_permissions');
    } catch (error) {
      throw new Error(`Failed to request permissions: ${error}`);
    }
  }

  /**
   * Create a default session configuration
   */
  public static createDefaultConfig(): SessionConfig {
    return {
      captureScreen: true,
      captureKeystrokes: true,
      captureMouse: true,
      privacyFilters: [
        { filterType: 'password_fields', enabled: true },
        { filterType: 'credit_card_numbers', enabled: true },
        { filterType: 'social_security_numbers', enabled: true },
        { filterType: 'personal_emails', enabled: false },
      ],
      qualitySettings: {
        screenFps: 30,
        screenResolutionScale: 1.0,
        compressionLevel: 5,
      },
    };
  }

  /**
   * Create a lightweight configuration for testing
   */
  public static createTestConfig(): SessionConfig {
    return {
      captureScreen: false,
      captureKeystrokes: false,
      captureMouse: false,
      privacyFilters: [],
      qualitySettings: {
        screenFps: 10,
        screenResolutionScale: 0.5,
        compressionLevel: 8,
      },
    };
  }

  /**
   * Validate session configuration
   */
  public static validateConfig(config: SessionConfig): string[] {
    const errors: string[] = [];

    if (config.qualitySettings.screenFps < 1 || config.qualitySettings.screenFps > 60) {
      errors.push('Screen FPS must be between 1 and 60');
    }

    if (config.qualitySettings.screenResolutionScale < 0.1 || config.qualitySettings.screenResolutionScale > 2.0) {
      errors.push('Screen resolution scale must be between 0.1 and 2.0');
    }

    if (config.qualitySettings.compressionLevel < 1 || config.qualitySettings.compressionLevel > 9) {
      errors.push('Compression level must be between 1 and 9');
    }

    if (!config.captureScreen && !config.captureKeystrokes && !config.captureMouse) {
      errors.push('At least one capture type must be enabled');
    }

    return errors;
  }
}

// Export singleton instance
export const captureEngine = CaptureEngine.getInstance();