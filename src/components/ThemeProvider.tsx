import type { ReactNode } from "react";

type ThemeProviderProps = {
	children: ReactNode;
};

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

export function ThemeProvider({ children }: ThemeProviderProps) {
	return <>{children}</>;
}
