import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommandTable } from "./command-table";

const commands = [
  { name: "typecheck", cwd: "frontend", command: "pnpm typecheck" },
  { name: "test", cwd: "backend", command: "pnpm test" },
];

describe("CommandTable", () => {
  it("lists each command's name, folder and command under its title", () => {
    render(<CommandTable title="Checks" commands={commands} />);

    expect(screen.getByText("Checks")).toBeVisible();
    expect(
      screen.getAllByRole("row").map((row) =>
        within(row)
          .getAllByRole("cell")
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ["typecheck", "frontend", "pnpm typecheck"],
      ["test", "backend", "pnpm test"],
    ]);
  });

  it("ticks each one when asked", () => {
    render(<CommandTable title="Checks" commands={commands} ticked />);

    expect(
      within(screen.getAllByRole("row")[0]!).getAllByRole("cell"),
    ).toHaveLength(4);
  });
});
