import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SetupTimeline, type SetupLineView } from "./setup-timeline";

const lines: SetupLineView[] = [
  {
    key: "1",
    state: "done",
    durationMs: 1_000,
    kind: "projects",
    projects: [
      { cwd: "frontend", packageManager: "pnpm" },
      { cwd: "backend", packageManager: "pnpm" },
    ],
  },
  {
    key: "2",
    state: "warn",
    durationMs: 217_000,
    kind: "tried",
    phase: "first",
    installCommand: "pnpm install --frozen-lockfile",
    installed: true,
    checks: [
      { name: "lint", cwd: "frontend", status: "passing" },
      { name: "test", cwd: "backend", status: "failing" },
    ],
  },
  {
    key: "3",
    state: "running",
    durationMs: 48_000,
    kind: "agent",
    actions: [
      { id: "t1", tool: "read_file", target: "backend/test/setup.ts" },
      { id: "t2", tool: "bash", target: "pnpm --filter backend test" },
    ],
  },
];

describe("SetupTimeline", () => {
  it("shows what setup found, its checks, and how long each took", () => {
    render(<SetupTimeline lines={lines} live={false} />);

    expect(screen.getByText("Found 2 projects")).toBeInTheDocument();
    expect(screen.getByText("frontend · pnpm")).toBeInTheDocument();
    expect(
      screen.getByText("pnpm install --frozen-lockfile"),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 of 2 checks passing/)).toBeInTheDocument();
    expect(screen.getByText("backend test")).toBeInTheDocument();
    expect(screen.getByText("3m 37s")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Needs a look" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "In progress" }),
    ).toBeInTheDocument();
  });

  it("opens the agent's steps on request", () => {
    render(<SetupTimeline lines={lines} live={false} />);
    const toggle = screen.getByRole("button", {
      name: /Looked into it · 2 steps/,
    });

    expect(screen.queryByText("backend/test/setup.ts")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("backend/test/setup.ts")).toBeInTheDocument();
    expect(screen.getByText("pnpm --filter backend test")).toBeInTheDocument();
  });

  it("has the beam only while setup works on it", () => {
    const { container, rerender } = render(
      <SetupTimeline lines={lines} live />,
    );
    expect(container.firstChild).toHaveClass("beam");

    rerender(<SetupTimeline lines={lines} live={false} />);
    expect(container.firstChild).not.toHaveClass("beam");
  });
});
