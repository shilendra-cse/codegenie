import type {
  EnvironmentResponse,
  OnboardingResponse,
} from "@codegenie/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { EnvironmentScreen } from "./environment-screen";

const state = vi.hoisted(() => ({
  onboarding: undefined as unknown,
  environments: undefined as unknown,
  failed: false,
  refetch: vi.fn(),
  start: vi.fn(),
}));

const api = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));
vi.mock("@/features/setup/use-onboarding", async (original) => ({
  ...(await original<typeof import("@/features/setup/use-onboarding")>()),
  useOnboarding: () => ({
    data: state.onboarding,
    isPending: state.onboarding === undefined && !state.failed,
    isError: state.failed,
    refetch: state.refetch,
  }),
  useEnvironments: () => ({
    data: state.environments,
    isPending: state.environments === undefined && !state.failed,
    isError: state.failed,
    refetch: state.refetch,
  }),
  useStartOnboarding: () => ({
    mutate: state.start,
    isPending: false,
    error: null,
  }),
}));
vi.mock("./setup-screen", () => ({
  SetupScreen: () => <p>The setup conversation</p>,
}));

const setup = (
  status: OnboardingResponse["status"],
  error: OnboardingResponse["error"] = null,
) => ({ id: "s1", status, error }) as OnboardingResponse;

const environment = (
  version: number,
  active: boolean,
): EnvironmentResponse => ({
  version,
  active,
  source: "ai",
  savedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
  health: "ok",
  healthReasons: [],
  steps: [{ name: "install", cwd: ".", command: "pnpm install" }],
  checks: [{ name: "test", cwd: "backend", command: "pnpm test" }],
  decisions: [],
});

function wrapper({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={new QueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

const show = (view?: string) =>
  render(<EnvironmentScreen projectId="p1" view={view} />, { wrapper });

const askToRestore = () => {
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  fireEvent.click(screen.getByRole("button", { name: "Restore v1" }));
};

describe("EnvironmentScreen", () => {
  beforeEach(() => {
    state.onboarding = setup("succeeded");
    state.environments = [environment(2, true), environment(1, false)];
    state.failed = false;
    state.refetch.mockReset();
    state.start.mockReset();
    api.post
      .mockReset()
      .mockResolvedValue({ data: { environment: environment(1, true) } });
  });

  it("shows the active environment", () => {
    show();

    expect(screen.getByRole("heading", { name: "Environment" })).toBeVisible();
    expect(screen.getByText("v2 · active")).toBeVisible();
    expect(screen.getByText("pnpm test")).toBeVisible();
    expect(screen.queryByText("The setup conversation")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each(["queued", "running", "waiting"] as const)(
    "shows the conversation while a setup is %s",
    (status) => {
      state.onboarding = setup(status);
      show();

      expect(screen.getByText("The setup conversation")).toBeVisible();
    },
  );

  it("shows the conversation before any environment is saved", () => {
    state.onboarding = null;
    state.environments = [];
    show();

    expect(screen.getByText("The setup conversation")).toBeVisible();
  });

  it("stays on the setup you watched finish", () => {
    state.onboarding = setup("running");
    const { rerender } = show();
    state.onboarding = setup("succeeded");
    rerender(<EnvironmentScreen projectId="p1" />);

    expect(screen.getByText("The setup conversation")).toBeVisible();
  });

  it("says the last setup didn't finish and links to it", () => {
    state.onboarding = setup("failed", {
      code: "CHECKS_FAILED",
      message: "It failed while running the checks.",
    });
    show();

    expect(screen.getByRole("status")).toHaveTextContent(
      "The last setup didn't finish: It failed while running the checks. New tasks still use v2.",
    );
    expect(screen.getByRole("link", { name: "View it" })).toHaveAttribute(
      "href",
      "/projects/p1/environment?view=setup",
    );
  });

  it("says when you stopped the last setup", () => {
    state.onboarding = setup("cancelled");
    show();

    expect(screen.getByRole("status")).toHaveTextContent(
      "The last setup didn't finish: you stopped it.",
    );
  });

  it("opens the conversation from View it", () => {
    state.onboarding = setup("failed");
    show("setup");

    expect(screen.getByText("The setup conversation")).toBeVisible();
  });

  it("re-runs setup", () => {
    show();

    fireEvent.click(screen.getByRole("button", { name: "Re-run setup" }));
    expect(state.start).toHaveBeenCalledOnce();
  });

  it("shows placeholders while loading", () => {
    state.environments = undefined;
    const { container } = show();

    expect(container.querySelector("[aria-busy]")).not.toBeNull();
  });

  it("offers to try again when it couldn't load", () => {
    state.failed = true;
    show();

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Couldn't load the environment",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.refetch).toHaveBeenCalledTimes(2);
  });

  it("lists every version, newest first, with how it was made", () => {
    show();

    const versions = within(screen.getByRole("region", { name: "Versions" }));
    expect(versions.getByText("v2").nextSibling).toHaveTextContent("active");
    expect(versions.getByText("v1").nextSibling).toHaveTextContent("replaced");
    expect(versions.getAllByText(/Set up by CodeGenie/)).toHaveLength(2);
    expect(versions.getAllByRole("button", { name: "Restore" })).toHaveLength(
      1,
    );
  });

  it("restores an older version once you confirm", async () => {
    show();

    askToRestore();

    await waitFor(() =>
      expect(screen.queryByRole("group", { name: "Restore v1" })).toBeNull(),
    );
    expect(api.post).toHaveBeenCalledWith(
      "/projects/p1/environments/1/restore",
    );
  });

  it("refuses while a setup is in progress", async () => {
    api.post.mockRejectedValue(
      new ApiError(409, "Finish or stop the setup first.", "SETUP_IN_PROGRESS"),
    );
    show();

    askToRestore();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Finish or stop the setup first.",
    );
  });

  it("asks to try again when restoring fails", async () => {
    api.post.mockRejectedValue(new Error("down"));
    show();

    askToRestore();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't restore v1. Try again.",
    );
  });
});
