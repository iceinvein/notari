import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Popover from "../Popover";

// Mock the mode components
vi.mock("../modes/LoginMode", () => ({
	default: ({ onLogin, onSignUp, onRecordOnly }: any) => (
		<div data-testid="login-mode">
			<button onClick={onLogin}>Login</button>
			<button onClick={onSignUp}>Sign Up</button>
			<button onClick={onRecordOnly}>Record Only</button>
		</div>
	),
}));

vi.mock("../modes/OnboardingMode", () => ({
	default: ({ onComplete, onBack }: any) => (
		<div data-testid="onboarding-mode">
			<button onClick={onComplete}>Complete</button>
			<button onClick={onBack}>Back</button>
		</div>
	),
}));

vi.mock("../modes/LoggedInMode", () => ({
	default: ({ onLogout, onStartSession }: any) => (
		<div data-testid="logged-in-mode">
			<button onClick={onLogout}>Logout</button>
			<button onClick={onStartSession}>Start Session</button>
		</div>
	),
}));

vi.mock("../modes/RecordMode", () => ({
	default: ({ onStartRecording }: any) => (
		<div data-testid="record-mode">
			<button onClick={onStartRecording}>Start Recording</button>
		</div>
	),
}));

describe("Popover", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("should render login mode by default", () => {
		render(<Popover />);

		expect(screen.getByTestId("login-mode")).toBeInTheDocument();
	});

	it("should load saved mode from localStorage", () => {
		localStorage.setItem("notari-current-mode", "record");

		render(<Popover />);

		expect(screen.getByTestId("record-mode")).toBeInTheDocument();
	});

	it("should save mode to localStorage when changed", () => {
		render(<Popover />);

		// Click login to go to logged-in mode
		const loginButton = screen.getByText("Login");
		fireEvent.click(loginButton);

		expect(localStorage.getItem("notari-current-mode")).toBe("logged-in");
	});

	describe("mode transitions", () => {
		it("should transition from login to logged-in mode", () => {
			render(<Popover />);

			expect(screen.getByTestId("login-mode")).toBeInTheDocument();

			const loginButton = screen.getByText("Login");
			fireEvent.click(loginButton);

			expect(screen.getByTestId("logged-in-mode")).toBeInTheDocument();
		});

		it("should transition from login to onboarding mode", () => {
			render(<Popover />);

			const signUpButton = screen.getByText("Sign Up");
			fireEvent.click(signUpButton);

			expect(screen.getByTestId("onboarding-mode")).toBeInTheDocument();
		});

		it("should transition from login to record mode", () => {
			render(<Popover />);

			const recordOnlyButton = screen.getByText("Record Only");
			fireEvent.click(recordOnlyButton);

			expect(screen.getByTestId("record-mode")).toBeInTheDocument();
		});

		it("should transition from onboarding to logged-in mode", () => {
			localStorage.setItem("notari-current-mode", "onboarding");

			render(<Popover />);

			const completeButton = screen.getByText("Complete");
			fireEvent.click(completeButton);

			expect(screen.getByTestId("logged-in-mode")).toBeInTheDocument();
		});

		it("should transition from onboarding back to login mode", () => {
			localStorage.setItem("notari-current-mode", "onboarding");

			render(<Popover />);

			const backButton = screen.getByText("Back");
			fireEvent.click(backButton);

			expect(screen.getByTestId("login-mode")).toBeInTheDocument();
		});

		it("should transition from logged-in to login mode on logout", () => {
			localStorage.setItem("notari-current-mode", "logged-in");

			render(<Popover />);

			const logoutButton = screen.getByText("Logout");
			fireEvent.click(logoutButton);

			expect(screen.getByTestId("login-mode")).toBeInTheDocument();
		});
	});

	describe("container", () => {
		it("should have proper styling classes", () => {
			const { container } = render(<Popover />);

			const popoverDiv = container.firstChild as HTMLElement;
			expect(popoverDiv).toHaveClass("w-full");
			expect(popoverDiv).toHaveClass("h-full");
			expect(popoverDiv).toHaveClass("bg-background/95");
		});

		it("should be focusable", () => {
			const { container } = render(<Popover />);

			const popoverDiv = container.firstChild as HTMLElement;
			expect(popoverDiv).toHaveAttribute("tabIndex", "-1");
		});
	});

	describe("persistence", () => {
		it("should persist mode across re-renders", () => {
			const { rerender } = render(<Popover />);

			// Change mode
			const loginButton = screen.getByText("Login");
			fireEvent.click(loginButton);

			// Rerender
			rerender(<Popover />);

			// Should still be in logged-in mode
			expect(screen.getByTestId("logged-in-mode")).toBeInTheDocument();
		});

		it("should handle invalid saved mode gracefully", () => {
			localStorage.setItem("notari-current-mode", "invalid-mode" as any);

			render(<Popover />);

			// Should default to login mode
			expect(screen.getByTestId("login-mode")).toBeInTheDocument();
		});
	});
});
