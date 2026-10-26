import type { UsageResponse } from "@hobai/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UsageDialog } from "./usage-dialog";

const free: UsageResponse = {
  plan: { slug: "free", name: "Free" },
  runs: { used: 4, limit: 10 },
  concurrentRuns: 1,
  periodStart: "2026-10-25T09:30:00.000Z",
  resetsAt: "2026-11-25T09:30:00.000Z",
};

const show = (usage: UsageResponse | undefined, failed = false) =>
  render(
    <UsageDialog open onOpenChange={vi.fn()} usage={usage} failed={failed} />,
  );

describe("UsageDialog", () => {
  it("shows the plan, the cycle, the runs used and the limits", () => {
    show(free);

    const dialog = screen.getByRole("dialog", { name: "Usage & limits" });
    expect(dialog).toHaveTextContent("Free");
    expect(dialog).toHaveTextContent("Cycle 25 Oct – 25 Nov");
    expect(dialog).toHaveTextContent("4 of 10 runs used");
    expect(dialog).toHaveTextContent("Runs per cycle10");
    expect(dialog).toHaveTextContent("Tasks at once1");
    expect(dialog).toHaveTextContent("Setting up a repositoryDoesn't count");
    expect(screen.getByRole("link", { name: "See plans" })).toHaveAttribute(
      "href",
      "/pricing",
    );
  });

  it("has no run limit on the unlimited plan", () => {
    show({
      ...free,
      plan: { slug: "unlimited", name: "Unlimited" },
      runs: { used: 12, limit: null },
      concurrentRuns: 3,
    });

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("12 runs this cycle · no run limit");
    expect(dialog).toHaveTextContent("Runs per cycleNo limit");
    expect(dialog).toHaveTextContent("Tasks at once3");
  });

  it("says when the usage couldn't load", () => {
    show(undefined, true);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load your usage.",
    );
  });
});
