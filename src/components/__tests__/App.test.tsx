import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import App from "../../App";
import { Provider } from "../../provider";

const AppWithProvider = () => (
  <Provider>
    <App />
  </Provider>
);

describe("App", () => {
  it("renders main navigation", () => {
    render(<AppWithProvider />);
    
    expect(screen.getByText("Notari")).toBeInTheDocument();
    expect(screen.getByText("Sessions")).toBeInTheDocument();
    expect(screen.getByText("Proof Packs")).toBeInTheDocument();
    expect(screen.getByText("Redaction")).toBeInTheDocument();
    expect(screen.getByText("Verification")).toBeInTheDocument();
  });

  it("switches between views when navigation is clicked", () => {
    render(<AppWithProvider />);
    
    // Should start with sessions view
    expect(screen.getByText("Work Sessions")).toBeInTheDocument();
    
    // Click on Proof Packs tab
    const proofPacksTab = screen.getByRole("tab", { name: /proof packs/i });
    fireEvent.click(proofPacksTab);
    expect(screen.getByText("Create Proof Pack")).toBeInTheDocument();
    
    // Click on Verification tab
    const verificationTab = screen.getByRole("tab", { name: /verification/i });
    fireEvent.click(verificationTab);
    expect(screen.getByText("Verification Center")).toBeInTheDocument();
  });

  it("displays settings button", () => {
    render(<AppWithProvider />);
    
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});