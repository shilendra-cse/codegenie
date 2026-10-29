import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DevlogProse } from "./devlog-prose";

describe("DevlogProse", () => {
  it("renders Markdown with linkable headings", async () => {
    render(
      await DevlogProse({
        source: "## How it works\n\nSome **bold** and `code`.\n\n- One\n- Two",
      }),
    );

    expect(
      screen.getByRole("heading", { level: 2, name: "How it works" }),
    ).toHaveAttribute("id", "how-it-works");
    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByText("code").tagName).toBe("CODE");
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders GitHub-style tables", async () => {
    render(
      await DevlogProse({
        source: "| Step | Where |\n| --- | --- |\n| Setup | Sandbox |",
      }),
    );

    expect(screen.getByRole("columnheader", { name: "Step" })).toBeVisible();
    expect(screen.getByRole("cell", { name: "Sandbox" })).toBeVisible();
  });

  it("strips imports from a post", async () => {
    render(await DevlogProse({ source: 'import x from "node:fs"\n\nHello.' }));

    expect(screen.getByText("Hello.")).toBeInTheDocument();
  });
});
