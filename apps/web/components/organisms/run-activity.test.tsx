import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type ActivityView, RunActivity } from "./run-activity";

const activity: ActivityView[] = [
  {
    id: "g1",
    kind: "explored",
    running: false,
    failed: false,
    reads: 2,
    searches: 1,
    listings: 0,
    items: [
      { id: "a", tool: "read_file", target: "src/app.ts" },
      { id: "b", tool: "search", target: "checkDatabase" },
      { id: "c", tool: "read_file", target: "src/db.ts" },
    ],
  },
  {
    id: "e1",
    kind: "edit",
    running: false,
    failed: false,
    path: "src/routes/health.ts",
    whole: true,
    added: 11,
    removed: 0,
    edits: 1,
  },
  {
    id: "e3",
    kind: "edit",
    running: false,
    failed: false,
    path: "src/routes/index.ts",
    whole: false,
    added: 8,
    removed: 5,
    edits: 2,
  },
  {
    id: "e2",
    kind: "edit",
    running: false,
    failed: true,
    path: "src/gone.ts",
    whole: false,
    added: 0,
    removed: 0,
    edits: 0,
  },
  {
    id: "c1",
    kind: "command",
    running: false,
    failed: true,
    command: "pnpm test",
    exitCode: 1,
  },
  {
    id: "k1",
    kind: "checks",
    running: true,
    failed: false,
    passing: 0,
    failing: 0,
  },
];

describe("RunActivity", () => {
  it("lists the agent's work, folding its reading into one expandable row", () => {
    render(<RunActivity activity={activity} reasoning="" live={false} />);

    const explored = screen.getByRole("button", { name: /Explored the code/ });
    expect(explored).toHaveTextContent("read 2 files, searched 1 time");
    expect(screen.queryByText("src/db.ts")).toBeNull();
    fireEvent.click(explored);
    expect(screen.getByText("src/db.ts")).toBeInTheDocument();

    expect(
      screen.getByText("src/routes/health.ts").closest("li"),
    ).toHaveTextContent("Wrote src/routes/health.ts+11");
    expect(
      screen.getByText("src/routes/health.ts").closest("li"),
    ).not.toHaveTextContent("edits");
    expect(
      screen.getByText("src/routes/index.ts").closest("li"),
    ).toHaveTextContent("Edited src/routes/index.ts+8−5 · 2 edits");
    expect(screen.getByText("src/gone.ts").closest("li")).toHaveTextContent(
      "Couldn't edit src/gone.ts",
    );
    expect(screen.getByText("pnpm test").closest("li")).toHaveTextContent(
      "Ran pnpm testexit 1",
    );
    expect(screen.getByText("Running the checks")).toBeInTheDocument();
  });

  it("streams the agent's reasoning while it works", () => {
    const { rerender } = render(
      <RunActivity activity={[]} reasoning="Adding the route next" live />,
    );
    expect(screen.getByText("Adding the route next")).toBeInTheDocument();

    rerender(
      <RunActivity
        activity={[]}
        reasoning="Adding the route next"
        live={false}
      />,
    );
    expect(screen.queryByText("Adding the route next")).toBeNull();
  });
});
