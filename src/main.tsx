import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { TrayApp } from "./components/tray/TrayApp";
import { Provider } from "./provider";
import { trayCompatibilityService } from "./services/compatibility/TrayCompatibilityService";
import { appLifecycleManager } from "./services/lifecycle/AppLifecycleManager";
import "@/styles/globals.css";

// Check if we're running in tray mode (popover window) or fallback mode (main window)
const isTrayMode =
  window.location.search.includes("tray=true") ||
  (window as any).__TAURI_INTERNALS__?.metadata?.currentWindow?.label ===
    "popover";

// Initialize application with tray-based lifecycle
const initializeApp = async () => {
  try {
    // Initialize application lifecycle management
    await appLifecycleManager.initialize();

    // Initialize compatibility layer to ensure backward compatibility
    await trayCompatibilityService.initialize();

    console.log(`Initializing app in ${isTrayMode ? "tray" : "window"} mode`);
  } catch (error) {
    console.error("Failed to initialize app services:", error);
    // Continue with app initialization even if services fail
  }

  // Render appropriate app based on mode
  const AppComponent = isTrayMode ? TrayApp : App;

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <Provider>
        <AppComponent />
      </Provider>
    </React.StrictMode>,
  );
};

// Initialize the app
initializeApp().catch(console.error);
