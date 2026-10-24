import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RunCard, type RunCardProps } from "./run-card";

const props = (overrides: Partial<RunCardProps> = {}): RunCardProps => ({
  number: 1,
  live: true,
  meta: "step 14 · $0.08",
  stages: [
    {
      id: "prepare",
      name: "Prepare",
      state: "done",
      summary: "Sandbox ready, cloned main",
      durationMs: 16_000,
    },
    {
      id: "working",
      name: "Working",
      state: "running",
      summary: "14 steps",
      durationMs: 60_000,
    },
  ],
  activity: [],
  reasoning: "",
  status: null,
  folded: false,
  ...overrides,
});

const card = () => screen.getByRole("article", { name: "Run 1" });

describe("RunCard", () => {
  it("shows its stages and no toggle while the run goes on", () => {
    render(<RunCard {...props()} />);

    expect(
      within(card()).getByRole("region", { name: "Prepare" }),
    ).toBeInTheDocument();
    expect(
      within(card()).getByRole("region", { name: "Working" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /steps/ })).toBeNull();
  });

  it("once ended, shows how it went and folds its stages behind Show steps", () => {
    const onToggleSteps = vi.fn();
    const ended = props({
      live: false,
      meta: "7m 12s · 26 steps · $0.21",
      status: { label: "Succeeded", tone: "ok" },
      onToggleSteps,
    });
    const { rerender } = render(<RunCard {...ended} folded />);

    expect(card()).toHaveTextContent("Succeeded");
    expect(card()).toHaveTextContent("7m 12s · 26 steps · $0.21");
    expect(screen.queryByRole("region", { name: "Prepare" })).toBeNull();
    const toggle = screen.getByRole("button", { name: "Show steps" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(onToggleSteps).toHaveBeenCalledOnce();

    rerender(<RunCard {...ended} folded={false} />);
    expect(screen.getByRole("region", { name: "Prepare" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide steps" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
