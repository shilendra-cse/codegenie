import type { TaskListItem, TaskPage } from "@hobai/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTaskPages } from "./use-task-pages";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));

const item = (id: string, label: TaskListItem["label"] = "pr_open") =>
  ({ id, label }) as TaskListItem;

const page = (
  tasks: TaskListItem[],
  nextCursor: string | null = null,
  running = 0,
): { data: TaskPage } => ({
  data: {
    tasks,
    nextCursor,
    counts: { all: 3, running, pr: 2, done: 1 },
  },
});

function render(options: Parameters<typeof useTaskPages>[0]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useTaskPages(options), { wrapper: Wrapper });
}

describe("useTaskPages", () => {
  beforeEach(() => api.get.mockReset());
  afterEach(() => vi.useRealTimers());

  it("loads a filtered list a page at a time, with the counts", async () => {
    api.get
      .mockResolvedValueOnce(page([item("t1"), item("t2")], "t2"))
      .mockResolvedValueOnce(page([item("t3")]));
    const { result } = render({ projectId: "p1", filter: "pr" });

    await waitFor(() =>
      expect(result.current.tasks?.map((t) => t.id)).toEqual(["t1", "t2"]),
    );
    expect(result.current.counts).toEqual({
      all: 3,
      running: 0,
      pr: 2,
      done: 1,
    });
    expect(result.current.hasMore).toBe(true);
    expect(api.get).toHaveBeenCalledWith("/tasks", {
      params: { projectId: "p1", filter: "pr", cursor: undefined },
    });

    await act(() => result.current.loadMore());

    expect(api.get).toHaveBeenLastCalledWith("/tasks", {
      params: { projectId: "p1", filter: "pr", cursor: "t2" },
    });
    await waitFor(() =>
      expect(result.current.tasks?.map((t) => t.id)).toEqual([
        "t1",
        "t2",
        "t3",
      ]),
    );
    expect(result.current.hasMore).toBe(false);
  });

  it("refreshes while anything runs, and stops once nothing does", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.get
      .mockResolvedValueOnce(page([item("t1")], null, 1))
      .mockResolvedValue(page([item("t1")]));
    const { result } = render({});

    await waitFor(() => expect(result.current.counts?.running).toBe(1));
    await act(() => vi.advanceTimersByTimeAsync(3_000));
    await waitFor(() => expect(result.current.counts?.running).toBe(0));

    await act(() => vi.advanceTimersByTimeAsync(9_000));
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it("asks for nothing when it isn't needed", () => {
    render({ enabled: false });
    expect(api.get).not.toHaveBeenCalled();
  });
});
