import type {
  ProjectResponse,
  TaskListItem,
  TaskPage,
} from "@codegenie/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectTasksScreen } from "./project-tasks-screen";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));

const project: ProjectResponse = {
  id: "p1",
  repo: { githubId: 1, owner: "ada", name: "dodesk" },
  defaultBranch: "main",
  environment: null,
  installation: { accountLogin: "ada", suspended: false, uninstalled: false },
  setup: null,
  createdAt: "2026-10-20T08:00:00.000Z",
};

const task = (id: string, title: string): TaskListItem => ({
  id,
  title,
  project: { id: "p1", owner: "ada", name: "dodesk" },
  label: "pr_open",
  baseBranch: "main",
  branchName: null,
  pullRequest: { number: 36, url: "https://x/36", draft: false },
  latestRun: null,
  runCount: 2,
  durationMs: 531_000,
  costUsd: 0.19,
  createdAt: "2026-10-24T08:00:00.000Z",
  updatedAt: "2026-10-24T08:00:00.000Z",
});

const counts = { all: 0, running: 0, pr: 0, done: 0 };
let pages: TaskPage[];
let failTasks: boolean;

function serve() {
  api.get.mockImplementation(
    async (url: string, options?: { params?: Record<string, string> }) => {
      if (url === "/projects") return { data: { projects: [project] } };
      if (failTasks) throw new Error("down");
      const page = options?.params?.cursor ? pages[1]! : pages[0]!;
      return { data: page };
    },
  );
}

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ProjectTasksScreen projectId="p1" />
    </QueryClientProvider>,
  );
}

const titles = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("link")[0]!.textContent);

describe("ProjectTasksScreen", () => {
  beforeEach(() => {
    failTasks = false;
    pages = [
      { tasks: [task("t1", "Show order totals")], nextCursor: null, counts },
    ];
    serve();
  });

  it("lists only this project's tasks", async () => {
    renderScreen();

    expect(
      await screen.findByRole("link", { name: "Show order totals" }),
    ).toHaveAttribute("href", "/tasks/t1");
    expect(screen.getByRole("cell", { name: "8m 51s" })).toBeVisible();
    expect(api.get).toHaveBeenCalledWith("/tasks", {
      params: { projectId: "p1", filter: undefined, cursor: undefined },
    });
  });

  it("loads the next page", async () => {
    pages = [
      { tasks: [task("t1", "Show order totals")], nextCursor: "c1", counts },
      {
        tasks: [task("t2", "Add a dark mode toggle")],
        nextCursor: null,
        counts,
      },
    ];
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    await waitFor(() =>
      expect(titles()).toEqual(["Show order totals", "Add a dark mode toggle"]),
    );
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("points to New task when the project has none", async () => {
    pages = [{ tasks: [], nextCursor: null, counts }];
    renderScreen();

    expect(
      await screen.findByText("No tasks in this project yet"),
    ).toBeVisible();
    expect(screen.getByText(/Describe a change to dodesk/)).toBeVisible();
    expect(screen.getByRole("link", { name: "New task" })).toHaveAttribute(
      "href",
      "/new?project=p1",
    );
  });

  it("offers to try again when the tasks couldn't load", async () => {
    failTasks = true;
    renderScreen();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't load this project's tasks",
    );
    failTasks = false;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("link", { name: "Show order totals" }),
    ).toBeVisible();
  });

  it("shows placeholder rows while loading", () => {
    api.get.mockReturnValue(new Promise(() => {}));
    const { container } = renderScreen();

    expect(container.querySelector("[aria-busy]")).not.toBeNull();
  });
});
