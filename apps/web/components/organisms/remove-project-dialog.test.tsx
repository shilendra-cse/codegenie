import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import {
  RemoveProjectDialog,
  type RemoveProjectDialogProps,
} from "./remove-project-dialog";

const show = (overrides: Partial<RemoveProjectDialogProps> = {}) => {
  const props: RemoveProjectDialogProps = {
    open: true,
    onOpenChange: vi.fn(),
    projectName: "dodesk",
    taskCount: 6,
    removing: false,
    error: null,
    onRemove: vi.fn(),
    ...overrides,
  };
  render(<RemoveProjectDialog {...props} />);
  return props;
};

describe("RemoveProjectDialog", () => {
  it("says what's deleted and that GitHub isn't touched", () => {
    show();

    expect(
      screen.getByRole("dialog", { name: "Remove dodesk?" }),
    ).toHaveAccessibleDescription(
      `Its 6 tasks, their runs and the environment are deleted from ${PRODUCT_NAME}. The repository and its pull requests on GitHub are not touched.`,
    );
  });

  it("counts one task as a task", () => {
    show({ taskCount: 1 });
    expect(screen.getByText(/^Its 1 task,/)).toBeVisible();
  });

  it("leaves the count out until it's known", () => {
    show({ taskCount: undefined });
    expect(screen.getByText(/^Its tasks,/)).toBeVisible();
  });

  it("removes the project", () => {
    const props = show();

    fireEvent.click(screen.getByRole("button", { name: "Remove project" }));
    expect(props.onRemove).toHaveBeenCalledOnce();
  });

  it("closes from Cancel", () => {
    const props = show();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(props.onOpenChange).toHaveBeenCalledWith(false);
  });

  it("says why it couldn't remove", () => {
    show({ error: "Couldn't remove the project. Try again." });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't remove the project. Try again.",
    );
  });
});
