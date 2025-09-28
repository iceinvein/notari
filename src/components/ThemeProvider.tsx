import type React from "react";

interface ThemeProviderProps {
  children: React.ReactNode;
}

const THEME_KEY = "notari_theme";

// Apply theme immediately before React renders
const applyThemeImmediately = () => {
  try {
    const savedTheme = localStorage.getItem(THEME_KEY) as "light" | "dark" | "system" | null;

    if (savedTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else if (savedTheme === "light") {
      document.documentElement.classList.remove("dark");
    } else {
      // System theme detection (for 'system' or null)
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  } catch {
    // Default to system theme
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }
};

// Apply theme immediately
applyThemeImmediately();

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return <>{children}</>;
};
