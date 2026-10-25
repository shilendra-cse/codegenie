import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectTabs, type ProjectTabsProps } from "./project-tabs";

const show = (overrides: Partial<ProjectTabsProps> = {}) =>
  render(
    <ProjectTabs
      name="dodesk"
      fullName="ada/dodesk"
      repositoryUrl="https://github.com/ada/dodesk"
      newTaskHref="/new?project=p1"
      tabs={[
        { label: "Tasks", href: "/projects/p1", active: true },
        {
          label: "Environment",
          href: "/projects/p1/environment",
          active: false,
        },
      ]}
      {...overrides}
    >
      <p>Tab content</p>
    </ProjectTabs>,
  );

describe("ProjectTabs", () => {
  it("names the project, links to GitHub and starts a task in it", () => {
    show();

    expect(screen.getByRole("heading", { name: "dodesk" })).toBeVisible();
    expect(screen.getByRole("link", { name: "ada/dodesk" })).toHaveAttribute(
      "href",
      "https://github.com/ada/dodesk",
    );
    expect(screen.getByRole("link", { name: "New task" })).toHaveAttribute(
      "href",
      "/new?project=p1",
    );
    expect(screen.getByText("Tab content")).toBeVisible();
  });

  it("marks the current tab", () => {
    show();

    const tabs = within(screen.getByRole("navigation", { name: "Project" }));
    expect(tabs.getByRole("link", { name: "Tasks" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(tabs.getByRole("link", { name: "Environment" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("flags a tab that needs attention and shows the banner", () => {
    show({
      tabs: [
        {
          label: "Environment",
          href: "/projects/p1/environment",
          active: false,
          attention: true,
        },
      ],
      banner: <div role="status">Setup needs attention.</div>,
    });

    expect(
      screen.getByRole("link", { name: "Environment, needs attention" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "Setup needs attention.",
    );
  });
});
