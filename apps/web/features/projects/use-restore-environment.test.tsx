import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import {
  restoreErrorMessage,
  useRestoreEnvironment,
} from "./use-restore-environment";

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));

function renderRestore() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(() => useRestoreEnvironment("p1"), {
    wrapper,
  });
  return { result, invalidate };
}

describe("useRestoreEnvironment", () => {
  beforeEach(() => {
    api.post
      .mockReset()
      .mockResolvedValue({ data: { environment: { version: 1 } } });
  });

  it("restores the version, then refreshes the project and its environments", async () => {
    const { result, invalidate } = renderRestore();

    await act(() => result.current.mutateAsync(1));

    expect(api.post).toHaveBeenCalledWith(
      "/projects/p1/environments/1/restore",
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["projects"] });
  });

  it("refreshes nothing when it fails", async () => {
    api.post.mockRejectedValue(new Error("down"));
    const { result, invalidate } = renderRestore();

    await act(() => result.current.mutateAsync(1).catch(() => {}));

    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe("restoreErrorMessage", () => {
  it("asks to finish the setup first while one is in progress", () => {
    expect(
      restoreErrorMessage(
        new ApiError(
          409,
          "Finish or stop the setup first.",
          "SETUP_IN_PROGRESS",
        ),
        1,
      ),
    ).toBe("Finish or stop the setup first.");
  });

  it("asks to try again otherwise", () => {
    expect(restoreErrorMessage(new Error("down"), 1)).toBe(
      "Couldn't restore v1. Try again.",
    );
  });
});
