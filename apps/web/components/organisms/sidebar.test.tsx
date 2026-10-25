import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sidebar, type SidebarProps } from "./sidebar";

const projects: SidebarProps["projects"] = [
  { id: "p1", name: "dodesk", health: "ok" },
  { id: "p2", name: "api-gateway", health: "attention" },
  { id: "p3", name: "portfolio", health: "none" },
];

function renderSidebar(props: Partial<SidebarProps> = {}) {
  render(
    <Sidebar
      pathname="/welcome"
      projects={[]}
      projectsFailed={false}
      account={null}
      {...props}
    />,
  );
}

describe("Sidebar", () => {
  it("links to New task, and shows no projects yet", () => {
    renderSidebar();

    const newTask = screen.getByRole("link", { name: "New task" });
    expect(newTask).toHaveAttribute("href", "/new");
    expect(newTask).not.toHaveAttribute("aria-current");
    expect(newTask).not.toHaveClass("bg-primary");
    expect(screen.getByText("No projects yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inbox" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks New task while you're on it", () => {
    renderSidebar({ pathname: "/new" });
    expect(screen.getByRole("link", { name: "New task" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("lists your recent tasks with their status, up to 10", () => {
    renderSidebar({
      pathname: "/tasks/t1",
      tasks: [
        { id: "t1", title: "Add a /health endpoint", label: "working" },
        { id: "t2", title: "Paginate the orders API", label: "pr_open" },
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `old-${i}`,
          title: `Old task ${i}`,
          label: "failed" as const,
        })),
      ],
    });

    expect(screen.getByRole("heading", { name: "Recent" })).toBeInTheDocument();
    const running = screen.getByRole("link", {
      name: "Add a /health endpoint, working",
    });
    expect(running).toHaveAttribute("href", "/tasks/t1");
    expect(running).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Paginate the orders API, PR open" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Old task 7")).toBeInTheDocument();
    expect(screen.queryByText("Old task 8")).toBeNull();
  });

  it("leaves out Recent without tasks", () => {
    renderSidebar({ tasks: [] });
    expect(screen.queryByRole("heading", { name: "Recent" })).toBeNull();
  });

  it("marks the link for the current page", () => {
    renderSidebar({ pathname: "/inbox" });

    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("lists your projects with their setup state", () => {
    renderSidebar({ projects });

    expect(screen.getByRole("link", { name: "dodesk, ready" })).toHaveAttribute(
      "href",
      "/projects/p1",
    );
    expect(
      screen.getByRole("link", { name: "api-gateway, needs attention" }),
    ).toHaveAttribute("href", "/projects/p2");
    expect(
      screen.getByRole("link", { name: "portfolio, not set up" }),
    ).toHaveAttribute("href", "/projects/p3");
    expect(screen.queryByText("No projects yet.")).toBeNull();
  });

  it("marks the project you're on, including its inner pages", () => {
    renderSidebar({ projects, pathname: "/projects/p2/environment" });

    expect(
      screen.getByRole("link", { name: "api-gateway, needs attention" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "dodesk, ready" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("offers to add a repository, and shows it as the current page while adding", () => {
    renderSidebar({ projects });
    expect(
      screen.getByRole("link", { name: "Add a repository" }),
    ).toHaveAttribute("href", "/projects/new");
    expect(screen.queryByRole("link", { name: "Add repository" })).toBeNull();

    renderSidebar({ projects, pathname: "/projects/new" });
    expect(
      screen.getByRole("link", { name: "Add repository" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("holds the place while projects load, and says so when they fail", () => {
    renderSidebar({ projects: undefined });
    expect(screen.queryByText("No projects yet.")).toBeNull();
    expect(screen.queryByRole("link", { name: /dodesk/ })).toBeNull();

    renderSidebar({ projects: undefined, projectsFailed: true });
    expect(screen.getByText("Couldn't load projects.")).toBeInTheDocument();
  });

  it("marks the project whose setup is waiting for you", () => {
    renderSidebar({
      projects: [{ id: "p1", name: "dodesk", health: "none", needsYou: true }],
    });

    const link = screen.getByRole("link", {
      name: "dodesk, needs your answer",
    });
    expect(link).toHaveTextContent("Needs you");
  });

  it("counts what's running or needs you on the Inbox", () => {
    renderSidebar({ inboxCount: 3 });
    expect(
      screen.getByRole("link", {
        name: "Inbox, 3 running or waiting for you",
      }),
    ).toHaveAttribute("href", "/inbox");
  });

  it("leaves the count out when nothing is going on", () => {
    renderSidebar({ inboxCount: 0 });
    expect(screen.getByRole("link", { name: "Inbox" })).toBeInTheDocument();
  });
});
