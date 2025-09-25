import { create } from "zustand";
import {
  createJSONStorage,
  persist,
  subscribeWithSelector,
} from "zustand/middleware";
import type { SessionStatus, WorkSession } from "../types/session.types";
import type {
  NavigationState,
  PopoverPosition,
  ThemeMode,
  TrayPreferences,
  TraySettings,
  TrayView,
} from "../types/tray.types";

// Popover state interface
export interface PopoverState {
  isVisible: boolean;
  position: { x: number; y: number } | null;
  size: { width: number; height: number };
}

// Session state interface for tray
export interface TraySessionState {
  currentSession: WorkSession | null;
  recentSessions: WorkSession[];
  sessionStatus: SessionStatus | null;
  sessionDuration: number;
  isRecording: boolean;
}

// Notification state interface
export interface NotificationState {
  notifications: Array<{
    id: string;
    type: "info" | "success" | "warning" | "error";
    title: string;
    message: string;
    timestamp: number;
    read: boolean;
  }>;
  unreadCount: number;
}

// Main tray store state interface
export interface TrayState {
  // UI State
  popover: PopoverState;
  navigation: NavigationState;
  isTransitioning: boolean;

  // Session State
  session: TraySessionState;

  // Notifications
  notifications: NotificationState;

  // Settings and Preferences
  preferences: TrayPreferences;
  settings: TraySettings;

  // Synchronization state
  lastSyncTimestamp: number;
  isSyncing: boolean;
  syncErrors: string[];
}

// Actions interface
export interface TrayActions {
  // Popover actions
  showPopover: (position?: { x: number; y: number }) => void;
  hidePopover: () => void;
  togglePopover: (position?: { x: number; y: number }) => void;
  updatePopoverPosition: (position: { x: number; y: number }) => void;
  updatePopoverSize: (size: { width: number; height: number }) => void;

  // Navigation actions
  navigateTo: (view: TrayView) => void;
  goBack: () => void;
  setTransitioning: (isTransitioning: boolean) => void;

  // Session actions
  updateCurrentSession: (session: WorkSession | null) => void;
  updateSessionStatus: (status: SessionStatus | null) => void;
  updateSessionDuration: (duration: number) => void;
  setRecording: (isRecording: boolean) => void;
  addRecentSession: (session: WorkSession) => void;
  updateRecentSessions: (sessions: WorkSession[]) => void;

  // Notification actions
  addNotification: (
    notification: Omit<
      NotificationState["notifications"][0],
      "id" | "timestamp" | "read"
    >,
  ) => void;
  markNotificationRead: (id: string) => void;
  clearNotification: (id: string) => void;
  clearAllNotifications: () => void;

  // Settings actions
  updatePreferences: (preferences: Partial<TrayPreferences>) => void;
  updateSettings: (settings: Partial<TraySettings>) => void;
  resetSettings: () => void;

  // Synchronization actions
  startSync: () => void;
  endSync: (errors?: string[]) => void;
  addSyncError: (error: string) => void;
  clearSyncErrors: () => void;

  // Utility actions
  reset: () => void;
}

// Default values
const defaultPreferences: TrayPreferences = {
  theme: "system" as ThemeMode,
  position: "auto" as PopoverPosition,
  hotkey: "CommandOrControl+Shift+N",
  showNotifications: true,
  autoHide: true,
  quickActions: ["start-session", "create-proof-pack", "recent-sessions"],
};

const defaultSettings: TraySettings = {
  preferences: defaultPreferences,
  notifications: {
    sessionStart: true,
    sessionStop: true,
    proofPackCreated: true,
    blockchainAnchor: true,
    error: true,
    warning: true,
    info: false,
    showSounds: true,
  },
  hotkeys: [
    {
      id: "toggle-popover",
      keys: "CommandOrControl+Shift+N",
      description: "Toggle tray popover",
      enabled: true,
    },
    {
      id: "start-stop-session",
      keys: "CommandOrControl+Shift+S",
      description: "Start/Stop session",
      enabled: true,
    },
  ],
};

const initialState: TrayState = {
  popover: {
    isVisible: false,
    position: null,
    size: { width: 400, height: 600 },
  },
  navigation: {
    currentView: null,
    viewStack: [],
    canGoBack: false,
    canGoForward: false,
  },
  isTransitioning: false,
  session: {
    currentSession: null,
    recentSessions: [],
    sessionStatus: null,
    sessionDuration: 0,
    isRecording: false,
  },
  notifications: {
    notifications: [],
    unreadCount: 0,
  },
  preferences: defaultPreferences,
  settings: defaultSettings,
  lastSyncTimestamp: 0,
  isSyncing: false,
  syncErrors: [],
};

