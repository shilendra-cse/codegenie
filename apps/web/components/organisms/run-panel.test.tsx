import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type PanelChanges, RunPanel, type RunPanelProps } from "./run-panel";

function renderPanel(overrides: Partial<RunPanelProps> = {}) {
  const props: RunPanelProps = {
    tab: "changes",
    onTabChange: vi.fn(),
    changes: { status: "live", files: [] },
    selectedFile: null,
    onSelectFile: vi.fn(),
    commands: [],
    selectedCommand: null,
    checks: [],
    checksAfter: "pending",
    ...overrides,
  };
  render(<RunPanel {...props} />);
  return props;
}

describe("RunPanel", () => {
  it("switches tabs", () => {
    const { onTabChange } = renderPanel();
    expect(screen.getByRole("tab", { name: "Changes" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    fireEvent.click(screen.getByRole("tab", { name: "Terminal" }));
    expect(onTabChange).toHaveBeenCalledWith("terminal");
  });

  it("lists the files changed so far while the run goes on", () => {
    const { onSelectFile } = renderPanel({
      changes: {
        status: "live",
        files: [{ path: "src/health.ts", added: 11, removed: 0 }],
      },
    });
    expect(screen.getByRole("tab", { name: /^Changes/ })).toHaveTextContent(
      "Changes1",
    );
    const file = screen.getByRole("button", { name: /src\/health\.ts/ });
    expect(file).toHaveTextContent("+11");
    expect(
      screen.getByText(/The full diff appears when the run finishes/),
    ).toBeInTheDocument();
    fireEvent.click(file);
    expect(onSelectFile).toHaveBeenCalledWith("src/health.ts");
  });

  it("shows the diff once the run has ended", () => {
    renderPanel({
      changes: {
        status: "ended",
        files: [
          { path: "src/a.ts", added: 1, removed: 0 },
          { path: "src/b.ts", added: 0, removed: 2 },
        ],
        lines: [{ kind: "add", text: "export const a = 1;", number: 1 }],
        truncated: false,
      },
      selectedFile: null,
    });
    expect(
      screen.getByRole("figure", { name: "Changes to src/a.ts" }),
    ).toHaveTextContent("export const a = 1;");
    expect(screen.getByRole("button", { name: /src\/a\.ts/ })).toHaveAttribute(
      "aria-current",
      "true",
    );
  });

  it.each<[PanelChanges, string]>([
    [{ status: "live", files: [] }, "No changes yet."],
    [
      { status: "ended", files: [], lines: null, truncated: false },
      "No files were changed.",
    ],
  ])("says when nothing changed: %o", (changes, text) => {
    renderPanel({ changes });
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("offers to try again when the diff doesn't load", () => {
    const onRetry = vi.fn();
    renderPanel({ changes: { status: "error", onRetry } });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows each command with its output, the running one, and what was cut short", () => {
    renderPanel({
      tab: "terminal",
      commands: [
        {
          id: "c1",
          command: "pnpm test",
          output: "1 failed… [5120 more characters]",
          exitCode: 1,
          running: false,
          cutShort: true,
        },
        {
          id: "c2",
          command: "pnpm lint",
          output: null,
          exitCode: null,
          running: true,
          cutShort: false,
        },
      ],
      selectedCommand: "c1",
    });
    expect(
      screen.getByRole("figure", { name: "Command: pnpm test" }),
    ).toHaveTextContent(
      "cut short: the start of the output is shown · exit code 1",
    );
    expect(
      screen.getByRole("figure", { name: "Command: pnpm lint" }),
    ).toHaveTextContent("running…");
  });

  it("compares each check before and after the agent's work", () => {
    renderPanel({
      tab: "checks",
      checksAfter: "done",
      checks: [
        {
          name: "lint",
          cwd: ".",
          before: "passing",
          after: "failing",
          comparison: "regressed",
        },
        {
          name: "test",
          cwd: "api",
          before: "failing",
          after: "passing",
          comparison: "fixed",
        },
      ],
    });
    expect(screen.getByText("lint").closest("div")).toHaveTextContent(
      "lint broken by this changepassingfailing",
    );
    expect(
      screen.getByText("test", { exact: false }).closest("div"),
    ).toHaveTextContent("fixed");
  });

  it("says when a finished run didn't record its checks after the agent's work", () => {
    renderPanel({
      tab: "checks",
      checksAfter: "missing",
      checks: [
        {
          name: "test",
          cwd: ".",
          before: "passing",
          after: null,
          comparison: null,
        },
      ],
    });
    expect(screen.queryByText("pending")).toBeNull();
    expect(
      screen.getByText(
        "This run didn't record each check after the agent's work.",
      ),
    ).toBeInTheDocument();
  });

  it("has the after column pending until the checks run again", () => {
    renderPanel({
      tab: "checks",
      checks: [
        {
          name: "test",
          cwd: ".",
          before: "passing",
          after: null,
          comparison: null,
        },
      ],
    });
    expect(screen.getByText("pending")).toBeInTheDocument();
  });
});
