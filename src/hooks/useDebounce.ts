import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Hook for debouncing values
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = window.window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.window.clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for debouncing callbacks
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps?: React.DependencyList,
): T {
  const timeoutRef = useRef<number | undefined>(undefined);

  const debouncedCallback = useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        window.window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.window.setTimeout(() => {
        callback(...args);
      }, delay);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, delay, ...(deps || [])],
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}

/**
 * Hook for throttling callbacks (limits execution frequency)
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
  deps?: React.DependencyList,
): T {
  const lastExecuted = useRef<number>(0);
  const timeoutRef = useRef<number | undefined>(undefined);

  const throttledCallback = useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastExecution = now - lastExecuted.current;

      if (timeSinceLastExecution >= delay) {
        // Execute immediately if enough time has passed
        lastExecuted.current = now;
        callback(...args);
      } else {
        // Schedule execution for the remaining time
        if (timeoutRef.current) {
          window.window.clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = window.window.setTimeout(() => {
          lastExecuted.current = Date.now();
          callback(...args);
        }, delay - timeSinceLastExecution);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [callback, delay, ...(deps || [])],
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return throttledCallback;
}

/**
 * Hook for batching state updates
 */
export function useBatchedUpdates<T>(
  initialValue: T,
  batchDelay: number = 100,
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [value, setValue] = useState<T>(initialValue);
  const pendingValueRef = useRef<T>(initialValue);
  const timeoutRef = useRef<number | undefined>(undefined);
  const hasPendingUpdate = useRef<boolean>(false);

  const flushUpdates = useCallback(() => {
    if (hasPendingUpdate.current) {
      setValue(pendingValueRef.current);
      hasPendingUpdate.current = false;
    }
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
  }, []);

  const batchedSetValue = useCallback(
    (newValue: T | ((prev: T) => T)) => {
      const nextValue =
        typeof newValue === "function"
          ? (newValue as (prev: T) => T)(pendingValueRef.current)
          : newValue;

      pendingValueRef.current = nextValue;
      hasPendingUpdate.current = true;

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = window.setTimeout(() => {
        if (hasPendingUpdate.current) {
          setValue(pendingValueRef.current);
          hasPendingUpdate.current = false;
        }
        timeoutRef.current = undefined;
      }, batchDelay);
    },
    [batchDelay],
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [value, batchedSetValue, flushUpdates];
}

/**
 * Hook for debouncing async operations
 */
export function useDebouncedAsync<T extends (...args: any[]) => Promise<any>>(
  asyncCallback: T,
  delay: number,
  deps?: React.DependencyList,
): [T, boolean, Error | null] {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<number | undefined>(undefined);
  const abortControllerRef = useRef<AbortController | undefined>(undefined);

  const debouncedAsyncCallback = useCallback(
    async (...args: Parameters<T>) => {
      // Cancel previous timeout and abort previous request
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();
      const currentAbortController = abortControllerRef.current;

      return new Promise<Awaited<ReturnType<T>>>((resolve, reject) => {
        timeoutRef.current = window.setTimeout(async () => {
          if (currentAbortController.signal.aborted) {
            reject(new Error("Operation was cancelled"));
            return;
          }

          try {
            setIsLoading(true);
            setError(null);
            const result = await asyncCallback(...args);

            if (!currentAbortController.signal.aborted) {
              resolve(result);
            }
          } catch (err) {
            if (!currentAbortController.signal.aborted) {
              const error =
                err instanceof Error ? err : new Error("Unknown error");
              setError(error);
              reject(error);
            }
          } finally {
            if (!currentAbortController.signal.aborted) {
              setIsLoading(false);
            }
          }
        }, delay);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [asyncCallback, delay, ...(deps || [])],
  ) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return [debouncedAsyncCallback, isLoading, error];
}
