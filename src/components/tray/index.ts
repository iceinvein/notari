// Tray-based UI components for Notari

// Re-export types
export type {
  NavigationOptions,
  NavigationState,
  TrayRouterContextValue,
  TrayRouterState,
  TrayView,
  TrayViewId,
} from "../../types/tray.types";
export { ProofPackManager } from "./ProofPackManager";
export { RecentSessionsList } from "./RecentSessionsList";
export { SessionControls } from "./SessionControls";
export { TrayApp } from "./TrayApp";
export { TrayDashboard } from "./TrayDashboard";
export {
  TrayNavigationHeader,
  TrayRouterOutlet,
  TrayRouterProvider,
  useTrayRouter,
  useViewRegistration,
} from "./TrayRouter";
export { TraySettings } from "./TraySettings";
