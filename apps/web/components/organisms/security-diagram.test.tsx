import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SecurityDiagram } from "./security-diagram";

describe("SecurityDiagram", () => {
  it("shows the write token outside the sandbox, on the way to GitHub", () => {
    render(<SecurityDiagram />);
    const diagram = screen.getByRole("figure", {
      name: "How a change reaches GitHub",
    });

    const order = [
      "Sandbox",
      "changes, checked by hash",
      "CodeGenie",
      "Write token · one repo · 1 hour",
      "verified commit + pull request",
      "GitHub",
    ];
    const nodes = order.map((text) => within(diagram).getByText(text));
    nodes.slice(1).forEach((node, i) => {
      expect(
        nodes[i].compareDocumentPosition(node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });
});
