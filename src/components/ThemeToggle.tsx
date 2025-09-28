import { Switch } from "@heroui/react";
import { useTheme } from "@heroui/use-theme";
import type { SVGProps } from "react";
import { useEffect, useState } from "react";

const MoonIcon = (props: SVGProps<SVGSVGElement>) => {
	return (
		<svg
			aria-hidden="true"
			focusable="false"
			height="1em"
			role="presentation"
			viewBox="0 0 24 24"
			width="1em"
			{...props}
		>
			<path
				d="M21.53 15.93c-.16-.27-.61-.69-1.73-.49a8.46 8.46 0 01-1.88.13 8.409 8.409 0 01-5.91-2.82 8.068 8.068 0 01-1.44-8.66c.44-1.01.13-1.54-.09-1.76s-.77-.55-1.83-.11a10.318 10.318 0 00-6.32 10.21 10.475 10.475 0 007.04 8.99 10 10 0 002.89.55c.16.01.32.02.48.02a10.5 10.5 0 008.47-4.27c.67-.93.49-1.519.32-1.79z"
				fill="currentColor"
			/>
		</svg>
	);
};

const SunIcon = (props: SVGProps<SVGSVGElement>) => {
	return (
		<svg
			aria-hidden="true"
			focusable="false"
			height="1em"
			role="presentation"
			viewBox="0 0 24 24"
			width="1em"
			{...props}
		>
			<g fill="currentColor">
				<path d="M19 12a7 7 0 11-7-7 7 7 0 017 7z" />
				<path d="M12 22.96a.969.969 0 01-1-.96v-.08a1 1 0 012 0 1.038 1.038 0 01-1 1.04zm7.14-2.82a1.024 1.024 0 01-.71-.29l-.13-.13a1 1 0 011.41-1.41l.13.13a1 1 0 010 1.41.984.984 0 01-.7.29zm-14.28 0a1.024 1.024 0 01-.71-.29 1 1 0 010-1.41l.13-.13a1 1 0 011.41 1.41l-.13.13a1 1 0 01-.7.29zM22 13h-.08a1 1 0 010-2 1.038 1.038 0 011.04 1 .969.969 0 01-.96 1zM2.08 13H2a1 1 0 010-2 1.038 1.038 0 011.04 1 .969.969 0 01-.96 1zm16.93-7.01a1.024 1.024 0 01-.71-.29 1 1 0 010-1.41l.13-.13a1 1 0 011.41 1.41l-.13.13a.984.984 0 01-.7.29zm-14.02 0a1.024 1.024 0 01-.71-.29l-.13-.14a1 1 0 011.41-1.41l.13.13a1 1 0 010 1.41.97.97 0 01-.7.3zM12 3.04a.969.969 0 01-1-.96V2a1 1 0 012 0 1.038 1.038 0 01-1 1.04z" />
			</g>
		</svg>
	);
};

const SystemIcon = (props: SVGProps<SVGSVGElement>) => {
	return (
		<svg
			aria-hidden="true"
			focusable="false"
			height="1em"
			role="presentation"
			viewBox="0 0 24 24"
			width="1em"
			{...props}
		>
			<g fill="currentColor">
				<path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM6 6v7h12V6H6z" />
				<path d="M7 16h10v1a1 1 0 01-1 1H8a1 1 0 01-1-1v-1z" />
				<path d="M10 18h4v1h-4v-1z" />
			</g>
		</svg>
	);
};

type ThemeToggleProps = {
	size?: "sm" | "md" | "lg";
	className?: string;
	variant?: "compact" | "full";
};

const THEME_KEY = "notari_theme";

