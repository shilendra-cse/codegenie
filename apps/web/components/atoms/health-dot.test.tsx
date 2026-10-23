import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HealthDot } from "./health-dot";

describe("HealthDot", () => {
  it.each([
    ["ok", "Ready"],
    ["attention", "Needs attention"],
    ["none", "Not set up"],
  ] as const)("names the %s state", (health, label) => {
    render(<HealthDot health={health} />);
    expect(screen.getByRole("img", { name: label })).toBeInTheDocument();
  });
});
