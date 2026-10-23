import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRepositories } from "@/features/github/repositories";
import { useProjects } from "./projects";
import { useCreateProject } from "./create-project";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));

const calls = (url: string) =>
  api.get.mock.calls.filter(([called]) => called === url).length;

function renderHooks() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(
    () => ({
      projects: useProjects(),
      reposHere: useRepositories(42),
      reposElsewhere: useRepositories(7),
      create: useCreateProject(),
    }),
    { wrapper },
  );
}

describe("useCreateProject", () => {
  beforeEach(() => {
    api.get.mockReset().mockImplementation(async (url: string) => ({
      data: url === "/projects" ? { projects: [] } : { repositories: [] },
    }));
    api.post.mockReset().mockResolvedValue({ data: { project: { id: "p1" } } });
  });

  it("adds the repository, then refreshes the projects and that installation's repositories", async () => {
    const { result } = renderHooks();
    await waitFor(() =>
      expect(result.current.reposElsewhere.isSuccess).toBe(true),
    );

    await act(() =>
      result.current.create.mutateAsync({ installationId: 42, repoId: 1001 }),
    );

    expect(api.post).toHaveBeenCalledWith("/projects", {
      installationId: 42,
      repoId: 1001,
    });
    await waitFor(() => expect(calls("/projects")).toBe(2));
    expect(calls("/github/installations/42/repositories")).toBe(2);
    expect(calls("/github/installations/7/repositories")).toBe(1);
  });
});
