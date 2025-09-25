// React import not needed for this test
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TrayErrorBoundary } from "../TrayErrorBoundary";

// Mock Tauri API
const mockEmit = vi.fn();
vi.mock("@tauri-apps/api/event", () => ({
  emit: mockEmit,
}));

// Mock window.__TAURI__
Object.defineProperty(window, "__TAURI__", {
  value: {
    event: {
      emit: mockEmit,
    },
  },
  writable: true,
});

// Component that throws an error for testing
function ThrowError({ shouldThrow = false }: { shouldThrow?: boolean }) {
  if (shouldThrow) {
    throw new Error("Test error");
  }
  return <div>No error</div>;
}

// Custom fallback component for testing
function CustomFallback({ error, retry, fallbackToWindow }: any) {
  return (
    <div>
      <div>Custom fallback</div>
      <div>Error: {error?.message}</div>
      <button onClick={retry}>Custom Retry</button>
      <button onClick={fallbackToWindow}>Custom Fallback</button>
    </div>
  );
}

describe("TrayErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console.error to avoid noise in tests
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders children when there is no error", () => {
    render(
      <TrayErrorBoundary>
        <ThrowError shouldThrow={false} />
      </TrayErrorBoundary>,
    );

    expect(screen.getByText("No error")).toBeInTheDocument();
  });

  it("renders default error fallback when error occurs", () => {
    render(
      <TrayErrorBoundary>
        <ThrowError shouldThrow={true} />
      </TrayErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(
      screen.getByText("The tray interface encountered an unexpected error."),
    ).toBeInTheDocument();
  });

  it("renders custom fallback component when provided", () => {
    render(
      <TrayErrorBoundary fallbackComponent={CustomFallback}>
        <ThrowError shouldThrow={true} />
      </TrayErrorBoundary>,
    );

    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
    expect(screen.getByText("Error: Test error")).toBeInTheDocument();
  });

  it("calls onError callback when error occurs", () => {
    const onError = vi.fn();

    render(
      <TrayErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </TrayErrorBoundary>,
    );

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String),
      }),
    );
  });

  it("allows retry when under max retry limit", () => {
    render(
      <TrayErrorBoundary maxRetries={3}>
        <ThrowError shouldThrow={true} />
      </TrayErrorBoundary>,
    );

    const retryButton = screen.getByText(/Try Again \(3 attempts left\)/);
    expect(retryButton).toBeInTheDocument();
    expect(retryButton).not.toBeDisabled();
  });

  it("disables retry when max retries reached", () => {
    render(
      <TrayErrorBoundary maxRetries={0}>
        <ThrowError shouldThrow={true} />
      </TrayErrorBoundary>,
    );

    expect(screen.queryByText(/Try Again/)).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "Maximum retry attempts reached. Please try reloading or use the main window.",
      ),
    ).toBeInTheDocument();
  });

  it("handles retry functionality", async () => {
    let shouldThrow = true;

    function DynamicThrowError() {
      if (shouldThrow) {
        throw new Error("Test error");
      }
      return <div>Recovered</div>;
    }

    render(
      <TrayErrorBoundary maxRetries={3}>
        <DynamicThrowError />
      </TrayErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Simulate fixing the error
    shouldThrow = false;

    const retryButton = screen.getByText(/Try Again/);
    fireEvent.click(retryButton);

    // Wait for retry timeout
    await waitFor(
      () => {
        expect(screen.getByText("Recovered")).toBeInTheDocument();
      },
      { timeout: 2000 },
    );
  });

  it("handles fallback to window", () => {
    render(
      <TrayErrorBoundary>
        <ThrowError shouldThrow={true} />
      </TrayErrorBoundary>,
    );

    const fallbackButton = screen.getByText("Open Main Window");
    fireEvent.click(fallbackButton);

    expect(mockEmit).toHaveBeenCalledWith("fallback-to-window", {
      reason: "tray-error",
      error: "Test error",
    });
  });

  it("handles reload functionality", () => {
    // Mock window.location.reload
    const mockReload = vi.fn();
    Object.defineProperty(window, "location", {
      value: { reload: mockReload },
      writable: true,
    });

    render(
      <TrayErrorBoundary>
        <ThrowError shouldThrow={true} />
      </TrayErrorBoundary>,
    );

    const reloadButton = screen.getByText("Reload Application");
    fireEvent.click(reloadButton);

    expect(mockReload).toHaveBeenCalled();
  });

  it("shows error details when expanded", () => {
    render(
      <TrayErrorBoundary>
        <ThrowError shouldThrow={true} />
      </TrayErrorBoundary>,
    );

    const detailsToggle = screen.getByText("Error details");
    fireEvent.click(detailsToggle);

    expect(screen.getByText("Test error")).toBeInTheDocument();
  });

  it("reports error to Tauri backend", () => {
    render(
      <TrayErrorBoundary>
        <ThrowError shouldThrow={true} />
      </TrayErrorBoundary>,
    );

    expect(mockEmit).toHaveBeenCalledWith(
      "tray-error",
      expect.objectContaining({
        message: "Test error",
        stack: expect.any(String),
        componentStack: expect.any(String),
        timestamp: expect.any(String),
      }),
    );
  });

  it("resets error state when resetOnPropsChange is true and children change", () => {
    let childKey = 1;

    const { rerender } = render(
      <TrayErrorBoundary resetOnPropsChange={true}>
        <ThrowError key={childKey} shouldThrow={true} />
      </TrayErrorBoundary>,
    );

    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Change children
    childKey = 2;
    rerender(
      <TrayErrorBoundary resetOnPropsChange={true}>
        <ThrowError key={childKey} shouldThrow={false} />
      </TrayErrorBoundary>,
    );

    expect(screen.getByText("No error")).toBeInTheDocument();
  });

  it("handles missing Tauri API gracefully", () => {
    // Temporarily remove Tauri API
    const originalTauri = (window as any).__TAURI__;
    (window as any).__TAURI__ = undefined;

    render(
      <TrayErrorBoundary>
        <ThrowError shouldThrow={true} />
      </TrayErrorBoundary>,
    );

    // Should still render error boundary without crashing
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();

    // Restore Tauri API
    (window as any).__TAURI__ = originalTauri;
  });
});
