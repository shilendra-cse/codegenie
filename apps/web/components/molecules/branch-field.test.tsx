import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { BranchField } from "./branch-field";

describe("BranchField", () => {
  it("shows the branch, and turns into a field to change it", () => {
    const onChange = vi.fn();
    render(<BranchField value="main" onChange={onChange} error={null} />);
    expect(screen.getByLabelText("Base branch")).toHaveTextContent("main");

    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    const field = screen.getByRole("textbox", { name: "Base branch" });
    expect(field).toHaveFocus();
    fireEvent.change(field, { target: { value: "develop" } });
    expect(onChange).toHaveBeenCalledWith("develop");
  });

  it("says when the name isn't valid", () => {
    render(
      <BranchField
        value="a b"
        onChange={vi.fn()}
        error="Not a valid branch name."
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Not a valid branch name.",
    );
  });
});
