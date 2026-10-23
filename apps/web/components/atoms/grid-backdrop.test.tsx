import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GridBackdrop } from "./grid-backdrop";

describe("GridBackdrop", () => {
  it("fades from the top unless asked to centre", () => {
    const { container, rerender } = render(<GridBackdrop />);
    expect(container.firstChild).not.toHaveClass("grid-backdrop-center");

    rerender(<GridBackdrop focus="center" />);
    expect(container.firstChild).toHaveClass("grid-backdrop-center");
  });
});
