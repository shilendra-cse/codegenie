import type { TaskDetail, TaskListItem } from "@codegenie/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { tasksKey } from "./api";
import { useHasTasks, useStartTask, useTask, useTasks } from "./use-tasks";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));

const item = (overrides: Partial<TaskListItem> = {}): TaskListItem => ({
  id: "t1",
  title: "Add a /health endpoint",
  project: { id: "p1", owner: "ada", name: "dodesk" },
  label: "queued",
  baseBranch: "main",
  branchName: null,
  pullRequest: null,
  latestRun: { id: "r1", status: "queued", stage: null, error: null },
  runCount: 1,
  durationMs: 0,
  costUsd: 0,
  createdAt: "2026-10-24T10:00:00.000Z",
  updatedAt: "2026-10-24T10:00:00.000Z",
  ...overrides,
});

const detail = (overrides: Partial<TaskDetail> = {}): TaskDetail => ({
  ...item(),
  messages: [],
  runs: [],
  ...overrides,
});

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper: Wrapper };
}

describe("task hooks", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it("lists your latest tasks, across projects or for one", async () => {
    api.get.mockResolvedValue({ data: { tasks: [item()], nextCursor: null } });
    const { wrapper: Wrapper } = wrapper();

    const all = renderHook(() => useTasks(), { wrapper: Wrapper });
    await waitFor(() => expect(all.result.current.data).toEqual([item()]));
    expect(api.get).toHaveBeenCalledWith("/tasks", { params: {} });

    const one = renderHook(() => useTasks("p1"), { wrapper: Wrapper });
    await waitFor(() => expect(one.result.current.data).toEqual([item()]));
    expect(api.get).toHaveBeenCalledWith("/tasks", {
      params: { projectId: "p1" },
    });
  });

  it("knows whether you have any task", async () => {
    api.get.mockResolvedValue({ data: { tasks: [], nextCursor: null } });
    const { wrapper: Wrapper } = wrapper();
    const { result } = renderHook(() => useHasTasks(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data).toBe(false));
  });

  it("reads a task", async () => {
    api.get.mockResolvedValue({ data: { task: detail() } });
    const { wrapper: Wrapper } = wrapper();
    const { result } = renderHook(() => useTask("t1"), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data).toEqual(detail()));
    expect(api.get).toHaveBeenCalledWith("/tasks/t1");
  });

  it("refreshes the task list while a task runs, and stops once none does", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.get
      .mockResolvedValueOnce({ data: { tasks: [item()], nextCursor: null } })
      .mockResolvedValue({
        data: { tasks: [item({ label: "pr_open" })], nextCursor: null },
      });
    const { wrapper: Wrapper } = wrapper();
    const { result } = renderHook(() => useTasks(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.data?.[0]?.label).toBe("queued"));
    await act(() => vi.advanceTimersByTimeAsync(3_000));
    await waitFor(() =>
      expect(result.current.data?.[0]?.label).toBe("pr_open"),
    );

    await act(() => vi.advanceTimersByTimeAsync(9_000));
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("asks for nothing before the task is known", () => {
    const { wrapper: Wrapper } = wrapper();
    renderHook(() => useTask(undefined), { wrapper: Wrapper });
    expect(api.get).not.toHaveBeenCalled();
  });

  it("starts a task and refreshes the task lists", async () => {
    const created = {
      task: {
        id: "t1",
        projectId: "p1",
        title: "Add a /health endpoint",
        baseBranch: "main",
        createdAt: "2026-10-24T10:00:00.000Z",
      },
      run: { id: "r1", status: "queued", model: "m" },
    };
    api.post.mockResolvedValue({ data: created });
    const { client, wrapper: Wrapper } = wrapper();
    client.setQueryData(tasksKey(), { tasks: [], nextCursor: null });
    const { result } = renderHook(() => useStartTask("p1"), {
      wrapper: Wrapper,
    });

    const started = await act(() =>
      result.current.mutateAsync({
        prompt: "Add a /health endpoint",
        baseBranch: "main",
      }),
    );

    expect(api.post).toHaveBeenCalledWith("/projects/p1/tasks", {
      prompt: "Add a /health endpoint",
      baseBranch: "main",
    });
    expect(started).toEqual(created);
    expect(client.getQueryState(tasksKey())?.isInvalidated).toBe(true);
  });
});
