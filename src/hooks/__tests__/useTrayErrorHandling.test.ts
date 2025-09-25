import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTrayErrorHandling } from "../useTrayErrorHandling";

// Mock Tauri event API
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

// Mock the TrayFallbackManager
vi.mock("../../services/tray/TrayFallbackManager", () => ({
  useTrayFallback: vi.fn(),
}));

import { listen } from "@tauri-apps/api/event";
import { useTrayFallback } from "../../services/tray/TrayFallbackManager";

const mockListen = vi.mocked(listen);
const mockUseTrayFallback = vi.mocked(useTrayFallback);

const mockCheckAvailability = vi.fn();
const mockRetryInitialization = vi.fn();
const mockActivateFallback = vi.fn();
const mockGetStatus = vi.fn();
const mockRequestPermissions = vi.fn();
const mockOnStatusChange = vi.fn();

describe("useTrayErrorHandling", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementations
    mockCheckAvailability.mockResolvedValue({
      isAvailable: true,
      canRetry: true,
    });

    mockOnStatusChange.mockImplementation((_callback) => {
      // Return unsubscribe function
      return () => {};
    });

    mockListen.mockImplementation((_event, _callback) => {
      // Return unsubscribe function
      return Promise.resolve(() => {});
    });

    // Setup the useTrayFallback mock
    mockUseTrayFallback.mockReturnValue({
      checkAvailability: mockCheckAvailability,
      retryInitialization: mockRetryInitialization,
      activateFallback: mockActivateFallback,
      getStatus: mockGetStatus,
      requestPermissions: mockRequestPermissions,
      onStatusChange: mockOnStatusChange,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("initializes with no error state", async () => {
    const { result } = renderHook(() => useTrayErrorHandling());

    await waitFor(() => {
      const [errorState] = result.current;
      expect(errorState.hasError).toBe(false);
      expect(errorState.error).toBe(null);
      expect(errorState.retryCount).toBe(0);
      expect(errorState.isRetrying).toBe(false);
      expect(errorState.fallbackActive).toBe(false);
    });
  });

  it("updates state when tray availability check fails", async () => {
    mockCheckAvailability.mockResolvedValue({
      isAvailable: false,
      error: "Test error",
      canRetry: true,
    });

    const { result } = renderHook(() => useTrayErrorHandling());

    await waitFor(() => {
      const [errorState] = result.current;
      expect(errorState.hasError).toBe(true);
      expect(errorState.error).toBe("Test error");
      expect(errorState.canRetry).toBe(true);
    });
  });

  it("handles retry functionality", async () => {
    mockRetryInitialization.mockResolvedValue(true);

    const { result } = renderHook(() => useTrayErrorHandling());

    await act(async () => {
      const [, actions] = result.current;
      const success = await actions.retry();
      expect(success).toBe(true);
    });

    expect(mockRetryInitialization).toHaveBeenCalledWith({
      maxRetries: expect.any(Number),
      retryInterval: 2000,
      showMainWindow: false,
      showNotification: false,
    });
  });

  it("prevents retry when max attempts reached", async () => {
    const { result } = renderHook(() => useTrayErrorHandling());

    // Set retry count to max
    act(() => {
      const [errorState] = result.current;
      (errorState as any).retryCount = 3;
    });

    await act(async () => {
      const [, actions] = result.current;
      const success = await actions.retry();
      expect(success).toBe(false);
    });

    expect(mockRetryInitialization).not.toHaveBeenCalled();
  });

  it("activates fallback mode", async () => {
    mockActivateFallback.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTrayErrorHandling());

    await act(async () => {
      const [, actions] = result.current;
      await actions.activateFallback();
    });

    expect(mockActivateFallback).toHaveBeenCalledWith({
      showMainWindow: true,
      showNotification: true,
    });
  });

  it("requests permissions", async () => {
    mockRequestPermissions.mockResolvedValue(true);
    mockCheckAvailability.mockResolvedValue({
      isAvailable: true,
      canRetry: true,
    });

    const { result } = renderHook(() => useTrayErrorHandling());

    await act(async () => {
      const [, actions] = result.current;
      const success = await actions.requestPermissions();
      expect(success).toBe(true);
    });

    expect(mockRequestPermissions).toHaveBeenCalled();
    expect(mockCheckAvailability).toHaveBeenCalled();
  });

  it("clears error state", () => {
    const { result } = renderHook(() => useTrayErrorHandling());

    act(() => {
      const [, actions] = result.current;
      actions.clearError();
    });

    const [errorState] = result.current;
    expect(errorState.hasError).toBe(false);
    expect(errorState.error).toBe(null);
    expect(errorState.retryCount).toBe(0);
  });

  it("listens for tray events", async () => {
    let trayInitFailedCallback: any;
    let trayRecoveredCallback: any;
    let fallbackActivatedCallback: any;

    mockListen.mockImplementation((event, callback) => {
      if (event === "tray-init-failed") {
        trayInitFailedCallback = callback;
      } else if (event === "tray-recovered") {
        trayRecoveredCallback = callback;
      } else if (event === "tray-fallback-activated") {
        fallbackActivatedCallback = callback;
      }
      return Promise.resolve(() => {});
    });

    const { result } = renderHook(() => useTrayErrorHandling());

    // Wait for event listeners to be set up
    await waitFor(() => {
      expect(mockListen).toHaveBeenCalledWith(
        "tray-init-failed",
        expect.any(Function),
      );
    });

    // Simulate tray init failed event
    act(() => {
      trayInitFailedCallback({
        payload: {
          error: "Init failed",
          reason: "test_failure",
          canRetry: true,
        },
      });
    });

    await waitFor(() => {
      const [errorState] = result.current;
      expect(errorState.hasError).toBe(true);
      expect(errorState.error).toBe("Init failed");
      expect(errorState.errorType).toBe("test_failure");
    });

    // Simulate tray recovered event
    act(() => {
      trayRecoveredCallback({});
    });

    await waitFor(() => {
      const [errorState] = result.current;
      expect(errorState.hasError).toBe(false);
      expect(errorState.error).toBe(null);
    });

    // Simulate fallback activated event
    act(() => {
      fallbackActivatedCallback({
        payload: {
          reason: "test_fallback",
        },
      });
    });

    await waitFor(() => {
      const [errorState] = result.current;
      expect(errorState.fallbackActive).toBe(true);
    });
  });
});

// Note: useTrayErrorRecovery tests are skipped as they require more complex mocking
// The functionality is tested through integration tests and the main useTrayErrorHandling hook
