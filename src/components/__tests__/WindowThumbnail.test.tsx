import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { WindowInfo } from "../../types/window";
import WindowThumbnail from "../WindowThumbnail";

const mockWindow: WindowInfo = {
	id: "window-123",
	title: "Test Window",
	application: "TestApp",
	is_minimized: false,
	bounds: {
		x: 0,
		y: 0,
		width: 1920,
		height: 1080,
	},
	thumbnail:
		"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
};

describe("WindowThumbnail", () => {
	let queryClient: QueryClient;

	beforeEach(() => {
		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
			},
		});
	});

	const renderWithClient = (ui: React.ReactElement) => {
		return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
	};

	it("should render thumbnail image with small variant", () => {
		renderWithClient(<WindowThumbnail window={mockWindow} variant="small" />);

		const img = screen.getByRole("img");
		expect(img).toBeInTheDocument();
		expect(img).toHaveAttribute("alt", "Test Window thumbnail");
	});

	it("should render thumbnail image with card variant", () => {
		renderWithClient(<WindowThumbnail window={mockWindow} variant="card" />);

		const img = screen.getByRole("img");
		expect(img).toBeInTheDocument();
		expect(img).toHaveAttribute("alt", "Test Window thumbnail");
	});

	it("should use provided thumbnail", () => {
		renderWithClient(<WindowThumbnail window={mockWindow} />);

		const img = screen.getByRole("img");
		expect(img).toHaveAttribute("src", mockWindow.thumbnail);
	});

	it("should handle missing thumbnail gracefully", async () => {
		const noThumbnailWindow: WindowInfo = {
			...mockWindow,
			thumbnail: undefined,
		};

		const { container } = renderWithClient(<WindowThumbnail window={noThumbnailWindow} />);

		// Wait for query to finish loading
		await screen.findByRole("img", {}, { timeout: 100 }).catch(() => {
			// If no image found, check for fallback icon
			const icon = container.querySelector("svg");
			expect(icon).toBeInTheDocument();
		});
	});

	it("should apply custom className", () => {
		const { container } = renderWithClient(
			<WindowThumbnail window={mockWindow} className="custom-class" />
		);

		expect(container.querySelector(".custom-class")).toBeInTheDocument();
	});

	describe("variants", () => {
		it("should render small variant with correct styling", () => {
			const { container } = renderWithClient(
				<WindowThumbnail window={mockWindow} variant="small" />
			);

			const wrapper = container.querySelector(".w-20");
			expect(wrapper).toBeInTheDocument();
		});

		it("should render card variant with correct styling", () => {
			const { container } = renderWithClient(
				<WindowThumbnail window={mockWindow} variant="card" />
			);

			const wrapper = container.querySelector(".w-full");
			expect(wrapper).toBeInTheDocument();
		});
	});

	describe("accessibility", () => {
		it("should have descriptive alt text for image", () => {
			renderWithClient(<WindowThumbnail window={mockWindow} />);

			const img = screen.getByRole("img");
			expect(img).toHaveAttribute("alt", "Test Window thumbnail");
		});
	});

	describe("edge cases", () => {
		it("should handle special characters in title", () => {
			const specialCharsWindow: WindowInfo = {
				...mockWindow,
				title: "Test <Window> & \"Special\" 'Chars'",
			};

			renderWithClient(<WindowThumbnail window={specialCharsWindow} />);

			const img = screen.getByRole("img");
			expect(img).toHaveAttribute("alt", "Test <Window> & \"Special\" 'Chars' thumbnail");
		});

		it("should handle image load errors", () => {
			renderWithClient(<WindowThumbnail window={mockWindow} />);

			const img = screen.getByRole("img");

			// Simulate image error
			img.dispatchEvent(new Event("error"));

			// Image should be hidden
			expect(img).toHaveStyle({ display: "none" });
		});
	});
});
