import { HeroUIProvider } from "@heroui/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders without crashing", () => {
    render(
      <HeroUIProvider>
        <App />
      </HeroUIProvider>,
    );
    expect(screen.getByRole("heading", { name: "Notari" })).toBeInTheDocument();
    expect(
      screen.getByText("Proof-of-Work System"),
    ).toBeInTheDocument();
  });
});
