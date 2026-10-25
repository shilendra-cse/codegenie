import type { ProjectResponse } from "@codegenie/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { NewTaskScreen } from "./new-task-screen";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const project = (
  id: string,
  name: string,
  overrides: Partial<ProjectResponse> = {},
): ProjectResponse => ({
  id,
  repo: { githubId: 1, owner: "ada", name },
  defaultBranch: "main",
  environment: {
    version: 1,
    health: "ok",
    healthReasons: [],
    savedAt: "2026-10-24T08:00:00.000Z",
  },
  installation: { accountLogin: "ada", suspended: false, uninstalled: false },
  setup: null,
  createdAt: "2026-10-24T08:00:00.000Z",
  ...overrides,
});

const created = {
  task: {
    id: "t9",
    projectId: "p2",
    title: "Add a /health endpoint",
    baseBranch: "main",
    createdAt: "2026-10-24T10:00:00.000Z",
  },
  run: { id: "r9", status: "queued", model: "m" },
};

let projects: ProjectResponse[];

function renderScreen(projectId?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <NewTaskScreen projectId={projectId} />
    </QueryClientProvider>,
  );
}

const describeTask = (text = "Add a /health endpoint") =>
  fireEvent.change(screen.getByRole("textbox", { name: "Task description" }), {
    target: { value: text },
  });

describe("NewTaskScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    router.push.mockReset();
    projects = [project("p1", "dodesk"), project("p2", "buyerbook")];
    api.get.mockReset().mockImplementation(async (url: string) => ({
      data:
        url === "/projects"
          ? { projects }
          : url.endsWith("/branches")
            ? {
                branches: ["main", "develop"],
                defaultBranch: "main",
                truncated: false,
              }
            : { tasks: [], nextCursor: null },
    }));
    api.post.mockReset().mockResolvedValue({ data: created });
  });

  it("starts a task on the project asked for and opens it", async () => {
    renderScreen("p2");
    const picker = await screen.findByRole("button", { name: /^Project:/ });
    expect(picker).toHaveTextContent("buyerbook");
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();

    describeTask();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/tasks/t9"));
    expect(api.post).toHaveBeenCalledWith("/projects/p2/tasks", {
      prompt: "Add a /health endpoint",
      baseBranch: "main",
    });
    expect(localStorage.getItem("codegenie:last-project")).toBe("p2");
  });

  it("starts on the project you used last", async () => {
    localStorage.setItem("codegenie:last-project", "p2");
    renderScreen();
    expect(
      await screen.findByRole("button", { name: /^Project:/ }),
    ).toHaveTextContent("buyerbook");
  });

  it("starts on a branch picked from the list", async () => {
    renderScreen();
    const trigger = await screen.findByRole("button", {
      name: "Base branch: main",
    });
    expect(api.get).not.toHaveBeenCalledWith("/projects/p1/branches");
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", { name: /develop/ }));
    expect(api.get).toHaveBeenCalledWith("/projects/p1/branches");
    expect(
      screen.getByRole("button", { name: "Base branch: develop" }),
    ).toBeInTheDocument();

    describeTask();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/projects/p1/tasks", {
        prompt: "Add a /health endpoint",
        baseBranch: "develop",
      }),
    );
  });

  it("keeps your text and says why starting failed", async () => {
    api.post.mockRejectedValue(
      new ApiError(409, "Needs attention.", "PROJECT_NEEDS_ATTENTION"),
    );
    renderScreen();
    await screen.findByRole("button", { name: /^Project:/ });
    describeTask();
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This project's setup needs attention.",
    );
    expect(screen.getByRole("link", { name: "Re-run setup" })).toHaveAttribute(
      "href",
      "/projects/p1/environment",
    );
    expect(
      screen.getByRole("textbox", { name: "Task description" }),
    ).toHaveValue("Add a /health endpoint");
    expect(router.push).not.toHaveBeenCalled();
  });

  it("says when no project can take a task yet", async () => {
    projects = [project("p1", "dodesk", { environment: null })];
    renderScreen();

    expect(
      await screen.findByText("None of your projects can take a task yet."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Set up dodesk" })).toHaveAttribute(
      "href",
      "/projects/p1/environment",
    );
    describeTask();
    expect(screen.getByRole("button", { name: "Start" })).toBeDisabled();
  });

  it("asks you to add a repository when you have none", async () => {
    projects = [];
    renderScreen();
    expect(
      await screen.findByRole("link", { name: "Add a repository" }),
    ).toHaveAttribute("href", "/projects/new");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows your recent tasks", async () => {
    api.get.mockImplementation(async (url: string) => ({
      data:
        url === "/projects"
          ? { projects }
          : {
              tasks: [
                {
                  id: "t1",
                  title: "Paginate the orders API",
                  project: { id: "p2", owner: "ada", name: "buyerbook" },
                  label: "working",
                  pullRequest: null,
                },
              ],
              nextCursor: null,
            },
    }));
    renderScreen();
    expect(
      await screen.findByRole("link", { name: /Paginate the orders API/ }),
    ).toHaveAttribute("href", "/tasks/t1");
  });

  it("offers to try again when projects don't load", async () => {
    api.get.mockRejectedValueOnce(new ApiError(500, "Down."));
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("button", { name: /^Project:/ }),
    ).toBeInTheDocument();
  });
});
