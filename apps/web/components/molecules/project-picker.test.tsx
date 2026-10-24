import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { type PickerProject, ProjectPicker } from "./project-picker";

const projects: PickerProject[] = [
  { id: "p1", name: "dodesk", branch: "main", health: "ok", blocked: null },
  {
    id: "p2",
    name: "web-shop",
    branch: "main",
    health: "none",
    blocked: {
      reason: "Not set up",
      fix: { label: "Set up", href: "/projects/p2/environment" },
    },
  },
  {
    id: "p3",
    name: "api-gateway",
    branch: "develop",
    health: "ok",
    blocked: { reason: "GitHub App suspended", fix: null },
  },
];

function open(selectedId: string | null = "p1") {
  const onSelect = vi.fn();
  render(
    <ProjectPicker
      projects={projects}
      selectedId={selectedId}
      onSelect={onSelect}
    />,
  );
  fireEvent.keyDown(screen.getByRole("button", { name: /^Project:/ }), {
    key: "Enter",
  });
  return onSelect;
}

describe("ProjectPicker", () => {
  it("picks a project that's ready", () => {
    const onSelect = open();
    fireEvent.click(screen.getByRole("menuitem", { name: /dodesk/ }));
    expect(onSelect).toHaveBeenCalledWith("p1");
  });

  it("says why a project can't be picked, and links to the fix", () => {
    const onSelect = open();

    const notSetUp = screen.getByRole("menuitem", { name: /web-shop/ });
    expect(notSetUp).toHaveTextContent("Not set up · Set up");
    expect(notSetUp).toHaveAttribute("href", "/projects/p2/environment");

    const suspended = screen.getByRole("menuitem", { name: /api-gateway/ });
    expect(suspended).toHaveTextContent("GitHub App suspended");
    expect(suspended).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(suspended);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("offers to add a repository", () => {
    open();
    expect(
      screen.getByRole("menuitem", { name: "Add a repository" }),
    ).toHaveAttribute("href", "/projects/new");
  });

  it("asks for a project when none is picked", () => {
    render(
      <ProjectPicker
        projects={projects}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Choose a project");
  });
});
