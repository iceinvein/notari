import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Provider } from "../../../provider";
import { ProofPackWizard } from "../ProofPackWizard";

const ProofPackWizardWithProvider = () => (
  <Provider>
    <ProofPackWizard />
  </Provider>
);

describe("ProofPackWizard", () => {
  it("renders wizard interface", () => {
    render(<ProofPackWizardWithProvider />);

    expect(screen.getByText("Create Proof Pack")).toBeInTheDocument();
    expect(
      screen.getByText("Step 1 of 4: Select Sessions"),
    ).toBeInTheDocument();
  });

  it("shows progress indicator", () => {
    render(<ProofPackWizardWithProvider />);

    expect(screen.getByText("25% Complete")).toBeInTheDocument();
  });

  it("displays step navigation tabs", () => {
    render(<ProofPackWizardWithProvider />);

    expect(screen.getByText("Select Sessions")).toBeInTheDocument();
    expect(screen.getByText("Configure")).toBeInTheDocument();
    expect(screen.getByText("Preview")).toBeInTheDocument();
    expect(screen.getByText("Export")).toBeInTheDocument();
  });

  it("disables next button when no sessions selected", () => {
    render(<ProofPackWizardWithProvider />);

    const nextButton = screen.getByText("Next");
    expect(nextButton).toBeDisabled();
  });

  it("shows start over button", () => {
    render(<ProofPackWizardWithProvider />);

    expect(screen.getByText("Start Over")).toBeInTheDocument();
  });
});
