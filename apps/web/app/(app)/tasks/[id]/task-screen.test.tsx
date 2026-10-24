import type { TaskDetail } from "@codegenie/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { TaskScreen } from "./task-screen";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));
vi.mock("@/features/account/use-account", () => ({
  useAccount: () => ({
    account: { name: "Ada Lovelace", email: "ada@example.com", image: null },
  }),
}));

const task = (overrides: Partial<TaskDetail> = {}): TaskDetail => ({
  id: "t1",
  title: "Add a /health endpoint",
  project: { id: "p1", owner: "ada", name: "dodesk" },
  label: "working",
  baseBranch: "main",
  branchName: null,
  pullRequest: null,
  latestRun: { id: "r1", status: "running", stage: "agent", error: null },
  runCount: 1,
  durationMs: 0,
  costUsd: 0,
  createdAt: "2026-10-24T10:00:00.000Z",
  updatedAt: "2026-10-24T10:00:00.000Z",
  messages: [
    {
      id: "m1",
      role: "user",
      authorUserId: "u1",
      runId: null,
      content: "Add a /health endpoint that returns the version.",
      createdAt: "2026-10-24T10:00:00.000Z",
    },
  ],
  runs: [],
  ...overrides,
});

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TaskScreen taskId="t1" />
    </QueryClientProvider>,
  );
}

describe("TaskScreen", () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it("shows the task, your message and what the run is doing", async () => {
    api.get.mockResolvedValue({ data: { task: task() } });
    renderScreen();

    expect(
      await screen.findByRole("heading", { name: "Add a /health endpoint" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "dodesk" })).toHaveAttribute(
      "href",
      "/projects/p1",
    );
    expect(
      screen.getByText("Add a /health endpoint that returns the version."),
    ).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("Working on the change…")).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/tasks/t1");
  });

  it("says when the task doesn't exist", async () => {
    api.get.mockRejectedValue(
      new ApiError(404, "Task not found.", "TASK_NOT_FOUND"),
    );
    renderScreen();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This task doesn't exist or isn't yours.",
    );
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("offers to try again when it doesn't load", async () => {
    api.get
      .mockRejectedValueOnce(new ApiError(500, "Down."))
      .mockResolvedValue({ data: { task: task() } });
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "Add a /health endpoint" }),
    ).toBeInTheDocument();
  });
});