export default function ThemeToggle({
	size = "md",
	className = "",
	variant = "full",
}: ThemeToggleProps) {
	const { setTheme } = useTheme();
	const [currentTheme, setCurrentTheme] = useState<"light" | "dark" | "system">("system");

	// Load current theme from localStorage on mount
	useEffect(() => {
		const savedTheme = localStorage.getItem(THEME_KEY) as "light" | "dark" | "system" | null;
		setCurrentTheme(savedTheme || "system");
	}, []);

	const toggleTheme = () => {
		// Cycle through: light → dark → system → light...
		let newTheme: "light" | "dark" | "system";
		if (currentTheme === "light") {
			newTheme = "dark";
		} else if (currentTheme === "dark") {
			newTheme = "system";
		} else {
			newTheme = "light";
		}

		setCurrentTheme(newTheme);

		// Apply theme immediately
		if (newTheme === "dark") {
			document.documentElement.classList.add("dark");
			setTheme("dark");
		} else if (newTheme === "light") {
			document.documentElement.classList.remove("dark");
			setTheme("light");
		} else {
			// System theme
			const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			if (prefersDark) {
				document.documentElement.classList.add("dark");
				setTheme("dark");
			} else {
				document.documentElement.classList.remove("dark");
				setTheme("light");
			}
		}

		// Persist to localStorage
		try {
			localStorage.setItem(THEME_KEY, newTheme);
		} catch {
			// Silently fail if localStorage doesn't work
		}
	};

	// Determine display state
	const getThemeDisplay = () => {
		if (currentTheme === "system") {
			const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
			return { mode: "system", isDark: prefersDark };
		}
		return { mode: currentTheme, isDark: currentTheme === "dark" };
	};

	const { isDark } = getThemeDisplay();

	if (variant === "compact") {
		return (
			<Switch
				size={size}
				color="secondary"
				isSelected={isDark}
				onValueChange={toggleTheme}
				thumbIcon={({ isSelected, className: iconClassName }) => {
					if (currentTheme === "system") {
						return <SystemIcon className={iconClassName} />;
					}
					return isSelected ? (
						<MoonIcon className={iconClassName} />
					) : (
						<SunIcon className={iconClassName} />
					);
				}}
				className={className}
				classNames={{
					wrapper: "bg-primary",
				}}
				aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
			/>
		);
	}

	return (
		<div
			className={`
      group relative overflow-hidden rounded-2xl p-4 transition-all duration-300 ease-in-out
      bg-content1 border border-divider
      hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl
      ${className}
    `}
		>
			<div className="flex items-center justify-between">
				{/* Icon and text content */}
				<div className="flex items-center gap-3">
					<div className="flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300 bg-primary shadow-lg">
						{currentTheme === "system" ? (
							<SystemIcon className="w-5 h-5 text-primary-foreground" />
						) : isDark ? (
							<MoonIcon className="w-5 h-5 text-primary-foreground" />
						) : (
							<SunIcon className="w-5 h-5 text-primary-foreground" />
						)}
					</div>

					<div className="flex flex-col">
						<span className="font-semibold text-sm text-foreground transition-colors duration-300">
							{currentTheme === "system" ? "System Theme" : isDark ? "Dark Mode" : "Light Mode"}
						</span>
						<span className="text-xs text-foreground-500 transition-colors duration-300">
							{currentTheme === "system" ? "Follows OS setting" : "Tap to switch"}
						</span>
					</div>
				</div>

				{/* Hero UI Switch */}
				<Switch
					size={size}
					color="secondary"
					isSelected={currentTheme === "system" ? false : isDark}
					onValueChange={toggleTheme}
					thumbIcon={({ isSelected, className: iconClassName }) => {
						if (currentTheme === "system") {
							return <SystemIcon className={iconClassName} />;
						}
						return isSelected ? (
							<MoonIcon className={iconClassName} />
						) : (
							<SunIcon className={iconClassName} />
						);
					}}
					classNames={{
						wrapper: "bg-primary",
					}}
					aria-label={`Switch to ${currentTheme === "system" ? "system" : isDark ? "light" : "dark"} mode`}
				/>
			</div>
		</div>
	);
}
