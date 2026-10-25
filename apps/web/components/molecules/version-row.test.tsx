import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { VersionRow, type VersionRowProps } from "./version-row";

const show = (overrides: Partial<VersionRowProps> = {}) => {
  const props: VersionRowProps = {
    version: 1,
    active: false,
    activeVersion: 2,
    made: "Set up by CodeGenie",
    when: "5 days ago",
    confirming: false,
    restoring: false,
    error: null,
    onRestore: vi.fn(),
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  render(<VersionRow {...props} />);
  return props;
};

describe("VersionRow", () => {
  it("offers to restore a replaced version", () => {
    const props = show();

    expect(screen.getByText("replaced")).toBeVisible();
    expect(screen.getByText(/Set up by CodeGenie/)).toHaveTextContent(
      "Set up by CodeGenie · 5 days ago",
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(props.onRestore).toHaveBeenCalledOnce();
  });

  it("can't restore the active version", () => {
    show({ version: 2, active: true });

    expect(screen.getByText("active")).toBeVisible();
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
  });

  it("asks before restoring", () => {
    const props = show({ confirming: true });

    expect(screen.getByRole("group", { name: "Restore v1" })).toHaveTextContent(
      "Make v1 active again? New tasks will use its steps and checks. v2 is kept.",
    );
    expect(screen.queryByRole("button", { name: "Restore" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Restore v1" }));
    expect(props.onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onCancel).toHaveBeenCalledOnce();
  });

  it("says why it couldn't restore", () => {
    show({ error: "Finish or stop the setup first." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Finish or stop the setup first.",
    );
  });
});