// Create the store with persistence for preferences and settings
export const useTrayStore = create<TrayState & TrayActions>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
        ...initialState,

        // Popover actions
        showPopover: (position) => {
          set((state) => ({
            popover: {
              ...state.popover,
              isVisible: true,
              position: position || state.popover.position,
            },
          }));
        },

        hidePopover: () => {
          set((state) => ({
            popover: {
              ...state.popover,
              isVisible: false,
            },
          }));
        },

        togglePopover: (position) => {
          const { popover } = get();
          if (popover.isVisible) {
            get().hidePopover();
          } else {
            get().showPopover(position);
          }
        },

        updatePopoverPosition: (position) => {
          set((state) => ({
            popover: {
              ...state.popover,
              position,
            },
          }));
        },

        updatePopoverSize: (size) => {
          set((state) => ({
            popover: {
              ...state.popover,
              size,
            },
          }));
        },

        // Navigation actions
        navigateTo: (view) => {
          set((state) => {
            const newStack = [...state.navigation.viewStack];
            if (state.navigation.currentView) {
              newStack.push(state.navigation.currentView);
            }

            return {
              navigation: {
                currentView: view,
                viewStack: newStack,
                canGoBack: newStack.length > 0,
                canGoForward: false,
              },
            };
          });
        },

        goBack: () => {
          set((state) => {
            const newStack = [...state.navigation.viewStack];
            const previousView = newStack.pop();

            if (previousView) {
              return {
                navigation: {
                  currentView: previousView,
                  viewStack: newStack,
                  canGoBack: newStack.length > 0,
                  canGoForward: true,
                },
              };
            }

            return state;
          });
        },

        setTransitioning: (isTransitioning) => {
          set({ isTransitioning });
        },

        // Session actions
        updateCurrentSession: (session) => {
          set((state) => ({
            session: {
              ...state.session,
              currentSession: session,
            },
          }));
        },

        updateSessionStatus: (status) => {
          set((state) => ({
            session: {
              ...state.session,
              sessionStatus: status,
            },
          }));
        },

        updateSessionDuration: (duration) => {
          set((state) => ({
            session: {
              ...state.session,
              sessionDuration: duration,
            },
          }));
        },

        setRecording: (isRecording) => {
          set((state) => ({
            session: {
              ...state.session,
              isRecording,
            },
          }));
        },

        addRecentSession: (session) => {
          set((state) => {
            const recentSessions = [
              session,
              ...state.session.recentSessions,
            ].slice(0, 10); // Keep only last 10 sessions

            return {
              session: {
                ...state.session,
                recentSessions,
              },
            };
          });
        },

        updateRecentSessions: (sessions) => {
          set((state) => ({
            session: {
              ...state.session,
              recentSessions: sessions.slice(0, 10),
            },
          }));
        },

        // Notification actions
        addNotification: (notification) => {
          const id = `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const timestamp = Date.now();

          set((state) => {
            const newNotification = {
              ...notification,
              id,
              timestamp,
              read: false,
            };

            const notifications = [
              newNotification,
              ...state.notifications.notifications,
            ].slice(0, 50); // Keep only last 50 notifications

            return {
              notifications: {
                notifications,
                unreadCount: state.notifications.unreadCount + 1,
              },
            };
          });
        },

        markNotificationRead: (id) => {
          set((state) => {
            const notifications = state.notifications.notifications.map((n) =>
              n.id === id ? { ...n, read: true } : n,
            );

            const unreadCount = notifications.filter((n) => !n.read).length;

            return {
              notifications: {
                notifications,
                unreadCount,
              },
            };
          });
        },

        clearNotification: (id) => {
          set((state) => {
            const notifications = state.notifications.notifications.filter(
              (n) => n.id !== id,
            );
            const unreadCount = notifications.filter((n) => !n.read).length;

            return {
              notifications: {
                notifications,
                unreadCount,
              },
            };
          });
        },

        clearAllNotifications: () => {
          set({
            notifications: {
              notifications: [],
              unreadCount: 0,
            },
          });
        },

        // Settings actions
        updatePreferences: (preferences) => {
          set((state) => ({
            preferences: {
              ...state.preferences,
              ...preferences,
            },
            settings: {
              ...state.settings,
              preferences: {
                ...state.settings.preferences,
                ...preferences,
              },
            },
          }));
        },

        updateSettings: (settings) => {
          set((state) => ({
            settings: {
              ...state.settings,
              ...settings,
            },
          }));
        },

        resetSettings: () => {
          set({
            preferences: defaultPreferences,
            settings: defaultSettings,
          });
        },

        // Synchronization actions
        startSync: () => {
          set({
            isSyncing: true,
            syncErrors: [],
          });
        },

        endSync: (errors = []) => {
          set({
            isSyncing: false,
            lastSyncTimestamp: Date.now(),
            syncErrors: errors,
          });
        },

        addSyncError: (error) => {
          set((state) => ({
            syncErrors: [...state.syncErrors, error],
          }));
        },

        clearSyncErrors: () => {
          set({ syncErrors: [] });
        },

        // Utility actions
        reset: () => {
          set(initialState);
        },
      }),
      {
        name: "notari-tray-store",
        storage: createJSONStorage(() => localStorage),
        partialize: (state) => ({
          // Only persist preferences, settings, and popover size/position
          preferences: state.preferences,
          settings: state.settings,
          popover: {
            position: state.popover.position,
            size: state.popover.size,
            isVisible: false, // Don't persist visibility
          },
        }),
      },
    ),
  ),
);

// Selectors for common state access patterns
export const selectPopoverState = (state: TrayState & TrayActions) =>
  state.popover;
export const selectNavigationState = (state: TrayState & TrayActions) =>
  state.navigation;
export const selectSessionState = (state: TrayState & TrayActions) =>
  state.session;
export const selectNotificationState = (state: TrayState & TrayActions) =>
  state.notifications;
export const selectPreferences = (state: TrayState & TrayActions) =>
  state.preferences;
export const selectSettings = (state: TrayState & TrayActions) =>
  state.settings;
export const selectSyncState = (state: TrayState & TrayActions) => ({
  isSyncing: state.isSyncing,
  lastSyncTimestamp: state.lastSyncTimestamp,
  syncErrors: state.syncErrors,
});
