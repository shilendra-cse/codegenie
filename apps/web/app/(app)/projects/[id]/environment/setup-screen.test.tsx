import type { OnboardingEvent, OnboardingResponse } from "@codegenie/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { SetupScreen } from "./setup-screen";

const state = vi.hoisted(() => ({
  onboarding: undefined as unknown,
  error: null as unknown,
  events: [] as unknown[],
  environments: [] as unknown[],
  start: vi.fn(),
  answer: vi.fn(),
  stop: vi.fn(),
}));

vi.mock("@/features/setup/use-onboarding", async (original) => ({
  ...(await original<typeof import("@/features/setup/use-onboarding")>()),
  useOnboarding: () => ({
    data: state.onboarding,
    error: state.error,
    isPending: state.onboarding === undefined && !state.error,
    isError: Boolean(state.error),
  }),
  useEnvironments: () => ({ data: state.environments }),
  useStartOnboarding: () => ({
    mutate: state.start,
    isPending: false,
    error: null,
  }),
  useAnswerOnboarding: () => ({
    mutate: state.answer,
    isPending: false,
    error: null,
  }),
  useCancelOnboarding: () => ({
    mutate: state.stop,
    isPending: false,
    error: null,
  }),
}));
vi.mock("@/features/setup/use-onboarding-events", () => ({
  useOnboardingEvents: () => state.events,
}));
vi.mock("@/features/projects/projects", () => ({
  useProject: () => ({ project: { id: "p1", repo: { name: "dodesk" } } }),
}));
vi.mock("@/features/account/use-account", () => ({
  useAccount: () => ({
    account: { name: "Ada Lovelace", email: "", image: null },
  }),
}));

const setup = (
  overrides: Partial<OnboardingResponse> = {},
): OnboardingResponse => ({
  id: "s1",
  status: "running",
  question: null,
  environmentVersion: null,
  error: null,
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
  queuedAt: "2026-10-24T10:00:00.000Z",
  startedAt: "2026-10-24T10:00:00.000Z",
  finishedAt: null,
  durationMs: null,
  ...overrides,
});

const event = (seq: number, body: Record<string, unknown>) =>
  ({
    onboardingId: "s1",
    seq,
    ts: `2026-10-24T10:00:${String(seq).padStart(2, "0")}.000Z`,
    ...body,
  }) as OnboardingEvent;

function show() {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  render(<SetupScreen projectId="p1" />, { wrapper });
  return invalidate;
}

describe("SetupScreen", () => {
  beforeEach(() => {
    state.onboarding = undefined;
    state.error = null;
    state.events = [];
    state.environments = [];
    state.start.mockReset();
    state.answer.mockReset();
    state.stop.mockReset();
  });

  it("offers to start setup before the first one", () => {
    state.onboarding = null;
    show();

    fireEvent.click(screen.getByRole("button", { name: "Start setup" }));
    expect(state.start).toHaveBeenCalledOnce();
  });

  it("shows setup working, live, and stops it", () => {
    state.onboarding = setup();
    state.events = [
      event(1, {
        type: "setup_drafted",
        projects: [{ cwd: ".", packageManager: "npm" }],
      }),
      event(2, {
        type: "info",
        message: "Installing dependencies and running checks…",
      }),
    ];
    show();

    expect(screen.getByText("Setting up")).toBeInTheDocument();
    expect(screen.getByText("Found 1 project")).toBeInTheDocument();
    expect(
      screen.getByText("Installing dependencies and running checks"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Stop setup" }));
    expect(state.stop).toHaveBeenCalledOnce();
  });

  it("asks its question and sends your answer", () => {
    state.onboarding = setup({ status: "waiting" });
    state.events = [
      event(1, {
        type: "question_asked",
        questionId: "q-1",
        question: "Which tests?",
        options: [{ label: "Skip them" }, { label: "Keep them" }],
        allowOther: true,
      }),
    ];
    show();

    expect(screen.getByText("Waiting for your answer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    expect(state.answer).toHaveBeenCalledWith(
      { questionId: "q-1", answer: { option: 0 } },
      expect.anything(),
    );
  });

  it("refreshes the setup when the question was no longer open", () => {
    state.onboarding = setup({ status: "waiting" });
    state.events = [
      event(1, {
        type: "question_asked",
        questionId: "q-1",
        question: "Which tests?",
        options: [{ label: "Skip them" }],
        allowOther: false,
      }),
    ];
    state.answer.mockImplementation(
      (_input: unknown, options: { onError: (error: unknown) => void }) =>
        options.onError(new ApiError(409, "Gone.", "QUESTION_NOT_OPEN")),
    );
    const invalidate = show();

    fireEvent.click(screen.getByRole("button", { name: "Answer" }));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ["projects", "p1", "onboarding"],
    });
  });

  it("says why setup failed, and offers to try again", () => {
    state.onboarding = setup({
      status: "failed",
      error: {
        code: "NO_ANSWER",
        message: "Setup stopped after waiting 30 minutes for an answer.",
      },
    });
    show();

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("waiting 30 minutes");
    expect(screen.queryByRole("button", { name: "Stop setup" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.start).toHaveBeenCalledOnce();
  });

  it("shows the saved environment", () => {
    state.onboarding = setup({
      status: "succeeded",
      environmentVersion: 1,
      durationMs: 425_000,
      costUsd: 0.06,
    });
    state.environments = [
      {
        version: 1,
        active: true,
        source: "detected",
        savedAt: "",
        health: "ok",
        healthReasons: [],
        steps: [{ name: "install", cwd: ".", command: "npm ci" }],
        checks: [],
        decisions: [],
      },
    ];
    show();

    expect(screen.getByText("Saved as v1")).toBeInTheDocument();
    expect(screen.getByText("7m 05s · $0.06")).toBeInTheDocument();
    expect(screen.getByText("Saved. dodesk is ready.")).toBeInTheDocument();
  });
});
