import { render, screen } from "@testing-library/react";
import { Inbox } from "lucide-react";
import { describe, expect, it } from "vitest";
import { Icon } from "./icon";

describe("Icon", () => {
  it("is hidden from screen readers unless it's labelled", () => {
    const { container } = render(<Icon icon={Inbox} />);
    expect(container.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("is announced with its label", () => {
    render(<Icon icon={Inbox} label="Inbox" />);
    expect(screen.getByRole("img", { name: "Inbox" })).toBeInTheDocument();
  });
});
