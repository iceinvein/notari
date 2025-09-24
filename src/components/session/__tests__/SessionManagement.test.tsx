import { render, screen, fireEvent, waitFor, cleanup, act } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { SessionManagement } from "../SessionManagement";
import { Provider } from "../../../provider";

const SessionManagementWithProvider = () => (
  <Provider>
    <SessionManagement />
  </Provider>
);

describe("SessionManagement", () => {
  afterEach(() => {
    cleanup();
  });
  it("renders session management interface", () => {
    render(<SessionManagementWithProvider />);
    
    expect(screen.getByText("Work Sessions")).toBeInTheDocument();
    expect(screen.getByText("Start New Session")).toBeInTheDocument();
    expect(screen.getByText("Session History")).toBeInTheDocument();
  });

  it("displays session statistics", () => {
    render(<SessionManagementWithProvider />);
    
    expect(screen.getByText("Total Sessions")).toBeInTheDocument();
    expect(screen.getByText("Total Minutes")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("opens session configuration modal when start button is clicked", async () => {
    render(<SessionManagementWithProvider />);
    
    await act(async () => {
      fireEvent.click(screen.getByText("Start New Session"));
    });
    
    await waitFor(() => {
      expect(screen.getByText("Configure New Session")).toBeInTheDocument();
    });
  });

  it("displays session cards in history", () => {
    render(<SessionManagementWithProvider />);
    
    // Should show mock session cards
    expect(screen.getAllByText(/Session \w+/).length).toBeGreaterThan(0);
  });
});