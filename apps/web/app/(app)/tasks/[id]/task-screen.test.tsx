import type { RunResponse, TaskDetail } from "@hobai/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { TaskScreen } from "./task-screen";

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/client", async (original) => ({
  ...(await original<typeof import("@/lib/api/client")>()),
  api,
}));
vi.mock("@/features/account/use-account", () => ({
  useAccount: () => ({
    account: { name: "Ada Lovelace", email: "ada@example.com", image: null },
  }),
}));

class FakeEventSource {
  static last: FakeEventSource | undefined;
  onmessage: ((message: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(readonly url: string) {
    FakeEventSource.last = this;
  }
  close() {}
  send(...events: Record<string, unknown>[]) {
    act(() => {
      for (const event of events) {
        this.onmessage?.({
          data: JSON.stringify({
            runId: "r1",
            ts: "2026-10-24T10:00:00.000Z",
            ...event,
          }),
        } as MessageEvent<string>);
      }
    });
  }
}

const runRecord = (overrides: Partial<RunResponse> = {}): RunResponse => ({
  id: "r1",
  taskId: "t1",
  trigger: "initial",
  status: "running",
  stage: "agent",
  model: "m",
  summary: null,
  checksPassed: null,
  commitSha: null,
  error: null,
  steps: 0,
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
  queuedAt: "2026-10-24T10:00:00.000Z",
  startedAt: "2026-10-24T10:00:00.000Z",
  finishedAt: null,
  durationMs: null,
  changes: null,
  ...overrides,
});

const task = (overrides: Partial<TaskDetail> = {}): TaskDetail => ({
  id: "t1",
  title: "Add a /health endpoint",
  project: { id: "p1", owner: "ada", name: "dodesk" },
  label: "working",
  baseBranch: "main",
  branchName: null,
  pullRequest: null,
  latestRun: {
    id: "r1",
    status: "running",
    stage: "agent",
    error: null,
    checksPassed: null,
    filesChanged: null,
    summaryLine: null,
  },
  runCount: 1,
  durationMs: 0,
  costUsd: 0,
  createdAt: "2026-10-24T10:00:00.000Z",
  updatedAt: "2026-10-24T10:00:00.000Z",
  messages: [
    {
      id: "m1",
      role: "user",
      authorUserId: "u1",
      runId: null,
      content: "Add a /health endpoint that returns the version.",
      createdAt: "2026-10-24T10:00:00.000Z",
    },
  ],
  runs: [runRecord()],
  ...overrides,
});

function renderScreen() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <TaskScreen taskId="t1" />
    </QueryClientProvider>,
  );
}

