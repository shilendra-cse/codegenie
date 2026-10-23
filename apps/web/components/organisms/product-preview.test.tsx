import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProductPreview } from "./product-preview";

describe("ProductPreview", () => {
  it("reads as the finished run", () => {
    render(<ProductPreview />);
    const preview = screen.getByRole("region", { name: "Product preview" });

    expect(within(preview).getByText("Succeeded")).toBeVisible();
    expect(within(preview).getByText("PR #42 open")).toBeVisible();
    expect(within(preview).getAllByRole("listitem")).toHaveLength(6);
    expect(within(preview).getByText("all passing")).toBeInTheDocument();
  });

  it("hides the in-progress badge from screen readers", () => {
    render(<ProductPreview />);

    expect(screen.getByText("Working").closest("[aria-hidden]")).not.toBeNull();
  });
});
