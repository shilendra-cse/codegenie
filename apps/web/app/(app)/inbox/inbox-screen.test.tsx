import type {
  OnboardingResponse,
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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InboxScreen } from "./inbox-screen";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));
const router = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const NOW = new Date(2026, 9, 28, 15, 0);
const at = (day: number, hour = 9) =>
  new Date(2026, 9, day, hour).toISOString();

const task = (
  id: string,
  title: string,
  label: TaskListItem["label"],
  createdAt: string,
): TaskListItem => ({
  id,
  title,
  project: { id: "p1", owner: "ada", name: "dodesk" },
  label,
  baseBranch: "main",
  branchName: null,
  pullRequest:
    label === "pr_open"
      ? { number: 41, url: "https://x/41", draft: false }
      : null,
  latestRun: {
    id: `r-${id}`,
    status: label === "working" ? "running" : "succeeded",
    stage: label === "working" ? "verify" : null,
    error: null,
    checksPassed: label === "pr_open" ? true : null,
    filesChanged: label === "pr_open" ? 4 : null,
    summaryLine: null,
  },
  runCount: 1,
  durationMs: 432_000,
  costUsd: 0.21,
  createdAt,
  updatedAt: createdAt,
});

const project = (
  id: string,
  name: string,
  setup: ProjectResponse["setup"],
): ProjectResponse => ({
  id,
  repo: { githubId: 1, owner: "ada", name },
  defaultBranch: "main",
  environment: null,
  installation: {
    id: 1,
    accountLogin: "ada",
    accountType: "user",
    suspended: false,
    uninstalled: false,
  },
  setup,
  createdAt: at(20),
});

const rowTexts = () =>
  screen
    .queryAllByRole("region")
    .flatMap((region) => within(region).getAllByRole("link"))
    .map((link) => link.textContent);

const counts = { all: 3, running: 1, pr: 1, done: 1 };
let tasks: TaskListItem[];
let projects: ProjectResponse[];
let nextCursor: string | null;

function serve() {
  api.get.mockImplementation(
    async (url: string, options?: { params?: { filter?: string } }) => {
      if (url === "/projects") return { data: { projects } };
      if (url.endsWith("/onboarding")) {
        return {
          data: {
            onboarding: {
              id: "o1",
              status: "waiting",
              costUsd: 0.02,
              queuedAt: at(28, 14),
              startedAt: at(28, 14),
            } as OnboardingResponse,
          },
        };
      }
      const filter = options?.params?.filter;
      const page: TaskPage = {
        tasks: filter ? tasks.filter((t) => t.label === "pr_open") : tasks,
        nextCursor,
        counts,
      };
      return { data: page };
    },
  );
}

function renderScreen(filter?: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <InboxScreen filter={filter} />
    </QueryClientProvider>,
  );
}

describe("InboxScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
    router.replace.mockReset();
    tasks = [
      task("t1", "Add a /health endpoint", "working", at(28, 10)),
      task("t2", "Paginate the orders API", "pr_open", at(27)),
      task("t3", "Migrate to Vite 6", "cancelled", at(20)),
    ];
    projects = [
      project("p1", "dodesk", { id: "o0", status: "succeeded" }),
      project("p2", "shilendra-dev", { id: "o1", status: "waiting" }),
    ];
    nextCursor = null;
    serve();
  });
  afterEach(() => vi.useRealTimers());

  it("lists tasks by day, with the setup that needs you first", async () => {
    renderScreen();

    const today = await screen.findByRole("region", { name: "Today" });
    const rows = within(today).getAllByRole("link");
    expect(rows[0]).toHaveTextContent("Set up shilendra-dev");
    expect(rows[0]).toHaveTextContent("Needs your answer");
    expect(rows[0]).toHaveAttribute("href", "/projects/p2/environment");
    expect(rows[1]).toHaveTextContent("Add a /health endpoint");
    expect(rows[1]).toHaveTextContent("Running the checks");
    expect(rows[1]).toHaveAttribute("href", "/tasks/t1");

    const yesterday = screen.getByRole("region", { name: "Yesterday" });
    expect(within(yesterday).getByRole("link")).toHaveTextContent(
      "Checks passing · 4 files changed",
    );
    expect(within(yesterday).getByRole("link")).toHaveTextContent(
      "PR #41 open",
    );
    expect(within(yesterday).getByRole("link")).toHaveTextContent(
      "7m 12s · $0.21",
    );
    expect(screen.getByRole("region", { name: "Earlier" })).toBeInTheDocument();
  });

  it("counts each filter, setups included", async () => {
    renderScreen();

    expect(await screen.findByRole("tab", { name: "All 4" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("tab", { name: "Needs you 1" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Running 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "PR open 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Done 1" })).toBeInTheDocument();
  });

  it("filters, keeping the filter in the address", async () => {
    renderScreen();
    await screen.findByRole("region", { name: "Today" });

    fireEvent.click(screen.getByRole("tab", { name: /PR open/ }));

    expect(router.replace).toHaveBeenCalledWith("/inbox?filter=pr", {
      scroll: false,
    });
    await waitFor(() =>
      expect(rowTexts()).toEqual([
        expect.stringContaining("Paginate the orders API"),
      ]),
    );
    expect(api.get).toHaveBeenCalledWith("/tasks", {
      params: { projectId: undefined, filter: "pr", cursor: undefined },
    });

    fireEvent.click(screen.getByRole("tab", { name: /All/ }));
    expect(router.replace).toHaveBeenLastCalledWith("/inbox", {
      scroll: false,
    });
  });

  it("shows only the setups under Needs you", async () => {
    renderScreen("needs-you");

    await waitFor(() =>
      expect(rowTexts()).toEqual([
        expect.stringContaining("Set up shilendra-dev"),
      ]),
    );
  });

  it("says when a filter has nothing", async () => {
    projects = [project("p1", "dodesk", null)];
    renderScreen("needs-you");

    expect(
      await screen.findByText("No tasks match this filter."),
    ).toBeVisible();
  });

  it("loads more when there's another page", async () => {
    nextCursor = "t3";
    renderScreen("running");
    await screen.findByRole("button", { name: "Load more" });

    nextCursor = null;
    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    await waitFor(() =>
      expect(api.get).toHaveBeenCalledWith("/tasks", {
        params: { projectId: undefined, filter: "running", cursor: "t3" },
      }),
    );
  });

  it("offers to try again when the tasks don't load", async () => {
    api.get.mockImplementation(
      async (url: string, options?: { params?: { filter?: string } }) => {
        if (url === "/projects") return { data: { projects: [] } };
        if (options?.params?.filter) throw new Error("down");
        return { data: { tasks, nextCursor: null, counts } };
      },
    );
    renderScreen("done");

    expect(await screen.findByText(/Couldn't load your tasks/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  it("sends someone without tasks to the welcome checklist", async () => {
    tasks = [];
    renderScreen();

    await waitFor(() =>
      expect(router.replace).toHaveBeenCalledWith("/welcome"),
    );
  });
});
