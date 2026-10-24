import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { taskKey, tasksKey } from "@/features/tasks/api";
import { ApiError } from "@/lib/api/client";
import { useCancelRun } from "./use-cancel-run";

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(taskKey("t1"), {});
  client.setQueryData(tasksKey(), { tasks: [], nextCursor: null });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useCancelRun("t1"), { wrapper });
  const refreshed = () =>
    client.getQueryState(taskKey("t1"))?.isInvalidated === true &&
    client.getQueryState(tasksKey())?.isInvalidated === true;
  return { result, refreshed };
}

describe("useCancelRun", () => {
  beforeEach(() => {
    api.post.mockReset();
  });

  it("refreshes the task when the run is cancelled at once", async () => {
    api.post.mockResolvedValue({ data: { outcome: "cancelled" } });
    const { result, refreshed } = setup();

    act(() => result.current.cancel("r1"));

    await waitFor(() => expect(refreshed()).toBe(true));
    expect(api.post).toHaveBeenCalledWith("/runs/r1/cancel");
    expect(result.current.stopping).toBe(false);
  });

  it("says it's stopping a working run, leaving the refresh to its events", async () => {
    api.post.mockResolvedValue({ data: { outcome: "stopping" } });
    const { result, refreshed } = setup();

    act(() => result.current.cancel("r1"));

    await waitFor(() => expect(result.current.stopping).toBe(true));
    expect(refreshed()).toBe(false);
  });

  it("refreshes without an error when the run had already ended", async () => {
    api.post.mockRejectedValue(
      new ApiError(409, "This run has already ended.", "RUN_ENDED"),
    );
    const { result, refreshed } = setup();

    act(() => result.current.cancel("r1"));

    await waitFor(() => expect(refreshed()).toBe(true));
    expect(result.current.error).toBeNull();
  });

  it("keeps any other failure", async () => {
    api.post.mockRejectedValue(new ApiError(500, "Down."));
    const { result } = setup();

    act(() => result.current.cancel("r1"));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    expect(result.current.stopping).toBe(false);
  });
});
