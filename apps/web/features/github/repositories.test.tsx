import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { useRepositories } from "./repositories";

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));

describe("useRepositories", () => {
  it("waits for an installation before asking", async () => {
    api.get.mockResolvedValue({ data: { repositories: [] } });
    const client = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    const { result, rerender } = renderHook(
      ({ id }: { id?: number }) => useRepositories(id),
      { wrapper, initialProps: {} },
    );

    expect(result.current.fetchStatus).toBe("idle");
    expect(api.get).not.toHaveBeenCalled();

    rerender({ id: 42 });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(api.get).toHaveBeenCalledWith(
      "/github/installations/42/repositories",
    );
  });
});
