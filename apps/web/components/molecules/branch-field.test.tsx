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

  it.each([
    [
      "Enter",
      (field: HTMLElement) => fireEvent.keyDown(field, { key: "Enter" }),
    ],
    ["clicking away", (field: HTMLElement) => fireEvent.blur(field)],
  ])("applies the branch with %s", (_how, leave) => {
    render(<BranchField value="develop" onChange={vi.fn()} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Change" }));

    leave(screen.getByRole("textbox", { name: "Base branch" }));

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByLabelText("Base branch")).toHaveTextContent("develop");
  });

  it("puts the old branch back with Esc", () => {
    const onChange = vi.fn();
    render(<BranchField value="main" onChange={onChange} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    const field = screen.getByRole("textbox", { name: "Base branch" });
    fireEvent.change(field, { target: { value: "dev" } });

    fireEvent.keyDown(field, { key: "Escape" });

    expect(onChange).toHaveBeenLastCalledWith("main");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("stays open while the name isn't valid", () => {
    render(
      <BranchField
        value="a b"
        onChange={vi.fn()}
        error="Not a valid branch name."
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    const field = screen.getByRole("textbox", { name: "Base branch" });

    fireEvent.keyDown(field, { key: "Enter" });
    fireEvent.blur(field);

    expect(
      screen.getByRole("textbox", { name: "Base branch" }),
    ).toBeInTheDocument();
  });

  it("has buttons to apply or cancel, for those who don't know the keys", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <BranchField value="main" onChange={onChange} error={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    rerender(<BranchField value="develop" onChange={onChange} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByLabelText("Base branch")).toHaveTextContent("develop");

    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    rerender(<BranchField value="dev" onChange={onChange} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onChange).toHaveBeenLastCalledWith("develop");
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("can't apply a name that isn't valid", () => {
    render(
      <BranchField
        value="a b"
        onChange={vi.fn()}
        error="Not a valid branch name."
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    expect(screen.getByRole("button", { name: "Apply" })).toBeDisabled();
  });
});
