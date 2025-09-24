import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Provider } from "../../../provider";
import { VerificationResults } from "../VerificationResults";

const VerificationResultsWithProvider = () => (
  <Provider>
    <VerificationResults />
  </Provider>
);

describe("VerificationResults", () => {
  it("renders verification interface", () => {
    render(<VerificationResultsWithProvider />);

    expect(screen.getByText("Verification Center")).toBeInTheDocument();
    expect(screen.getByText("Verify Proof Pack")).toBeInTheDocument();
  });

  it("shows verification input field", () => {
    render(<VerificationResultsWithProvider />);

    expect(
      screen.getByPlaceholderText("Enter proof pack URL or upload file..."),
    ).toBeInTheDocument();
    expect(screen.getByText("Verify")).toBeInTheDocument();
  });

  it("disables verify button when no URL is entered", () => {
    render(<VerificationResultsWithProvider />);

    const verifyButton = screen.getByText("Verify");
    expect(verifyButton).toBeDisabled();
  });

  it("enables verify button when URL is entered", () => {
    render(<VerificationResultsWithProvider />);

    const input = screen.getByPlaceholderText(
      "Enter proof pack URL or upload file...",
    );
    fireEvent.change(input, {
      target: { value: "https://example.com/proof-pack" },
    });

    const verifyButton = screen.getByText("Verify");
    expect(verifyButton).not.toBeDisabled();
  });

  it("shows verification progress when verifying", async () => {
    render(<VerificationResultsWithProvider />);

    const input = screen.getByPlaceholderText(
      "Enter proof pack URL or upload file...",
    );
    fireEvent.change(input, {
      target: { value: "https://example.com/proof-pack" },
    });

    const verifyButton = screen.getByText("Verify");
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(screen.getByText("Verifying Proof Pack")).toBeInTheDocument();
    });
  });

  it("displays recent verifications", () => {
    render(<VerificationResultsWithProvider />);

    expect(screen.getByText("Recent Verifications")).toBeInTheDocument();
  });
});
