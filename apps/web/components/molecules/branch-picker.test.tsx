import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { BranchPicker, type BranchPickerProps } from "./branch-picker";

function renderPicker(overrides: Partial<BranchPickerProps> = {}) {
  const props: BranchPickerProps = {
    value: "main",
    defaultBranch: "main",
    branches: ["main", "develop", "feat/auth-refresh", "fix/login-redirect"],
    truncated: false,
    loading: false,
    error: null,
    onOpen: vi.fn(),
    onRetry: vi.fn(),
    onChange: vi.fn(),
    ...overrides,
  };
  render(<BranchPicker {...props} />);
  fireEvent.click(screen.getByRole("button", { name: /^Base branch/ }));
  return props;
}

describe("BranchPicker", () => {
  it("asks for the branches when it opens, and lists them with the default marked", () => {
    const { onOpen } = renderPicker();

    expect(onOpen).toHaveBeenCalledOnce();
    expect(screen.getAllByRole("option")).toHaveLength(4);
    const main = screen.getByRole("option", { name: /main/ });
    expect(main).toHaveTextContent("default");
    expect(
      screen.getByRole("option", { name: /develop/ }),
    ).not.toHaveTextContent("default");
  });

  it("filters as you type", () => {
    renderPicker();
    fireEvent.change(screen.getByPlaceholderText("Search branches"), {
      target: { value: "fix" },
    });

    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option")).toHaveTextContent("fix/login-redirect");
  });

  it("says when nothing matches", () => {
    renderPicker();
    fireEvent.change(screen.getByPlaceholderText("Search branches"), {
      target: { value: "zzz" },
    });
    expect(screen.getByText("No branches match.")).toBeInTheDocument();
  });

  it("picks a branch with a click and closes", () => {
    const { onChange } = renderPicker();
    fireEvent.click(screen.getByRole("option", { name: /develop/ }));

    expect(onChange).toHaveBeenCalledWith("develop");
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("picks the highlighted branch with Enter", () => {
    const { onChange } = renderPicker();
    const search = screen.getByPlaceholderText("Search branches");
    fireEvent.change(search, { target: { value: "auth" } });
    fireEvent.keyDown(search, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("feat/auth-refresh");
  });

  it("shows placeholders while loading", () => {
    renderPicker({ branches: undefined, loading: true });
    expect(screen.getByLabelText("Loading branches")).toBeInTheDocument();
    expect(screen.queryByRole("option")).toBeNull();
  });

  it("says why it couldn't load, with Try again", () => {
    const { onRetry } = renderPicker({
      branches: undefined,
      error: `This repository is no longer available to ${PRODUCT_NAME}.`,
    });
    expect(
      screen.getByText(`This repository is no longer available to ${PRODUCT_NAME}.`),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("says when the list is cut short", () => {
    renderPicker({ truncated: true });
    expect(
      screen.getByText("Only the first 1,000 branches are listed."),
    ).toBeInTheDocument();
  });
});
