import { useCallback, useEffect, useRef } from "react";
import { trayResourceManager } from "../services/tray/TrayResourceManager";

/**
 * Event handler options for optimization
 */
interface OptimizedEventOptions {
  passive?: boolean;
  capture?: boolean;
  throttle?: number;
  debounce?: number;
  recordActivity?: boolean;
}

/**
 * Hook for optimized event handling with automatic resource management
 */
export function useOptimizedEventHandler<T extends Event>(
  eventType: string,
  handler: (event: T) => void,
  element: Element | Window | Document | null = null,
  options: OptimizedEventOptions = {},
) {
  const {
    passive = true,
    capture = false,
    throttle,
    debounce,
    recordActivity = true,
  } = options;

  const handlerRef = useRef(handler);
  const timeoutRef = useRef<number | undefined>(undefined);
  const lastExecutionRef = useRef<number>(0);

  // Update handler ref when handler changes
  handlerRef.current = handler;

  const optimizedHandler = useCallback(
    (event: T) => {
      // Record user activity for resource management
      if (recordActivity) {
        trayResourceManager.recordActivity();
      }

      const now = Date.now();

      // Apply throttling if specified
      if (throttle) {
        const timeSinceLastExecution = now - lastExecutionRef.current;
        if (timeSinceLastExecution < throttle) {
          return;
        }
        lastExecutionRef.current = now;
      }

      // Apply debouncing if specified
      if (debounce) {
        if (timeoutRef.current) {
          window.clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = window.setTimeout(() => {
          handlerRef.current(event);
        }, debounce);
        return;
      }

      // Execute handler immediately
      handlerRef.current(event);
    },
    [throttle, debounce, recordActivity],
  );

  useEffect(() => {
    const targetElement = element || window;

    if (!targetElement || !targetElement.addEventListener) {
      return;
    }

    const eventOptions = {
      passive,
      capture,
    };

    targetElement.addEventListener(
      eventType,
      optimizedHandler as EventListener,
      eventOptions,
    );

    return () => {
      targetElement.removeEventListener(
        eventType,
        optimizedHandler as EventListener,
        eventOptions,
      );

      // Clear any pending debounced calls
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [eventType, element, optimizedHandler, passive, capture]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);
}

/**
 * Hook for optimized mouse event handling
 */
export function useOptimizedMouseEvents(
  element: Element | null,
  handlers: {
    onMouseMove?: (event: MouseEvent) => void;
    onMouseEnter?: (event: MouseEvent) => void;
    onMouseLeave?: (event: MouseEvent) => void;
    onClick?: (event: MouseEvent) => void;
  },
  options: OptimizedEventOptions = {},
) {
  const { onMouseMove, onMouseEnter, onMouseLeave, onClick } = handlers;

  // Mouse move with throttling (high frequency event)
  useOptimizedEventHandler("mousemove", onMouseMove || (() => {}), element, {
    ...options,
    throttle: options.throttle || 16, // ~60fps
    passive: true,
  });

  // Mouse enter/leave (lower frequency)
  useOptimizedEventHandler("mouseenter", onMouseEnter || (() => {}), element, {
    ...options,
    passive: true,
  });

  useOptimizedEventHandler("mouseleave", onMouseLeave || (() => {}), element, {
    ...options,
    passive: true,
  });

  // Click events (user interaction)
  useOptimizedEventHandler("click", onClick || (() => {}), element, {
    ...options,
    recordActivity: true,
  });
}

/**
 * Hook for optimized keyboard event handling
 */
export function useOptimizedKeyboardEvents(
  element: Element | Window | null,
  handlers: {
    onKeyDown?: (event: KeyboardEvent) => void;
    onKeyUp?: (event: KeyboardEvent) => void;
    onKeyPress?: (event: KeyboardEvent) => void;
  },
  options: OptimizedEventOptions = {},
) {
  const { onKeyDown, onKeyUp, onKeyPress } = handlers;

  useOptimizedEventHandler("keydown", onKeyDown || (() => {}), element, {
    ...options,
    recordActivity: true,
  });

  useOptimizedEventHandler("keyup", onKeyUp || (() => {}), element, {
    ...options,
    recordActivity: true,
  });

  useOptimizedEventHandler("keypress", onKeyPress || (() => {}), element, {
    ...options,
    recordActivity: true,
  });
}

/**
 * Hook for optimized scroll event handling
 */
export function useOptimizedScrollHandler(
  element: Element | Window | null,
  handler: (event: Event) => void,
  options: OptimizedEventOptions = {},
) {
  useOptimizedEventHandler("scroll", handler, element, {
    ...options,
    throttle: options.throttle || 16, // ~60fps
    passive: true,
    recordActivity: true,
  });
}

/**
 * Hook for optimized resize event handling
 */
export function useOptimizedResizeHandler(
  handler: (event: Event) => void,
  options: OptimizedEventOptions = {},
) {
  useOptimizedEventHandler("resize", handler, window, {
    ...options,
    throttle: options.throttle || 100, // 10fps for resize
    passive: true,
  });
}

/**
 * Hook for optimized focus/blur event handling
 */
export function useOptimizedFocusEvents(
  element: Element | Window | null,
  handlers: {
    onFocus?: (event: FocusEvent) => void;
    onBlur?: (event: FocusEvent) => void;
  },
  options: OptimizedEventOptions = {},
) {
  const { onFocus, onBlur } = handlers;

  useOptimizedEventHandler("focus", onFocus || (() => {}), element, {
    ...options,
    recordActivity: true,
  });

  useOptimizedEventHandler("blur", onBlur || (() => {}), element, {
    ...options,
    recordActivity: false, // Don't record activity on blur
  });
}

/**
 * Hook for batched DOM mutations to minimize reflows
 */
export function useBatchedDOMUpdates() {
  const batchRef = useRef<(() => void)[]>([]);
  const frameRef = useRef<number | undefined>(undefined);

  const batchUpdate = useCallback((update: () => void) => {
    batchRef.current.push(update);

    if (!frameRef.current) {
      frameRef.current = requestAnimationFrame(() => {
        // Execute all batched updates
        const updates = batchRef.current;
        batchRef.current = [];
        frameRef.current = undefined;

        // Use document fragment for DOM updates if possible
        updates.forEach((update) => update());
      });
    }
  }, []);

  const flushUpdates = useCallback(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = undefined;
    }

    const updates = batchRef.current;
    batchRef.current = [];
    updates.forEach((update) => update());
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return { batchUpdate, flushUpdates };
}

/**
 * Hook for intersection observer with optimization
 */
export function useOptimizedIntersectionObserver(
  callback: (entries: IntersectionObserverEntry[]) => void,
  options: IntersectionObserverInit & { throttle?: number } = {},
) {
  const { throttle = 100, ...observerOptions } = options;
  const observerRef = useRef<IntersectionObserver | undefined>(undefined);
  const callbackRef = useRef(callback);
  const lastExecutionRef = useRef<number>(0);

  callbackRef.current = callback;

  const throttledCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const now = Date.now();
      if (now - lastExecutionRef.current >= throttle) {
        lastExecutionRef.current = now;
        callbackRef.current(entries);
      }
    },
    [throttle],
  );

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      throttledCallback,
      observerOptions,
    );
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [throttledCallback, observerOptions]);

  const observe = useCallback((element: Element) => {
    if (observerRef.current) {
      observerRef.current.observe(element);
    }
  }, []);

  const unobserve = useCallback((element: Element) => {
    if (observerRef.current) {
      observerRef.current.unobserve(element);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }
  }, []);

  return { observe, unobserve, disconnect };
}
