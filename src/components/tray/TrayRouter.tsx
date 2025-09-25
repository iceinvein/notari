import { AnimatePresence, motion } from "framer-motion";
import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
} from "react";
import { useOptimizedKeyboardEvents } from "../../hooks/useOptimizedEventHandling";
import { trayResourceManager } from "../../services/tray/TrayResourceManager";
import type {
  NavigationOptions,
  TrayRouterContextValue,
  TrayRouterState,
  TrayView,
} from "../../types/tray.types";

// Action types for the router reducer
type RouterAction =
  | {
      type: "NAVIGATE_TO";
      payload: { view: TrayView; options?: NavigationOptions };
    }
  | { type: "GO_BACK" }
  | { type: "GO_FORWARD" }
  | { type: "REGISTER_VIEW"; payload: TrayView }
  | { type: "UNREGISTER_VIEW"; payload: string }
  | { type: "SET_TRANSITIONING"; payload: boolean }
  | {
      type: "SET_TRANSITION_DIRECTION";
      payload: "forward" | "backward" | null;
    };

// Initial state
const initialState: TrayRouterState = {
  navigation: {
    currentView: null,
    viewStack: [],
    canGoBack: false,
    canGoForward: false,
  },
  isTransitioning: false,
  transitionDirection: null,
};

// Router reducer
function routerReducer(
  state: TrayRouterState,
  action: RouterAction,
): TrayRouterState {
  switch (action.type) {
    case "NAVIGATE_TO": {
      const { view, options = {} } = action.payload;
      const { replace = false } = options;

      const newViewStack = [...state.navigation.viewStack];

      if (replace && newViewStack.length > 0) {
        // Replace current view
        newViewStack[newViewStack.length - 1] = view;
      } else {
        // Add new view to stack
        if (state.navigation.currentView) {
          newViewStack.push(state.navigation.currentView);
        }
      }

      return {
        ...state,
        navigation: {
          currentView: view,
          viewStack: newViewStack,
          canGoBack: newViewStack.length > 0,
          canGoForward: false, // Clear forward history when navigating to new view
        },
        transitionDirection: "forward",
      };
    }

    case "GO_BACK": {
      if (state.navigation.viewStack.length === 0) {
        return state;
      }

      const newViewStack = [...state.navigation.viewStack];
      const previousView = newViewStack.pop();

      if (!previousView) {
        return state;
      }

      return {
        ...state,
        navigation: {
          currentView: previousView,
          viewStack: newViewStack,
          canGoBack: newViewStack.length > 0,
          canGoForward: true,
        },
        transitionDirection: "backward",
      };
    }

    case "REGISTER_VIEW": {
      // Views are registered but not stored in state - they're managed by the router
      return state;
    }

    case "UNREGISTER_VIEW": {
      // Remove view from stack if it exists
      const viewId = action.payload;
      const newViewStack = state.navigation.viewStack.filter(
        (view) => view.id !== viewId,
      );

      return {
        ...state,
        navigation: {
          ...state.navigation,
          viewStack: newViewStack,
          canGoBack: newViewStack.length > 0,
        },
      };
    }

    case "SET_TRANSITIONING": {
      return {
        ...state,
        isTransitioning: action.payload,
      };
    }

    case "SET_TRANSITION_DIRECTION": {
      return {
        ...state,
        transitionDirection: action.payload,
      };
    }

    default:
      return state;
  }
}

// Context
const TrayRouterContext = createContext<TrayRouterContextValue | null>(null);

// Hook to use the router
export function useTrayRouter(): TrayRouterContextValue {
  const context = useContext(TrayRouterContext);
  if (!context) {
    throw new Error("useTrayRouter must be used within a TrayRouterProvider");
  }
  return context;
}

// Router provider props
interface TrayRouterProviderProps {
  children: React.ReactNode;
  initialView?: TrayView;
}

