import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AppHeader from '../AppHeader';

describe('AppHeader', () => {
  it('should render title', () => {
    render(<AppHeader title="Test Title" />);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('should render subtitle when provided', () => {
    render(<AppHeader title="Test Title" subtitle="Test Subtitle" />);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
  });

  it('should not render subtitle when not provided', () => {
    render(<AppHeader title="Test Title" />);

    expect(screen.queryByText('Test Subtitle')).not.toBeInTheDocument();
  });

  describe('back button', () => {
    it('should show back button when showBackButton is true', () => {
      const onBack = vi.fn();
      render(<AppHeader title="Test" showBackButton={true} onBack={onBack} />);

      // Back button should be present (icon-only button)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should not show back button by default', () => {
      render(<AppHeader title="Test" />);

      // Should show logo instead
      const logo = screen.queryByAltText('Notari Logo');
      expect(logo).toBeInTheDocument();
    });

    it('should call onBack when back button is clicked', () => {
      const onBack = vi.fn();
      render(<AppHeader title="Test" showBackButton={true} onBack={onBack} />);

      // Click the first button (back button)
      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('should show logo when back button is not shown', () => {
      render(<AppHeader title="Test" showBackButton={false} />);

      const logo = screen.getByAltText('Notari Logo');
      expect(logo).toBeInTheDocument();
    });
  });

  describe('settings button', () => {
    it('should show settings button by default', () => {
      const onSettings = vi.fn();
      render(<AppHeader title="Test" onSettings={onSettings} />);

      // Settings button should be present
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(1);
    });

    it('should not show settings button when showSettingsButton is false', () => {
      render(<AppHeader title="Test" showSettingsButton={false} />);

      const buttons = screen.queryAllByRole('button');
      expect(buttons.length).toBe(0);
    });

    it('should call onSettings when settings button is clicked', () => {
      const onSettings = vi.fn();
      render(<AppHeader title="Test" onSettings={onSettings} />);

      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);

      expect(onSettings).toHaveBeenCalledTimes(1);
    });

    it('should not show settings button when onSettings is not provided', () => {
      render(<AppHeader title="Test" />);

      const buttons = screen.queryAllByRole('button');
      expect(buttons.length).toBe(0);
    });
  });

  describe('status chip', () => {
    it('should render status chip when provided', () => {
      render(
        <AppHeader
          title="Test"
          statusChip={{
            text: 'Recording',
            color: 'danger',
          }}
        />
      );

      expect(screen.getByText('Recording')).toBeInTheDocument();
    });

    it('should not render status chip when not provided', () => {
      render(<AppHeader title="Test" />);

      expect(screen.queryByText('Recording')).not.toBeInTheDocument();
    });

    it('should render status chip with different colors', () => {
      const { rerender } = render(
        <AppHeader
          title="Test"
          statusChip={{
            text: 'Success',
            color: 'success',
          }}
        />
      );

      expect(screen.getByText('Success')).toBeInTheDocument();

      rerender(
        <AppHeader
          title="Test"
          statusChip={{
            text: 'Warning',
            color: 'warning',
          }}
        />
      );

      expect(screen.getByText('Warning')).toBeInTheDocument();
    });

    it('should render status chip with custom variant', () => {
      render(
        <AppHeader
          title="Test"
          statusChip={{
            text: 'Active',
            color: 'primary',
            variant: 'solid',
          }}
        />
      );

      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('right content', () => {
    it('should render custom right content', () => {
      render(
        <AppHeader
          title="Test"
          rightContent={<div data-testid="custom-content">Custom Content</div>}
        />
      );

      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
      expect(screen.getByText('Custom Content')).toBeInTheDocument();
    });

    it('should render both status chip and right content', () => {
      render(
        <AppHeader
          title="Test"
          statusChip={{
            text: 'Recording',
            color: 'danger',
          }}
          rightContent={<div data-testid="custom-content">Custom</div>}
        />
      );

      expect(screen.getByText('Recording')).toBeInTheDocument();
      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });
  });

  describe('combined features', () => {
    it('should render all features together', () => {
      const onBack = vi.fn();
      const onSettings = vi.fn();

      render(
        <AppHeader
          title="Test Title"
          subtitle="Test Subtitle"
          showBackButton={true}
          onBack={onBack}
          showSettingsButton={true}
          onSettings={onSettings}
          statusChip={{
            text: 'Active',
            color: 'success',
          }}
          rightContent={<div data-testid="custom">Custom</div>}
        />
      );

      expect(screen.getByText('Test Title')).toBeInTheDocument();
      expect(screen.getByText('Test Subtitle')).toBeInTheDocument();
      // Should have 2 buttons (back + settings)
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBe(2);
      expect(screen.getByText('Active')).toBeInTheDocument();
      expect(screen.getByTestId('custom')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper heading structure', () => {
      render(<AppHeader title="Test Title" />);

      const heading = screen.getByRole('heading', { name: 'Test Title' });
      expect(heading).toBeInTheDocument();
    });

    it('should have accessible buttons', () => {
      const onBack = vi.fn();
      const onSettings = vi.fn();

      render(
        <AppHeader
          title="Test"
          showBackButton={true}
          onBack={onBack}
          onSettings={onSettings}
        />
      );

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });
  });
});

