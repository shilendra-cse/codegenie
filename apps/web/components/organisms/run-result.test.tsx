import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RunResult, type RunResultProps } from "./run-result";

const props = (overrides: Partial<RunResultProps> = {}): RunResultProps => ({
  number: 1,
  time: "2 minutes ago",
  notice: null,
  summary: null,
  noBranch: false,
  checks: null,
  checksLine: null,
  pullRequest: null,
  ...overrides,
});

const result = () => screen.getByRole("article", { name: "Result of run 1" });

describe("RunResult", () => {
  it("gives the summary, the checks before and after, and the pull request", () => {
    render(
      <RunResult
        {...props({
          summary: "Added GET /health.\nTests cover both cases.",
          checks: [
            {
              name: "test",
              cwd: ".",
              before: "failing",
              after: "passing",
              comparison: "fixed",
            },
          ],
          pullRequest: {
            number: 7,
            url: "https://github.com/x/y/pull/7",
            title: "Add a /health endpoint",
            line: "Ready for review · into main",
            tone: "ok",
          },
        })}
      />,
    );

    expect(result()).toHaveTextContent("CodeGenie2 minutes ago");
    expect(screen.getByText(/Added GET \/health\./)).toHaveTextContent(
      "Added GET /health. Tests cover both cases.",
    );
    expect(screen.getByText("Before")).toBeInTheDocument();
    expect(screen.getByText("fixed")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Open PR #7 on GitHub" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(/No branch/)).toBeNull();
  });

  it("says what went wrong, with a way to fix it", () => {
    render(
      <RunResult
        {...props({
          notice: {
            tone: "err",
            title: "Failed during setup",
            text: "pnpm install failed.",
            note: "Nothing was pushed.",
            action: {
              label: "Re-run environment setup",
              href: "/projects/p1/environment",
            },
          },
        })}
      />,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(
      "Failed during setuppnpm install failed.Nothing was pushed.",
    );
    expect(
      within(result()).getByRole("link", { name: "Re-run environment setup" }),
    ).toHaveAttribute("href", "/projects/p1/environment");
  });

  it("says when no branch was made, and gives the checks' overall result for older runs", () => {
    render(
      <RunResult
        {...props({
          notice: {
            tone: "warn",
            title: "Stopped at the time limit.",
            text: null,
            note: null,
            action: null,
          },
          summary: "Ran out of time.",
          noBranch: true,
          checksLine: "All checks passed.",
        })}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "Stopped at the time limit.",
    );
    expect(
      screen.getByText("No branch or pull request was created."),
    ).toBeInTheDocument();
    expect(screen.getByText("All checks passed.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByText("Before")).toBeNull();
  });
});
