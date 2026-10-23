import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ToolRow } from "./tool-row";

describe("ToolRow", () => {
  it("lists the tools CodeGenie sets up", () => {
    render(<ToolRow />);
    const list = screen.getByRole("list");

    expect(
      screen.getByRole("region", { name: /tools your repository/ }),
    ).toContainElement(list);
    expect(
      screen.getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual([
      "npm",
      "pnpm",
      "yarn",
      "TypeScript",
      "ESLint",
      "Vitest",
      "Jest",
    ]);
  });
});
