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
    expect(screen.getByRole("table").parentElement).toHaveClass("devlog-table");
  });

  it("highlights code blocks for light and dark", async () => {
    const { container } = render(
      await DevlogProse({ source: "```ts\nconst ok = true;\n```" }),
    );

    const code = container.querySelector("pre code[data-language='ts']");
    expect(code).toHaveTextContent("const ok = true;");
    const keyword = [...(code?.querySelectorAll("span[style]") ?? [])].find(
      (span) => span.textContent === "const",
    );
    expect(keyword?.getAttribute("style")).toMatch(
      /--shiki-light:.+--shiki-dark:/,
    );
  });

  it("renders a code block without a language as plain text", async () => {
    const { container } = render(
      await DevlogProse({ source: "```\nAdd a /health endpoint.\n```" }),
    );

    expect(container.querySelector("pre code")).toHaveTextContent(
      "Add a /health endpoint.",
    );
  });

  it("renders the components it's given", async () => {
    render(
      await DevlogProse({
        source: '<Note text="Hi" />',
        components: {
          Note: ({ text }: { text: string }) => <aside>{text}</aside>,
        },
      }),
    );

    expect(screen.getByRole("complementary")).toHaveTextContent("Hi");
  });

  it("strips imports from a post", async () => {
    render(await DevlogProse({ source: 'import x from "node:fs"\n\nHello.' }));

    expect(screen.getByText("Hello.")).toBeInTheDocument();
  });
});
