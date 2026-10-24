import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WelcomeChecklist, type WelcomeStep } from "./welcome-checklist";

const steps: WelcomeStep[] = [
  {
    id: "install",
    state: "done",
    href: "https://github.com/apps/codegenie/installations/new",
    external: true,
  },
  { id: "add-repo", state: "current", href: "/projects/new", external: false },
  { id: "set-up", state: "todo", href: "/projects/new", external: false },
  { id: "first-task", state: "todo", href: "/new", external: false },
];

describe("WelcomeChecklist", () => {
  it("lists the four steps in order, with only the current one's action", () => {
    render(<WelcomeChecklist status="ready" steps={steps} />);

    const items = screen.getAllByRole("listitem");
    [
      "Install the GitHub App",
      "Add a repository",
      "Set up its environment",
      "Describe your first task",
    ].forEach((title, index) => expect(items[index]).toHaveTextContent(title));
    expect(screen.getAllByRole("link")).toHaveLength(1);
    expect(
      screen.getByRole("link", { name: "Choose a repository" }),
    ).toHaveAttribute("href", "/projects/new");
  });

  it("shows a placeholder while loading", () => {
    render(<WelcomeChecklist status="pending" />);

    expect(screen.getByLabelText("Loading your setup")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("offers to try again when loading failed", () => {
    const onRetry = vi.fn();
    render(<WelcomeChecklist status="error" onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't load your setup.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("lets the current step happen in place, and names what was added", () => {
    const { rerender } = render(
      <WelcomeChecklist
        status="ready"
        steps={steps}
        panels={{ "add-repo": <p>The repository picker</p> }}
      />,
    );
    expect(screen.getByText("The repository picker")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Choose a repository" }),
    ).toBeNull();

    rerender(
      <WelcomeChecklist
        status="ready"
        steps={[
          steps[0],
          { ...steps[1], state: "done", projectName: "dodesk" },
          { ...steps[2], state: "current", projectName: "dodesk" },
          steps[3],
        ]}
      />,
    );
    expect(screen.getAllByRole("listitem")[1]).toHaveTextContent(
      "dodesk added.",
    );
    expect(screen.getByRole("link", { name: "Start setup" })).toHaveAttribute(
      "href",
      steps[2]!.href,
    );
  });
});