// Router provider component
export function TrayRouterProvider({
  children,
  initialView,
}: TrayRouterProviderProps) {
  const [state, dispatch] = useReducer(routerReducer, {
    ...initialState,
    navigation: {
      ...initialState.navigation,
      currentView: initialView || null,
    },
  });

  const registeredViews = useRef<Map<string, TrayView>>(new Map());
  const transitionTimeoutRef = useRef<number | null>(null);

  const navigateTo = useCallback(
    (
      viewId: string,
      props?: Record<string, unknown>,
      options?: NavigationOptions,
    ) => {
      const registeredView = registeredViews.current.get(viewId);
      if (!registeredView) {
        console.warn(`View with id "${viewId}" is not registered`);
        return;
      }

      const view: TrayView = {
        ...registeredView,
        props: props || registeredView.props,
      };

      // Record activity for resource management
      trayResourceManager.recordActivity();

      dispatch({ type: "SET_TRANSITIONING", payload: true });
      dispatch({ type: "NAVIGATE_TO", payload: { view, options } });

      // Clear any existing transition timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }

      // Get animation duration from resource config
      const config = trayResourceManager.getConfig();
      const animationDuration = config.enableAnimations ? 300 : 0;

      // Reset transitioning state after animation
      transitionTimeoutRef.current = window.setTimeout(() => {
        dispatch({ type: "SET_TRANSITIONING", payload: false });
        transitionTimeoutRef.current = null;
      }, animationDuration);
    },
    [],
  );

  const goBack = useCallback(() => {
    if (!state.navigation.canGoBack) {
      return;
    }

    // Record activity for resource management
    trayResourceManager.recordActivity();

    dispatch({ type: "SET_TRANSITIONING", payload: true });
    dispatch({ type: "GO_BACK" });

    // Clear any existing transition timeout
    if (transitionTimeoutRef.current) {
      clearTimeout(transitionTimeoutRef.current);
    }

    // Get animation duration from resource config
    const config = trayResourceManager.getConfig();
    const animationDuration = config.enableAnimations ? 300 : 0;

    transitionTimeoutRef.current = window.setTimeout(() => {
      dispatch({ type: "SET_TRANSITIONING", payload: false });
      transitionTimeoutRef.current = null;
    }, animationDuration);
  }, [state.navigation.canGoBack]);

  const goForward = useCallback(() => {
    // Forward navigation not implemented in this version
    console.warn("Forward navigation not implemented");
  }, []);

  const getCurrentView = useCallback(() => {
    return state.navigation.currentView;
  }, [state.navigation.currentView]);

  const canGoBack = useCallback(() => {
    return state.navigation.canGoBack;
  }, [state.navigation.canGoBack]);

  const canGoForward = useCallback(() => {
    return state.navigation.canGoForward;
  }, [state.navigation.canGoForward]);

  const registerView = useCallback((view: TrayView) => {
    registeredViews.current.set(view.id, view);
    dispatch({ type: "REGISTER_VIEW", payload: view });
  }, []);

  const unregisterView = useCallback((viewId: string) => {
    registeredViews.current.delete(viewId);
    dispatch({ type: "UNREGISTER_VIEW", payload: viewId });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
        transitionTimeoutRef.current = null;
      }
    };
  }, []);

  const contextValue: TrayRouterContextValue = {
    state,
    navigateTo,
    goBack,
    goForward,
    getCurrentView,
    canGoBack,
    canGoForward,
    registerView,
    unregisterView,
  };

  return (
    <TrayRouterContext.Provider value={contextValue}>
      {children}
    </TrayRouterContext.Provider>
  );
}

