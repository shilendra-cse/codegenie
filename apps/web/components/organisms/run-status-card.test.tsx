import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RunStatusCard, type RunStatusCardProps } from "./run-status-card";

const card = (overrides: Partial<RunStatusCardProps> = {}) =>
  render(
    <RunStatusCard
      number={1}
      label="queued"
      stage={null}
      summary={null}
      error={null}
      pullRequest={null}
      durationMs={null}
      {...overrides}
    />,
  );

describe("RunStatusCard", () => {
  it.each([
    [{ label: "queued" }, "Waiting to start. It begins in a moment."],
    [{ label: "working", stage: "agent" }, "Working on the change…"],
    [{ label: "working", stage: null }, "Starting…"],
    [{ label: "failed", error: "Install failed." }, "Install failed."],
    [{ label: "cancelled" }, "The run was cancelled. Nothing was pushed."],
    [
      { label: "no_changes", summary: "Nothing needed changing." },
      "Nothing needed changing.",
    ],
  ] as const)("says what the run is doing: %o", (overrides, text) => {
    card(overrides);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("links to the pull request once it's open", () => {
    card({
      label: "pr_open",
      summary: "Added the endpoint.",
      pullRequest: { number: 41, url: "https://github.com/ada/dodesk/pull/41" },
      durationMs: 92_000,
    });
    expect(screen.getByText("PR #41 open")).toBeInTheDocument();
    expect(screen.getByText("1m 32s")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open PR #41 on GitHub" }),
    ).toHaveAttribute("href", "https://github.com/ada/dodesk/pull/41");
  });
});
