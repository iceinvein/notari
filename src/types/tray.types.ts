// Type definitions for tray-based UI system

import type { ComponentType } from "react";

export interface TrayView {
  id: string;
  component: ComponentType<Record<string, unknown>>;
  title: string;
  canGoBack: boolean;
  props?: Record<string, unknown>;
}

export interface NavigationState {
  currentView: TrayView | null;
  viewStack: TrayView[];
  canGoBack: boolean;
  canGoForward: boolean;
}

export interface TrayRouterState {
  navigation: NavigationState;
  isTransitioning: boolean;
  transitionDirection: "forward" | "backward" | null;
}

export interface NavigationOptions {
  replace?: boolean;
  animate?: boolean;
  preserveState?: boolean;
}

export type TrayViewId =
  | "dashboard"
  | "session-controls"
  | "recent-sessions"
  | "proof-pack-manager"
  | "settings"
  | "notifications";

export interface TrayRouterContextValue {
  state: TrayRouterState;
  navigateTo: (
    viewId: string,
    props?: Record<string, unknown>,
    options?: NavigationOptions,
  ) => void;
  goBack: () => void;
  goForward: () => void;
  getCurrentView: () => TrayView | null;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  registerView: (view: TrayView) => void;
  unregisterView: (viewId: string) => void;
}

export interface ViewTransition {
  from: TrayView | null;
  to: TrayView;
  direction: "forward" | "backward";
  duration: number;
}

// Settings and Preferences Types
export type ThemeMode = "light" | "dark" | "system";
export type PopoverPosition = "auto" | "center";

export interface TrayPreferences {
  theme: ThemeMode;
  position: PopoverPosition;
  hotkey: string;
  showNotifications: boolean;
  autoHide: boolean;
  quickActions: string[];
}

export interface TrayNotificationSettings {
  sessionStart: boolean;
  sessionStop: boolean;
  proofPackCreated: boolean;
  blockchainAnchor: boolean;
  error: boolean;
  warning: boolean;
  info: boolean;
  showSounds: boolean;
}

export interface HotkeyConfig {
  id: string;
  keys: string;
  description: string;
  enabled: boolean;
}

export interface TraySettings {
  preferences: TrayPreferences;
  notifications: TrayNotificationSettings;
  hotkeys: HotkeyConfig[];
}

export interface SettingsValidationError {
  field: string;
  message: string;
}

export interface SettingsUpdateResult {
  success: boolean;
  errors?: SettingsValidationError[];
}
