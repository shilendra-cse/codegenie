import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChecklistStep, type ChecklistStepProps } from "./checklist-step";

const step: ChecklistStepProps = {
  number: 2,
  state: "current",
  title: "Add a repository",
  body: "Pick one of the repositories you gave access to.",
  action: {
    label: "Choose a repository",
    href: "/projects/new",
    external: false,
  },
  hint: "It becomes a project.",
};

function renderStep(props: Partial<ChecklistStepProps>) {
  render(
    <ol>
      <ChecklistStep {...step} {...props} />
    </ol>,
  );
}

describe("ChecklistStep", () => {
  it("offers its action when it is the current step", () => {
    renderStep({});

    expect(screen.getByRole("listitem")).toHaveAttribute(
      "aria-current",
      "step",
    );
    expect(
      screen.getByRole("link", { name: "Choose a repository" }),
    ).toHaveAttribute("href", "/projects/new");
    expect(screen.getByText("It becomes a project.")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("links out for an external action", () => {
    renderStep({
      action: {
        label: "Install on GitHub",
        href: "https://github.com/apps/codegenie/installations/new",
        external: true,
      },
    });

    expect(
      screen.getByRole("link", { name: "Install on GitHub" }),
    ).toHaveAttribute(
      "href",
      "https://github.com/apps/codegenie/installations/new",
    );
  });

  it("is ticked when done, without an action", () => {
    renderStep({ state: "done" });

    expect(screen.getByRole("img", { name: "Done" })).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("has no action while it is still to do", () => {
    renderStep({ state: "todo" });

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Add a repository")).toHaveClass(
      "text-muted-foreground",
    );
  });
});
