import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EnvironmentCard } from "./environment-card";

describe("EnvironmentCard", () => {
  it("shows the saved setup steps, checks and decisions", () => {
    render(
      <EnvironmentCard
        projectName="dodesk"
        newTaskHref="/new?project=p1"
        environment={{
          version: 1,
          active: true,
          source: "ai",
          savedAt: "2026-10-24T10:00:00.000Z",
          health: "ok",
          healthReasons: [],
          steps: [
            {
              name: "install",
              cwd: ".",
              command: "pnpm install --frozen-lockfile",
            },
          ],
          checks: [
            {
              name: "test",
              cwd: "backend",
              command: "pnpm test --exclude 'test/db/**'",
            },
          ],
          decisions: [
            {
              question: "Backend tests need PostgreSQL",
              answer: "Skip them",
              auto: false,
            },
            { question: "Package manager", answer: "pnpm", auto: true },
          ],
        }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "dodesk's environment" }),
    ).toBeInTheDocument();
    expect(screen.getByText("v1 · active")).toBeInTheDocument();
    expect(
      screen.getByText("pnpm install --frozen-lockfile"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("pnpm test --exclude 'test/db/**'"),
    ).toBeInTheDocument();
    expect(screen.getByText("(you)")).toBeInTheDocument();
    expect(screen.getByText("(detected)")).toBeInTheDocument();
    expect(screen.getByText("Saved. dodesk is ready.")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Describe your first task" }),
    ).toHaveAttribute("href", "/new?project=p1");
  });
});
