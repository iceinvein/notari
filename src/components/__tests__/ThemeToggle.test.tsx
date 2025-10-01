import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ThemeToggle from '../ThemeToggle';

// Mock HeroUI hooks
vi.mock('@heroui/use-theme', () => ({
  useTheme: () => ({
    setTheme: vi.fn(),
  }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset document classes
    document.documentElement.classList.remove('dark');
  });

  describe('compact variant', () => {
    it('should render compact variant', () => {
      render(<ThemeToggle variant="compact" />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toBeInTheDocument();
    });

    it('should toggle theme on click', () => {
      render(<ThemeToggle variant="compact" />);

      const toggle = screen.getByRole('switch');

      // Initial state should be system (not selected)
      expect(toggle).not.toBeChecked();

      // Click to toggle
      fireEvent.click(toggle);

      // Should save to localStorage
      expect(localStorage.getItem('notari_theme')).toBeTruthy();
    });

    it('should cycle through themes: light -> dark -> system', () => {
      render(<ThemeToggle variant="compact" />);

      const toggle = screen.getByRole('switch');

      // Start with system, click to go to light
      fireEvent.click(toggle);
      expect(localStorage.getItem('notari_theme')).toBe('light');

      // Click to go to dark
      fireEvent.click(toggle);
      expect(localStorage.getItem('notari_theme')).toBe('dark');

      // Click to go back to system
      fireEvent.click(toggle);
      expect(localStorage.getItem('notari_theme')).toBe('system');
    });
  });

  describe('full variant', () => {
    it('should render full variant with text', () => {
      render(<ThemeToggle variant="full" />);

      // Should show "System Theme" by default
      expect(screen.getByText('System Theme')).toBeInTheDocument();
      expect(screen.getByText('Follows OS setting')).toBeInTheDocument();
    });

    it('should show correct text for light mode', () => {
      localStorage.setItem('notari_theme', 'light');

      render(<ThemeToggle variant="full" />);

      expect(screen.getByText('Light Mode')).toBeInTheDocument();
      expect(screen.getByText('Tap to switch')).toBeInTheDocument();
    });

    it('should show correct text for dark mode', () => {
      localStorage.setItem('notari_theme', 'dark');

      render(<ThemeToggle variant="full" />);

      expect(screen.getByText('Dark Mode')).toBeInTheDocument();
      expect(screen.getByText('Tap to switch')).toBeInTheDocument();
    });

    it('should toggle theme on switch click', () => {
      render(<ThemeToggle variant="full" />);

      const toggle = screen.getByRole('switch');

      // Click to toggle
      fireEvent.click(toggle);

      // Should update localStorage
      expect(localStorage.getItem('notari_theme')).toBeTruthy();
    });
  });

  describe('theme persistence', () => {
    it('should load saved theme from localStorage', () => {
      localStorage.setItem('notari_theme', 'dark');

      render(<ThemeToggle variant="full" />);

      expect(screen.getByText('Dark Mode')).toBeInTheDocument();
    });

    it('should default to system theme when no saved theme', () => {
      render(<ThemeToggle variant="full" />);

      expect(screen.getByText('System Theme')).toBeInTheDocument();
    });

    it('should persist theme changes to localStorage', () => {
      render(<ThemeToggle variant="compact" />);

      const toggle = screen.getByRole('switch');

      // Toggle to light
      fireEvent.click(toggle);
      expect(localStorage.getItem('notari_theme')).toBe('light');

      // Toggle to dark
      fireEvent.click(toggle);
      expect(localStorage.getItem('notari_theme')).toBe('dark');
    });
  });

  describe('size prop', () => {
    it('should accept size prop', () => {
      const { rerender } = render(<ThemeToggle size="sm" variant="compact" />);
      expect(screen.getByRole('switch')).toBeInTheDocument();

      rerender(<ThemeToggle size="md" variant="compact" />);
      expect(screen.getByRole('switch')).toBeInTheDocument();

      rerender(<ThemeToggle size="lg" variant="compact" />);
      expect(screen.getByRole('switch')).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('should accept custom className', () => {
      const { container } = render(
        <ThemeToggle className="custom-class" variant="full" />
      );

      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have switch role', () => {
      render(<ThemeToggle variant="compact" />);

      const toggle = screen.getByRole('switch');
      expect(toggle).toBeInTheDocument();
    });

    it('should be keyboard accessible', () => {
      render(<ThemeToggle variant="compact" />);

      const toggle = screen.getByRole('switch');

      // Should be focusable
      toggle.focus();
      expect(toggle).toHaveFocus();
    });
  });

  describe('system theme detection', () => {
    it('should respect system dark mode preference', () => {
      // Mock matchMedia to return dark mode
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      localStorage.setItem('notari_theme', 'system');

      render(<ThemeToggle variant="compact" />);

      const toggle = screen.getByRole('switch');

      // Should be checked (dark) when system prefers dark
      expect(toggle).toBeChecked();
    });

    it('should respect system light mode preference', () => {
      // Mock matchMedia to return light mode
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      localStorage.setItem('notari_theme', 'system');

      render(<ThemeToggle variant="compact" />);

      const toggle = screen.getByRole('switch');

      // Should not be checked (light) when system prefers light
      expect(toggle).not.toBeChecked();
    });
  });
});

