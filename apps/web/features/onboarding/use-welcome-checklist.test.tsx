import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { useWelcomeChecklist } from "./use-welcome-checklist";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));

const responses: Record<string, unknown> = {
  "/github/installations": {
    installations: [{ id: 1, accountLogin: "ada", accountType: "user" }],
    installUrl: "https://github.com/apps/hobai/installations/new",
  },
  "/projects": { projects: [] },
  "/tasks": { tasks: [], nextCursor: null },
};

function renderChecklist() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useWelcomeChecklist(), { wrapper });
}

describe("useWelcomeChecklist", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.get.mockImplementation(async (url: string) => ({
      data: responses[url],
    }));
  });

  it("is pending until every answer is in, then lists the steps", async () => {
    const { result } = renderChecklist();
    expect(result.current.status).toBe("pending");

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(result.current.steps?.map((step) => step.state)).toEqual([
      "done",
      "current",
      "todo",
      "todo",
    ]);
  });

  it("reports an error, and tries the failed request again", async () => {
    api.get.mockImplementation(async (url: string) => {
      if (url === "/projects") throw new ApiError(500, "Something went wrong.");
      return { data: responses[url] };
    });
    const { result } = renderChecklist();
    await waitFor(() => expect(result.current.status).toBe("error"));

    api.get.mockImplementation(async (url: string) => ({
      data: responses[url],
    }));
    result.current.retry();

    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(
      api.get.mock.calls.filter(([url]) => url === "/github/installations"),
    ).toHaveLength(1);
  });
});
