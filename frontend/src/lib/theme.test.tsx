import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./theme";

function Toggle() {
  const { theme, toggle } = useTheme();
  return <button onClick={toggle}>theme:{theme}</button>;
}

describe("ThemeProvider", () => {
  beforeEach(() => localStorage.clear());

  it("defaults to dark and persists a toggle", () => {
    render(<ThemeProvider><Toggle /></ThemeProvider>);
    expect(screen.getByText("theme:dark")).toBeInTheDocument();
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");

    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("theme:light")).toBeInTheDocument();
    expect(localStorage.getItem("klypup_theme")).toBe("light");
  });
});
