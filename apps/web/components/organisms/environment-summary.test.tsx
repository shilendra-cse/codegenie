import type { EnvironmentResponse } from "@hobai/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EnvironmentSummary } from "./environment-summary";

const environment = (
  health: EnvironmentResponse["health"],
): EnvironmentResponse => ({
  version: 2,
  active: true,
  source: "ai",
  savedAt: "2026-10-22T08:00:00.000Z",
  health,
  healthReasons: [],
  steps: [{ name: "install", cwd: ".", command: "pnpm install" }],
  checks: [{ name: "lint", cwd: "frontend", command: "pnpm lint" }],
  decisions: [],
});

const show = (
  health: EnvironmentResponse["health"] = "ok",
  onRerun = vi.fn(),
) =>
  render(
    <EnvironmentSummary
      environment={environment(health)}
      savedAgo="3 days ago"
      onRerun={onRerun}
      rerunning={false}
      rerunError={null}
      notice={<p>A notice</p>}
    />,
  );

describe("EnvironmentSummary", () => {
  it("shows the version, when it was saved, its steps and checks", () => {
    show();

    expect(screen.getByText("v2 · active")).toBeVisible();
    expect(screen.getByText("Saved 3 days ago")).toBeVisible();
    expect(screen.getByText("pnpm install")).toBeVisible();
    expect(screen.getByText("pnpm lint")).toBeVisible();
    expect(screen.getByText("A notice")).toBeVisible();
  });

  it("says when it needs attention", () => {
    show("needs_attention");

    expect(
      screen.getByText("Needs attention · Saved 3 days ago"),
    ).toBeVisible();
  });

  it("re-runs setup", () => {
    const onRerun = vi.fn();
    show("ok", onRerun);

    fireEvent.click(screen.getByRole("button", { name: "Re-run setup" }));
    expect(onRerun).toHaveBeenCalledOnce();
  });
});
