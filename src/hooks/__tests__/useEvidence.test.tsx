import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { invoke } from '@tauri-apps/api/core';
import type { ReactNode } from 'react';
import {
  useHasSigningKeyQuery,
  usePublicKeyQuery,
  useVerifyRecordingQuery,
  getVerificationStatusColor,
  formatPublicKeyFingerprint,
} from '../useEvidence';
import type { VerificationReport } from '../useEvidence';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useHasSigningKeyQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return true when signing key exists', async () => {
    vi.mocked(invoke).mockResolvedValue(true);

    const { result } = renderHook(() => useHasSigningKeyQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(true);
    expect(invoke).toHaveBeenCalledWith('has_signing_key');
  });

  it('should return false when signing key does not exist', async () => {
    vi.mocked(invoke).mockResolvedValue(false);

    const { result } = renderHook(() => useHasSigningKeyQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(false);
  });
});

describe('usePublicKeyQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch public key', async () => {
    const mockPublicKey = 'ed25519:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';

    vi.mocked(invoke).mockResolvedValue(mockPublicKey);

    const { result } = renderHook(() => usePublicKeyQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBe(mockPublicKey);
    expect(invoke).toHaveBeenCalledWith('export_public_key');
  });

  it('should handle missing public key', async () => {
    vi.mocked(invoke).mockResolvedValue(null);

    const { result } = renderHook(() => usePublicKeyQuery(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toBeNull();
  });
});

describe('useVerifyRecordingQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should verify recording successfully', async () => {
    const mockReport: VerificationReport = {
      verification: {
        timestamp: '2024-01-15T10:00:00Z',
        status: 'VERIFIED',
        checks: {
          manifest_structure: 'PASS',
          signature_valid: 'PASS',
          hash_match: 'PASS',
        },
        recording_info: {
          session_id: 'test-session-123',
          created_at: '2024-01-15T10:00:00Z',
          duration_seconds: 120,
          window_title: 'Test Window',
        },
        signature_info: {
          algorithm: 'Ed25519',
          public_key: 'ed25519:abc123',
          verified_by: 'Notari v0.1.0',
        },
      },
    };

    vi.mocked(invoke).mockResolvedValue(mockReport);

    const { result } = renderHook(
      () => useVerifyRecordingQuery('/path/to/manifest.json', '/path/to/video.notari'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(mockReport);
    expect(result.current.data?.verification.status).toBe('VERIFIED');
    expect(invoke).toHaveBeenCalledWith('verify_recording', {
      manifestPath: '/path/to/manifest.json',
      videoPath: '/path/to/video.notari',
    });
  });

  it('should detect tampered recording', async () => {
    const mockReport: VerificationReport = {
      verification: {
        timestamp: '2024-01-15T11:00:00Z',
        status: 'FAILED',
        checks: {
          manifest_structure: 'PASS',
          signature_valid: 'PASS',
          hash_match: 'FAIL',
        },
        recording_info: {
          session_id: 'test-session-456',
          created_at: '2024-01-15T11:00:00Z',
          duration_seconds: 60,
          window_title: 'Tampered Window',
        },
        signature_info: {
          algorithm: 'Ed25519',
          public_key: 'ed25519:def456',
          verified_by: 'Notari v0.1.0',
        },
      },
    };

    vi.mocked(invoke).mockResolvedValue(mockReport);

    const { result } = renderHook(
      () => useVerifyRecordingQuery('/path/to/manifest.json', '/path/to/tampered.notari'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.verification.status).toBe('FAILED');
    expect(result.current.data?.verification.checks.hash_match).toBe('FAIL');
  });

  it('should not fetch when paths are null', async () => {
    const { result } = renderHook(
      () => useVerifyRecordingQuery(null, null),
      { wrapper: createWrapper() }
    );

    // Should not call invoke
    expect(invoke).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
  });

  it('should handle verification with warnings', async () => {
    const mockReport: VerificationReport = {
      verification: {
        timestamp: '2024-01-15T12:00:00Z',
        status: 'WARNING',
        checks: {
          manifest_structure: 'PASS',
          signature_valid: 'PASS',
          hash_match: 'PASS',
        },
        recording_info: {
          session_id: 'test-session-789',
          created_at: '2024-01-15T12:00:00Z',
          duration_seconds: 180,
          window_title: 'Warning Window',
        },
        signature_info: {
          algorithm: 'Ed25519',
          public_key: 'ed25519:ghi789',
          verified_by: 'Notari v0.1.0',
        },
      },
    };

    vi.mocked(invoke).mockResolvedValue(mockReport);

    const { result } = renderHook(
      () => useVerifyRecordingQuery('/path/to/manifest.json', '/path/to/warning.notari'),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.verification.status).toBe('WARNING');
  });
});

describe('getVerificationStatusColor', () => {
  it('should return success color for VERIFIED status', () => {
    expect(getVerificationStatusColor('VERIFIED')).toBe('success');
  });

  it('should return danger color for FAILED status', () => {
    expect(getVerificationStatusColor('FAILED')).toBe('danger');
  });

  it('should return warning color for WARNING status', () => {
    expect(getVerificationStatusColor('WARNING')).toBe('warning');
  });
});

describe('formatPublicKeyFingerprint', () => {
  it('should format public key with first 8 chars', () => {
    const publicKey = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    const formatted = formatPublicKeyFingerprint(publicKey);

    // Should be first 8 chars + ...
    expect(formatted).toBe('abcdef12...');
  });

  it('should handle short keys', () => {
    const publicKey = 'abc';
    const formatted = formatPublicKeyFingerprint(publicKey);

    // Keys shorter than 8 chars return N/A
    expect(formatted).toBe('N/A');
  });

  it('should handle keys with algorithm prefix', () => {
    const publicKey = 'ed25519:abcdef1234567890';
    const formatted = formatPublicKeyFingerprint(publicKey);

    // Should take first 8 chars of entire string (including prefix)
    expect(formatted).toBe('ed25519:...');
  });

  it('should truncate long keys', () => {
    const publicKey = `${'a'.repeat(100)}`;
    const formatted = formatPublicKeyFingerprint(publicKey);

    // Should be truncated to 8 chars + ...
    expect(formatted).toBe('aaaaaaaa...');
    expect(formatted.length).toBe(11); // 8 + '...'
  });

  it('should return N/A for empty string', () => {
    const formatted = formatPublicKeyFingerprint('');
    expect(formatted).toBe('N/A');
  });
});

