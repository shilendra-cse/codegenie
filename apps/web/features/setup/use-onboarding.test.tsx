import type { OnboardingResponse } from "@hobai/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onboardingKey } from "./api";
import {
  isSetupActive,
  useAnswerOnboarding,
  useCancelOnboarding,
  useOnboarding,
  useStartOnboarding,
} from "./use-onboarding";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));

const setup = (
  overrides: Partial<OnboardingResponse> = {},
): OnboardingResponse => ({
  id: "s1",
  status: "queued",
  question: null,
  environmentVersion: null,
  error: null,
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
  queuedAt: "2026-10-23T10:00:00.000Z",
  startedAt: null,
  finishedAt: null,
  durationMs: null,
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

describe("setup hooks", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
  });

  it("reads the latest setup, and nothing before a project is known", async () => {
    api.get.mockResolvedValue({ data: { onboarding: setup() } });
    const { wrapper: Wrapper } = wrapper();
    const { result, rerender } = renderHook(
      ({ id }: { id?: string }) => useOnboarding(id),
      { wrapper: Wrapper, initialProps: {} },
    );
    expect(api.get).not.toHaveBeenCalled();

    rerender({ id: "p1" });
    await waitFor(() => expect(result.current.data).toEqual(setup()));
    expect(api.get).toHaveBeenCalledWith("/projects/p1/onboarding");
  });

  it("starts setup and shows it straight away", async () => {
    api.post.mockResolvedValue({ data: { onboarding: setup() } });
    const { client, wrapper: Wrapper } = wrapper();
    const { result } = renderHook(() => useStartOnboarding("p1"), {
      wrapper: Wrapper,
    });

    await act(() => result.current.mutateAsync());

    expect(api.post).toHaveBeenCalledWith("/projects/p1/onboarding");
    expect(client.getQueryData(onboardingKey("p1"))).toEqual(setup());
  });

  it("answers, and the setup is running again", async () => {
    api.post.mockResolvedValue({ data: { questionId: "q-1" } });
    const { client, wrapper: Wrapper } = wrapper();
    client.setQueryData(
      onboardingKey("p1"),
      setup({
        status: "waiting",
        question: {
          id: "q-1",
          question: "Which?",
          options: [],
          allowOther: true,
        },
      }),
    );
    const { result } = renderHook(() => useAnswerOnboarding("p1"), {
      wrapper: Wrapper,
    });

    await act(() =>
      result.current.mutateAsync({ questionId: "q-1", answer: { option: 0 } }),
    );

    expect(api.post).toHaveBeenCalledWith("/projects/p1/onboarding/answer", {
      questionId: "q-1",
      answer: { option: 0 },
    });
    expect(client.getQueryData(onboardingKey("p1"))).toMatchObject({
      status: "running",
      question: null,
    });
  });

  it("stops a queued setup at once, and leaves a running one to its events", async () => {
    const { client, wrapper: Wrapper } = wrapper();
    client.setQueryData(onboardingKey("p1"), setup());
    const { result } = renderHook(() => useCancelOnboarding("p1"), {
      wrapper: Wrapper,
    });

    api.post.mockResolvedValue({ data: { outcome: "cancelled" } });
    await act(() => result.current.mutateAsync());
    expect(client.getQueryData(onboardingKey("p1"))).toMatchObject({
      status: "cancelled",
    });

    client.setQueryData(onboardingKey("p1"), setup({ status: "running" }));
    api.post.mockResolvedValue({ data: { outcome: "stopping" } });
    await act(() => result.current.mutateAsync());
    expect(client.getQueryData(onboardingKey("p1"))).toMatchObject({
      status: "running",
    });
  });

  it("knows which setups are still going", () => {
    expect(isSetupActive(setup({ status: "waiting" }))).toBe(true);
    expect(isSetupActive(setup({ status: "failed" }))).toBe(false);
    expect(isSetupActive(null)).toBe(false);
  });
});
