import type { OnboardingResponse, ProjectResponse } from "@codegenie/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useSetupsNeedingYou } from "./use-setups-needing-you";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));

const project = (
  id: string,
  setup: ProjectResponse["setup"],
): ProjectResponse => ({
  id,
  repo: { githubId: 1, owner: "ada", name: id },
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
  createdAt: "2026-10-23T08:00:00.000Z",
});

const onboarding = {
  id: "o1",
  status: "waiting",
  costUsd: 0.02,
} as OnboardingResponse;

function render() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useSetupsNeedingYou(), { wrapper: Wrapper });
}

describe("useSetupsNeedingYou", () => {
  beforeEach(() => api.get.mockReset());

  it("loads only the setups waiting for an answer, each with its project", async () => {
    const waiting = project("dodesk", { id: "o1", status: "waiting" });
    api.get.mockImplementation((url: string) =>
      Promise.resolve({
        data:
          url === "/projects"
            ? {
                projects: [
                  waiting,
                  project("api", { id: "o2", status: "running" }),
                  project("web", null),
                ],
              }
            : { onboarding },
      }),
    );
    const { result } = render();

    await waitFor(() =>
      expect(result.current).toEqual([{ project: waiting, onboarding }]),
    );
    expect(api.get.mock.calls.map(([url]) => url)).toEqual([
      "/projects",
      "/projects/dodesk/onboarding",
    ]);
  });

  it("is empty when nothing is waiting", async () => {
    api.get.mockResolvedValue({
      data: { projects: [project("web", { id: "o3", status: "succeeded" })] },
    });
    const { result } = render();

    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(1));
    expect(result.current).toEqual([]);
  });
});