// Enhanced animation variants for view transitions with resource-aware configuration
const getSlideVariants = (enableAnimations: boolean) => {
  if (!enableAnimations) {
    return {
      enter: { opacity: 1, x: 0 },
      center: { opacity: 1, x: 0 },
      exit: { opacity: 1, x: 0 },
    };
  }

  return {
    enter: (direction: "forward" | "backward") => ({
      x: direction === "forward" ? "100%" : "-100%",
      opacity: 0,
      scale: 0.98,
    }),
    center: {
      x: 0,
      opacity: 1,
      scale: 1,
    },
    exit: (direction: "forward" | "backward") => ({
      x: direction === "forward" ? "-100%" : "100%",
      opacity: 0,
      scale: 0.98,
    }),
  };
};

// Fade variants for smoother transitions when performance is limited
const getFadeVariants = (enableAnimations: boolean) => {
  if (!enableAnimations) {
    return {
      enter: { opacity: 1 },
      center: { opacity: 1 },
      exit: { opacity: 1 },
    };
  }

  return {
    enter: { opacity: 0, y: 10 },
    center: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
  };
};

// Router outlet component that renders the current view
interface TrayRouterOutletProps {
  className?: string;
}

export function TrayRouterOutlet({ className = "" }: TrayRouterOutletProps) {
  const { state } = useTrayRouter();
  const { currentView } = state.navigation;
  const { transitionDirection, isTransitioning } = state;

  // Get resource configuration for animations
  const config = trayResourceManager.getConfig();
  const slideVariants = getSlideVariants(config.enableAnimations);
  const fadeVariants = getFadeVariants(config.enableAnimations);

  // Use fade transitions for better performance when resource level is minimal
  const shouldUseFade = config.syncInterval > 20000; // Minimal resource level
  const variants = shouldUseFade ? fadeVariants : slideVariants;

  if (!currentView) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <motion.p
          className="text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          No view to display
        </motion.p>
      </div>
    );
  }

  const Component = currentView.component;

  return (
    <div className={`relative overflow-hidden h-full ${className}`}>
      <AnimatePresence
        mode="wait"
        custom={transitionDirection}
        onExitComplete={() => {
          // Record activity when transition completes
          trayResourceManager.recordActivity();
        }}
      >
        <motion.div
          key={currentView.id}
          custom={transitionDirection}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{
            type: config.enableAnimations ? "spring" : "tween",
            stiffness: 300,
            damping: 30,
            ease: "easeInOut",
            duration: config.enableAnimations ? 0.3 : 0,
          }}
          className="absolute inset-0"
          style={{
            // Optimize rendering performance
            willChange: isTransitioning ? "transform, opacity" : "auto",
          }}
        >
          <Component {...(currentView.props || {})} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// Navigation header component
interface TrayNavigationHeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBack?: () => void;
  className?: string;
}

export function TrayNavigationHeader({
  title,
  showBackButton = true,
  onBack,
  className = "",
}: TrayNavigationHeaderProps) {
  const { goBack, canGoBack, getCurrentView } = useTrayRouter();

  const currentView = getCurrentView();
  const displayTitle = title || currentView?.title || "Notari";
  const canShowBack = showBackButton && canGoBack();

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      goBack();
    }
  }, [onBack, goBack]);

  // Optimized keyboard navigation
  useOptimizedKeyboardEvents(
    window,
    {
      onKeyDown: useCallback(
        (event: KeyboardEvent) => {
          if (event.key === "Escape" && canShowBack) {
            event.preventDefault();
            handleBack();
          }
        },
        [canShowBack, handleBack],
      ),
    },
    { throttle: 100 },
  );

  return (
    <div
      className={`flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 ${className}`}
    >
      <div className="flex items-center space-x-3">
        {canShowBack && (
          <button
            type="button"
            onClick={handleBack}
            className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Go back"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <title>Back arrow</title>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {displayTitle}
        </h1>
      </div>
    </div>
  );
}

// Hook to register a view component
export function useViewRegistration(view: TrayView) {
  const { registerView, unregisterView } = useTrayRouter();

  useEffect(() => {
    registerView(view);
    return () => unregisterView(view.id);
  }, [view, registerView, unregisterView]);
}
