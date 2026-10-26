import type { UsageResponse } from "@hobai/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UsageLine, usageTone } from "./usage-line";

const usage = (used: number, limit: number | null = 10): UsageResponse => ({
  plan:
    limit === null
      ? { slug: "unlimited", name: "Unlimited" }
      : { slug: "free", name: "Free" },
  runs: { used, limit },
  concurrentRuns: 1,
  periodStart: "2026-10-25T09:30:00.000Z",
  resetsAt: "2026-11-25T09:30:00.000Z",
});

describe("usageTone", () => {
  it("is ok, then amber from 80% used, then red at the limit", () => {
    expect(usageTone(usage(4))).toBe("ok");
    expect(usageTone(usage(8))).toBe("warn");
    expect(usageTone(usage(10))).toBe("err");
    expect(usageTone(usage(12, null))).toBeNull();
  });
});

describe("UsageLine", () => {
  it("shows the runs used and when they reset, and opens usage and limits", () => {
    const onOpen = vi.fn();
    render(<UsageLine usage={usage(4)} onOpen={onOpen} />);

    const line = screen.getByRole("button", {
      name: "4 of 10 runs used, resets 25 Nov. Usage and limits",
    });
    expect(line).toHaveTextContent("4 of 10 runs");
    expect(line).toHaveTextContent("resets 25 Nov");

    fireEvent.click(line);
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it("turns red at the limit", () => {
    render(<UsageLine usage={usage(10)} onOpen={vi.fn()} />);

    expect(screen.getByText("10 of 10 runs")).toHaveClass("text-err");
  });

  it("says Unlimited on a plan without a limit", () => {
    render(<UsageLine usage={usage(12, null)} onOpen={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: "Unlimited runs. Usage and limits" }),
    ).toHaveTextContent(/^Unlimited$/);
  });
});
