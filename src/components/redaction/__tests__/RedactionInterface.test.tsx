import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RedactionInterface } from "../RedactionInterface";
import { Provider } from "../../../provider";

const RedactionInterfaceWithProvider = () => (
  <Provider>
    <RedactionInterface />
  </Provider>
);

describe("RedactionInterface", () => {
  it("renders redaction interface", () => {
    render(<RedactionInterfaceWithProvider />);
    
    expect(screen.getByText("Redaction Interface")).toBeInTheDocument();
    expect(screen.getByText("Select Proof Pack")).toBeInTheDocument();
  });

  it("shows proof pack selection dropdown", () => {
    render(<RedactionInterfaceWithProvider />);
    
    expect(screen.getByRole("button", { name: /choose a proof pack to redact/i })).toBeInTheDocument();
  });

  it("displays redaction tools when proof pack is selected", async () => {
    render(<RedactionInterfaceWithProvider />);
    
    // Select a proof pack
    const selectButton = screen.getByRole("button", { name: /choose a proof pack to redact/i });
    fireEvent.click(selectButton);
    
    await waitFor(() => {
      const option = screen.getByRole("option", { name: /research paper draft/i });
      fireEvent.click(option);
    });

    await waitFor(() => {
      expect(screen.getByText("Content Preview")).toBeInTheDocument();
      expect(screen.getByText("Redaction Areas")).toBeInTheDocument();
    });
  });

  it("shows redaction impact assessment", async () => {
    render(<RedactionInterfaceWithProvider />);
    
    // Select a proof pack first
    const selectButton = screen.getByRole("button", { name: /choose a proof pack to redact/i });
    fireEvent.click(selectButton);
    
    await waitFor(() => {
      const option = screen.getByRole("option", { name: /research paper draft/i });
      fireEvent.click(option);
    });

    await waitFor(() => {
      expect(screen.getByText("Redaction Impact")).toBeInTheDocument();
    });
  });
});