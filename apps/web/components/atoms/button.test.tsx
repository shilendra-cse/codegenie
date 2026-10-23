import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it.each([
    ["primary", "bg-primary"],
    ["secondary", "bg-card"],
    ["ghost", "bg-transparent"],
    ["danger", "text-err"],
  ] as const)("renders the %s variant", (variant, styling) => {
    render(<Button variant={variant}>Start</Button>);
    expect(screen.getByRole("button", { name: "Start" })).toHaveClass(styling);
  });

  it("shows a spinner and can't be pressed while busy", () => {
    render(<Button busy>Start</Button>);
    const button = screen.getByRole("button", { name: "Start" });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(button.querySelector("svg.animate-spin")).not.toBeNull();
  });

  it("renders its child instead of a button when asked", () => {
    render(
      <Button asChild variant="primary">
        <a href="/signin">Sign in</a>
      </Button>,
    );

    const link = screen.getByRole("link", { name: "Sign in" });
    expect(link).toHaveAttribute("href", "/signin");
    expect(link).toHaveClass("bg-primary");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("glows when it is the page's main action", () => {
    render(<Button glow>Start</Button>);
    expect(screen.getByRole("button", { name: "Start" })).toHaveClass(
      "shadow-[0_8px_24px_-8px_var(--glow)]",
    );
  });
});
