import { Switch } from "@heroui/react";
import { useTheme } from "@heroui/use-theme";
import type React from "react";

const MoonIcon = (props: React.SVGProps<SVGSVGElement>) => {
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

const SunIcon = (props: React.SVGProps<SVGSVGElement>) => {
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

interface ThemeToggleProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  variant?: "compact" | "full";
}

const ThemeToggle: React.FC<ThemeToggleProps> = ({
  size = "md",
  className = "",
  variant = "full",
}) => {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  if (variant === "compact") {
    return (
      <Switch
        size={size}
        color="secondary"
        isSelected={isDark}
        onValueChange={toggleTheme}
        thumbIcon={({ isSelected, className: iconClassName }) =>
          isSelected ? (
            <MoonIcon className={iconClassName} />
          ) : (
            <SunIcon className={iconClassName} />
          )
        }
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
            {isDark ? (
              <MoonIcon className="w-5 h-5 text-primary-foreground" />
            ) : (
              <SunIcon className="w-5 h-5 text-primary-foreground" />
            )}
          </div>

          <div className="flex flex-col">
            <span className="font-semibold text-sm text-foreground transition-colors duration-300">
              {isDark ? "Dark Mode" : "Light Mode"}
            </span>
            <span className="text-xs text-foreground-500 transition-colors duration-300">
              Tap to switch
            </span>
          </div>
        </div>

        {/* Hero UI Switch */}
        <Switch
          size={size}
          color="secondary"
          isSelected={isDark}
          onValueChange={toggleTheme}
          thumbIcon={({ isSelected, className: iconClassName }) =>
            isSelected ? (
              <MoonIcon className={iconClassName} />
            ) : (
              <SunIcon className={iconClassName} />
            )
          }
          classNames={{
            wrapper: "bg-primary",
          }}
          aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
        />
      </div>
    </div>
  );
};

export default ThemeToggle;