describe("TaskScreen", () => {
  beforeEach(() => {
    api.get.mockReset();
    api.post.mockReset();
    FakeEventSource.last = undefined;
    vi.stubGlobal("EventSource", FakeEventSource);
    // jsdom doesn't scroll; the page follows a run to its result.
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("shows the task, your message and the run as it happens", async () => {
    api.get.mockResolvedValue({ data: { task: task() } });
    renderScreen();

    expect(
      await screen.findByRole("heading", { name: "Add a /health endpoint" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "dodesk" })).toHaveAttribute(
      "href",
      "/projects/p1",
    );
    expect(
      screen.getByText("Add a /health endpoint that returns the version."),
    ).toBeInTheDocument();
    expect(FakeEventSource.last?.url).toBe("/api/runs/r1/events");

    FakeEventSource.last!.send(
      { type: "stage_changed", seq: 1, stage: "prepare" },
      { type: "stage_changed", seq: 2, stage: "setup" },
      {
        type: "setup_completed",
        seq: 3,
        success: true,
        steps: [],
        checks: [{ name: "test", cwd: ".", status: "passing" }],
      },
      { type: "stage_changed", seq: 4, stage: "agent" },
      {
        type: "tool_start",
        seq: 5,
        toolCallId: "t1",
        toolName: "read_file",
        input: { path: "src/app.ts" },
      },
      { type: "text_delta", delta: "Adding the route next" },
      { type: "agent_step", steps: 3, costUsd: 0.02 },
    );

    const card = screen.getByRole("article", { name: "Run 1" });
    expect(
      within(card).getByRole("region", { name: "Prepare" }),
    ).toHaveTextContent("Sandbox ready, cloned main");
    expect(
      within(card).getByRole("region", { name: "Set up" }),
    ).toHaveTextContent("before: 1 of 1 check passing");
    const working = within(card).getByRole("region", { name: "Working" });
    expect(working).toHaveTextContent("3 steps");
    expect(working).toHaveTextContent("Explored the code · read 1 file");
    expect(working).toHaveTextContent("Adding the route next");
    expect(card).toHaveTextContent("step 3 · $0.02");
  });

  it("opens a command from the run card in the Terminal", async () => {
    api.get.mockResolvedValue({ data: { task: task() } });
    renderScreen();
    await screen.findByRole("heading", { name: "Add a /health endpoint" });

    FakeEventSource.last!.send(
      { type: "stage_changed", seq: 1, stage: "agent" },
      {
        type: "tool_start",
        seq: 2,
        toolCallId: "c1",
        toolName: "bash",
        input: { command: "pnpm test" },
      },
      {
        type: "tool_end",
        seq: 3,
        toolCallId: "c1",
        toolName: "bash",
        output: "Exit code: 1\n1 failed",
      },
    );
    fireEvent.click(screen.getByRole("button", { name: /Ran pnpm test/ }));

    expect(screen.getByRole("tab", { name: "Terminal" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("figure", { name: "Command: pnpm test" }),
    ).toHaveTextContent("1 failed");
  });

  it("shows the saved diff once the run has ended", async () => {
    api.get.mockImplementation(async (url: string) =>
      url === "/runs/r1/diff"
        ? {
            data: {
              diff: {
                patch:
                  "diff --git a/src/a.ts b/src/a.ts\n@@ -0,0 +1 @@\n+export const a = 1;\n",
                files: [{ path: "src/a.ts", added: 1, removed: 0 }],
                truncated: false,
              },
            },
          }
        : {
            data: {
              task: task({
                label: "no_changes",
                runs: [runRecord({ status: "succeeded", summary: "Done." })],
              }),
            },
          },
    );
    renderScreen();

    expect(
      await screen.findByRole("figure", { name: "Changes to src/a.ts" }),
    ).toHaveTextContent("export const a = 1;");
  });

  it("takes the task's short title from the run", async () => {
    api.get.mockResolvedValue({ data: { task: task() } });
    renderScreen();
    await screen.findByRole("heading", { name: "Add a /health endpoint" });

    FakeEventSource.last!.send({
      type: "task_titled",
      seq: 1,
      title: "Add a health check",
    });
    expect(
      screen.getByRole("heading", { name: "Add a health check" }),
    ).toBeInTheDocument();
  });

  it("waits for a sandbox while the run is queued", async () => {
    api.get.mockResolvedValue({
      data: {
        task: task({
          label: "queued",
          runs: [runRecord({ status: "queued", stage: null, startedAt: null })],
        }),
      },
    });
    renderScreen();

    expect(
      await screen.findByRole("region", { name: "Prepare" }),
    ).toHaveTextContent("Waiting for a sandbox");
    expect(screen.getByRole("region", { name: "Working" })).toHaveTextContent(
      "the agent makes the change",
    );
  });

  it("ends with the summary and the pull request", async () => {
    api.get.mockResolvedValue({
      data: {
        task: task({
          label: "pr_open",
          pullRequest: {
            number: 7,
            url: "https://github.com/x/y/pull/7",
            draft: false,
          },
          runs: [
            runRecord({
              status: "succeeded",
              summary: "Added GET /health.",
              durationMs: 92_000,
              costUsd: 0.04,
            }),
          ],
        }),
      },
    });
    renderScreen();

    const result = await screen.findByRole("article", {
      name: "Result of run 1",
    });
    expect(within(result).getByText("Added GET /health.")).toBeInTheDocument();
    expect(
      within(result).getByRole("link", { name: "Open PR #7 on GitHub" }),
    ).toHaveAttribute("href", "https://github.com/x/y/pull/7");
    expect(
      screen
        .getByRole("heading", { name: "Add a /health endpoint" })
        .closest("header"),
    ).toHaveTextContent("1m 32s · $0.04");
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
  });

  it("folds the steps of a run that ended before you opened it", async () => {
    api.get.mockResolvedValue({
      data: {
        task: task({
          label: "no_changes",
          runs: [runRecord({ status: "succeeded", durationMs: 60_000 })],
        }),
      },
    });
    renderScreen();

    const card = await screen.findByRole("article", { name: "Run 1" });
    expect(card).toHaveTextContent("No changes needed");
    expect(within(card).queryByRole("region", { name: "Prepare" })).toBeNull();

    fireEvent.click(within(card).getByRole("button", { name: "Show steps" }));
    expect(
      within(card).getByRole("region", { name: "Prepare" }),
    ).toBeInTheDocument();
  });

  it("keeps a failed run's steps open", async () => {
    api.get.mockResolvedValue({
      data: {
        task: task({
          label: "failed",
          runs: [
            runRecord({
              status: "failed",
              error: { code: "agent_failed", message: "The model gave up." },
            }),
          ],
        }),
      },
    });
    renderScreen();

    const card = await screen.findByRole("article", { name: "Run 1" });
    expect(
      within(card).getByRole("button", { name: "Hide steps" }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("region", { name: "Prepare" }),
    ).toBeInTheDocument();
  });

  it("leaves a run you watched open when it ends", async () => {
    api.get
      .mockResolvedValueOnce({ data: { task: task() } })
      .mockResolvedValue({
        data: {
          task: task({
            label: "no_changes",
            runs: [runRecord({ status: "succeeded", durationMs: 60_000 })],
          }),
        },
      });
    renderScreen();
    await screen.findByRole("article", { name: "Run 1" });

    FakeEventSource.last!.send({ type: "done", seq: 1, status: "succeeded" });

    await screen.findByRole("article", { name: "Result of run 1" });
    const card = screen.getByRole("article", { name: "Run 1" });
    expect(card).toHaveTextContent("No changes needed");
    expect(
      within(card).getByRole("button", { name: "Hide steps" }),
    ).toBeInTheDocument();
    expect(
      within(card).getByRole("region", { name: "Prepare" }),
    ).toBeInTheDocument();
  });

  it("says where a failed run went wrong, with a way to fix it", async () => {
    api.get.mockResolvedValue({
      data: {
        task: task({
          label: "failed",
          runs: [
            runRecord({
              status: "failed",
              stage: "setup",
              error: { code: "setup_failed", message: "pnpm install failed." },
              durationMs: 60_000,
            }),
          ],
        }),
      },
    });
    renderScreen();

    const result = await screen.findByRole("article", {
      name: "Result of run 1",
    });
    expect(within(result).getByRole("alert")).toHaveTextContent(
      "Failed during setuppnpm install failed.Nothing was pushed.",
    );
    expect(
      within(result).getByRole("link", { name: "Re-run environment setup" }),
    ).toHaveAttribute("href", "/projects/p1/environment");
  });

  it("says when you cancelled the run", async () => {
    api.get.mockResolvedValue({
      data: {
        task: task({
          label: "cancelled",
          runs: [runRecord({ status: "cancelled", durationMs: 182_000 })],
        }),
      },
    });
    renderScreen();

    expect(
      await screen.findByRole("article", { name: "Result of run 1" }),
    ).toHaveTextContent(
      "You cancelled this run after 3m 02s.The sandbox was removed and nothing was pushed.",
    );
  });

  it("cancels a queued run at once", async () => {
    const queued = runRecord({
      status: "queued",
      stage: null,
      startedAt: null,
    });
    api.get
      .mockResolvedValueOnce({
        data: { task: task({ label: "queued", runs: [queued] }) },
      })
      .mockResolvedValue({
        data: {
          task: task({
            label: "cancelled",
            runs: [{ ...queued, status: "cancelled" }],
          }),
        },
      });
    api.post.mockResolvedValue({ data: { outcome: "cancelled" } });
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull(),
    );
    expect(api.post).toHaveBeenCalledWith("/runs/r1/cancel");
  });

  it("says it's stopping a working run until the run ends", async () => {
    api.get.mockResolvedValue({ data: { task: task() } });
    api.post.mockResolvedValue({ data: { outcome: "stopping" } });
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(
      await screen.findByRole("button", { name: "Stopping…" }),
    ).toBeDisabled();
  });

  it("says when it couldn't cancel, and lets you try again", async () => {
    api.get.mockResolvedValue({ data: { task: task() } });
    api.post.mockRejectedValue(new ApiError(500, "Down."));
    renderScreen();

    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't cancel. Try again.",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("says when the task doesn't exist", async () => {
    api.get.mockRejectedValue(
      new ApiError(404, "Task not found.", "TASK_NOT_FOUND"),
    );
    renderScreen();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This task doesn't exist or isn't yours.",
    );
    expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();
  });

  it("offers to try again when it doesn't load", async () => {
    api.get
      .mockRejectedValueOnce(new ApiError(500, "Down."))
      .mockResolvedValue({ data: { task: task() } });
    renderScreen();
    fireEvent.click(await screen.findByRole("button", { name: "Try again" }));
    expect(
      await screen.findByRole("heading", { name: "Add a /health endpoint" }),
    ).toBeInTheDocument();
  });
});
