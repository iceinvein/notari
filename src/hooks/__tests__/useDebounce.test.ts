import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  useBatchedUpdates,
  useDebounce,
  useDebouncedAsync,
  useDebouncedCallback,
  useThrottledCallback,
} from "../useDebounce";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should debounce value updates", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 500 },
      },
    );

    expect(result.current).toBe("initial");

    // Update value
    rerender({ value: "updated", delay: 500 });
    expect(result.current).toBe("initial"); // Should still be initial

    // Fast forward time but not enough
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe("initial");

    // Fast forward enough time
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe("updated");
  });

  it("should reset debounce timer on rapid updates", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: "initial", delay: 500 },
      },
    );

    // Rapid updates
    rerender({ value: "update1", delay: 500 });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    rerender({ value: "update2", delay: 500 });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    rerender({ value: "final", delay: 500 });

    // Should still be initial because timer keeps resetting
    expect(result.current).toBe("initial");

    // Now wait full delay
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe("final");
  });
});

describe("useDebouncedCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should debounce callback execution", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    // Call multiple times rapidly
    act(() => {
      result.current("arg1");
      result.current("arg2");
      result.current("arg3");
    });

    // Should not have been called yet
    expect(callback).not.toHaveBeenCalled();

    // Fast forward time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should have been called once with last arguments
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("arg3");
  });

  it("should cancel previous calls when called again", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(callback, 500));

    act(() => {
      result.current("first");
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    act(() => {
      result.current("second");
    });

    // Fast forward full delay
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should only be called once with second argument
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("second");
  });
});

describe("useThrottledCallback", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should throttle callback execution", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 500));

    // First call should execute immediately
    act(() => {
      result.current("first");
    });
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("first");

    // Subsequent calls within throttle period should be delayed
    act(() => {
      result.current("second");
      result.current("third");
    });
    expect(callback).toHaveBeenCalledTimes(1); // Still only first call

    // Fast forward time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should execute the last call
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith("third");
  });

  it("should allow immediate execution after throttle period", () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottledCallback(callback, 500));

    // First call
    act(() => {
      result.current("first");
    });
    expect(callback).toHaveBeenCalledTimes(1);

    // Wait for throttle period to pass
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Next call should execute immediately
    act(() => {
      result.current("second");
    });
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenLastCalledWith("second");
  });
});

describe("useBatchedUpdates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should batch state updates", () => {
    const { result } = renderHook(() => useBatchedUpdates("initial", 100));

    const [initialValue, setValue] = result.current;
    expect(initialValue).toBe("initial");

    // Make multiple updates
    act(() => {
      setValue("update1");
      setValue("update2");
      setValue("update3");
    });

    // Value should still be initial (batched)
    expect(result.current[0]).toBe("initial");

    // Fast forward time to flush batch
    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should now have the latest value
    expect(result.current[0]).toBe("update3");
  });

  it("should allow manual flush of batched updates", () => {
    const { result } = renderHook(() => useBatchedUpdates("initial", 100));

    const [, setValue, flushUpdates] = result.current;

    act(() => {
      setValue("updated");
    });

    expect(result.current[0]).toBe("initial");

    // Manual flush
    act(() => {
      flushUpdates();
    });

    expect(result.current[0]).toBe("updated");
  });
});

describe("useDebouncedAsync", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should debounce async operations", async () => {
    const asyncCallback = vi.fn().mockResolvedValue("result");
    const { result } = renderHook(() => useDebouncedAsync(asyncCallback, 500));

    const [debouncedCallback, isLoading, error] = result.current;

    expect(isLoading).toBe(false);
    expect(error).toBe(null);

    // Call multiple times
    act(() => {
      debouncedCallback("arg1");
      debouncedCallback("arg2");
      debouncedCallback("arg3");
    });

    // Should not have been called yet
    expect(asyncCallback).not.toHaveBeenCalled();

    // Fast forward time
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Should be loading now
    expect(result.current[1]).toBe(true);

    // Wait for async operation to complete
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should have been called once with last arguments
    expect(asyncCallback).toHaveBeenCalledTimes(1);
    expect(asyncCallback).toHaveBeenCalledWith("arg3");
    expect(result.current[1]).toBe(false); // No longer loading
    expect(result.current[2]).toBe(null); // No error
  });

  it("should handle async errors", async () => {
    const error = new Error("Test error");
    const asyncCallback = vi.fn().mockRejectedValue(error);
    const { result } = renderHook(() => useDebouncedAsync(asyncCallback, 500));

    const [debouncedCallback] = result.current;

    // Suppress unhandled rejection warnings for this test
    const originalConsoleError = console.error;
    console.error = vi.fn();

    let promiseRejection: any;

    act(() => {
      // Catch the promise rejection to prevent unhandled rejection
      promiseRejection = debouncedCallback("arg").catch(() => {
        // Intentionally ignore the error - we're testing the state handling
      });
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
      // Wait for the promise to settle
      if (promiseRejection) {
        await promiseRejection;
      }
    });

    expect(result.current[1]).toBe(false); // Not loading
    expect(result.current[2]).toBe(error); // Has error

    // Restore console.error
    console.error = originalConsoleError;
  });

  it("should cancel previous async operations", async () => {
    const asyncCallback = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");

    const { result } = renderHook(() => useDebouncedAsync(asyncCallback, 500));

    const [debouncedCallback] = result.current;

    // First call
    act(() => {
      debouncedCallback("first");
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Second call (should cancel first)
    act(() => {
      debouncedCallback("second");
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    await act(async () => {
      await vi.runAllTimersAsync();
    });

    // Should only have been called once (second call)
    expect(asyncCallback).toHaveBeenCalledTimes(1);
    expect(asyncCallback).toHaveBeenCalledWith("second");
  });
});
