import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "./badge";

describe("Badge", () => {
  it.each([
    ["neutral", "text-muted-foreground"],
    ["progress", "text-primary-text"],
    ["ok", "text-ok"],
    ["warn", "text-warn"],
    ["err", "text-err"],
    ["merged", "text-merged"],
  ] as const)("uses the %s colours", (tone, colour) => {
    render(<Badge tone={tone}>PR #41 open</Badge>);
    expect(screen.getByText("PR #41 open")).toHaveClass(colour);
  });
});
