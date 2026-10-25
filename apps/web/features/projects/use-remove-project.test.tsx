import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  removeProjectErrorMessage,
  useRemoveProject,
} from "./use-remove-project";

const api = vi.hoisted(() => ({ delete: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));

function renderRemove() {
  const client = new QueryClient();
  client.setQueryData(["projects"], []);
  client.setQueryData(["projects", "p1", "environments"], []);
  client.setQueryData(["projects", "p2", "environments"], []);
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useRemoveProject(), { wrapper });
  return { result, client, invalidate };
}

describe("useRemoveProject", () => {
  beforeEach(() => {
    api.delete.mockReset().mockResolvedValue({ data: { id: "p1" } });
  });

  it("removes the project, forgets its data and refreshes projects and tasks", async () => {
    const { result, client, invalidate } = renderRemove();

    await act(() => result.current.mutateAsync("p1"));

    expect(api.delete).toHaveBeenCalledWith("/projects/p1");
    expect(client.getQueryData(["projects", "p1", "environments"])).toBe(
      undefined,
    );
    expect(client.getQueryData(["projects", "p2", "environments"])).toEqual([]);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects"] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["tasks"] });
  });

  it("keeps everything when it fails", async () => {
    api.delete.mockRejectedValue(new Error("down"));
    const { result, client, invalidate } = renderRemove();

    await act(() => result.current.mutateAsync("p1").catch(() => {}));

    expect(client.getQueryData(["projects", "p1", "environments"])).toEqual([]);
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("removeProjectErrorMessage", () => {
  it("says a task is still running when the project is busy", () => {
    expect(
      removeProjectErrorMessage(new ApiError(409, "Busy.", "PROJECT_BUSY")),
    ).toBe(
      "A task is still running in this project. Wait for it to finish, or cancel it, then remove the project.",
    );
  });

  it("asks to try again otherwise", () => {
    expect(removeProjectErrorMessage(new Error("down"))).toBe(
      "Couldn't remove the project. Try again.",
    );
  });
});
