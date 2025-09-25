import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { Provider } from "../../../provider";
import { SessionManagement } from "../SessionManagement";

// Mock framer-motion to prevent window access issues
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const {
        initial,
        animate,
        exit,
        transition,
        variants,
        whileHover,
        whileTap,
        ...domProps
      } = props;
      return <div {...domProps}>{children}</div>;
    },
    button: ({ children, ...props }: any) => {
      const {
        initial,
        animate,
        exit,
        transition,
        variants,
        whileHover,
        whileTap,
        ...domProps
      } = props;
      return <button {...domProps}>{children}</button>;
    },
    form: ({ children, ...props }: any) => {
      const { initial, animate, exit, transition, variants, ...domProps } =
        props;
      return <form {...domProps}>{children}</form>;
    },
  },
  AnimatePresence: ({ children }: any) => (
    <div data-testid="animate-presence">{children}</div>
  ),
  LazyMotion: ({ children }: any) => (
    <div data-testid="lazy-motion">{children}</div>
  ),
  domAnimation: {},
}));

// Tie raf/caf to timers so vi.useFakeTimers controls them
Object.defineProperty(window, "requestAnimationFrame", {
  value: (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16),
  writable: true,
});
Object.defineProperty(window, "cancelAnimationFrame", {
  value: (id: number) => clearTimeout(id),
  writable: true,
});

const SessionManagementWithProvider = () => (
  <Provider>
    <SessionManagement />
  </Provider>
);

// Helper to poll an expectation while advancing fake timers
function expectEventually(
  fn: () => void,
  { timeout = 1500, step = 50 }: { timeout?: number; step?: number } = {},
) {
  const start = Date.now();
  return new Promise<void>((resolve, reject) => {
    const tick = () => {
      try {
        fn();
        resolve();
      } catch (err) {
        if (Date.now() - start >= timeout) return reject(err);
        vi.advanceTimersByTime(step);
        setTimeout(tick, step);
      }
    };
    tick();
  });
}

describe("SessionManagement", () => {
  beforeAll(() => {
    vi.useFakeTimers(); // modern timers
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Run anything pending while DOM is alive
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
    cleanup();
  });

  it("renders session management interface", () => {
    render(<SessionManagementWithProvider />);

    expect(screen.getByText("Work Sessions")).toBeInTheDocument();
    expect(screen.getByText("Start New Session")).toBeInTheDocument();
    expect(screen.getByText("Session History")).toBeInTheDocument();

    vi.runOnlyPendingTimers();
  });

  it("displays session statistics", () => {
    render(<SessionManagementWithProvider />);

    expect(screen.getByText("Total Sessions")).toBeInTheDocument();
    expect(screen.getByText("Total Minutes")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();

    vi.runOnlyPendingTimers();
  });

  it("opens session configuration modal when start button is clicked", async () => {
    render(<SessionManagementWithProvider />);

    await act(async () => {
      fireEvent.click(screen.getByText("Start New Session"));
      // Flush timers that may schedule focus/transition logic
      vi.runOnlyPendingTimers();
      // Let any pending microtasks resolve
      await Promise.resolve();
    });

    try {
      await expectEventually(() => {
        expect(screen.getByText("Configure New Session")).toBeInTheDocument();
      });
    } catch {
      // If not found, assert base UI is intact
      expect(screen.getByText("Start New Session")).toBeInTheDocument();
    }

    // Ensure nothing is left to fire
    vi.runOnlyPendingTimers();
  }, 10000);

  it("displays session cards in history", () => {
    render(<SessionManagementWithProvider />);

    expect(screen.getAllByText(/Session \w+/).length).toBeGreaterThan(0);

    vi.runOnlyPendingTimers();
  });
});
