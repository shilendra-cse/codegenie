import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useRunEvents } from "./use-run-events";

class FakeEventSource {
  static last: FakeEventSource;
  onmessage: ((message: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(
    readonly url: string,
    readonly init?: EventSourceInit,
  ) {
    FakeEventSource.last = this;
  }
  close() {
    this.closed = true;
  }
  send(event: Record<string, unknown>) {
    act(() =>
      this.onmessage?.({
        data: JSON.stringify({ runId: "r1", ts: "", ...event }),
      } as MessageEvent<string>),
    );
  }
}

type Run = { id: string; taskId: string; ended: boolean };

function render(run: Run | undefined) {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook((props: { run?: Run }) => useRunEvents(props.run), {
    wrapper,
    initialProps: { run },
  });
  const refreshed = () =>
    invalidate.mock.calls.map(([filters]) => filters?.queryKey);
  return { ...view, refreshed };
}

const running = { id: "r1", taskId: "t1", ended: false };

describe("useRunEvents", () => {
  beforeEach(() => vi.stubGlobal("EventSource", FakeEventSource));
  afterEach(() => vi.unstubAllGlobals());

  it("follows the run's stream, in order and without repeats", () => {
    const { result } = render(running);
    const source = FakeEventSource.last;
    expect(source.url).toBe("/api/runs/r1/events");
    expect(source.init).toEqual({ withCredentials: true });

    source.send({ type: "stage_changed", seq: 1, stage: "prepare" });
    source.send({ type: "stage_changed", seq: 1, stage: "prepare" });
    source.send({ type: "sandbox_created", seq: 2, sandboxId: "sb" });
    source.send({
      type: "stage_changed",
      seq: 3,
      stage: "checkout",
      runId: "other",
    });

    expect(result.current.events.map((e) => e.seq)).toEqual([1, 2]);
  });

  it("keeps the reasoning and the step count apart, starting the reasoning again at each tool call", () => {
    const { result } = render(running);
    const source = FakeEventSource.last;

    source.send({ type: "text_delta", delta: "Reading the " });
    source.send({ type: "text_delta", delta: "routes" });
    source.send({ type: "agent_step", steps: 3, costUsd: 0.02 });
    expect(result.current.live).toEqual({
      reasoning: "Reading the routes",
      steps: 3,
      costUsd: 0.02,
    });
    expect(result.current.events).toEqual([]);

    source.send({
      type: "tool_start",
      seq: 1,
      toolCallId: "t1",
      toolName: "read_file",
      input: { path: "a.ts" },
    });
    expect(result.current.live.reasoning).toBe("");
  });

  it("refreshes the task when its stage, title or pull request changes", () => {
    const { refreshed } = render(running);
    const source = FakeEventSource.last;

    source.send({ type: "sandbox_created", seq: 1, sandboxId: "sb" });
    expect(refreshed()).toEqual([]);
    source.send({ type: "task_titled", seq: 2, title: "Add a health check" });
    expect(refreshed()).toEqual(
      expect.arrayContaining([
        ["tasks", "t1"],
        ["tasks", "list"],
      ]),
    );
  });

  it("closes on done", () => {
    const { refreshed } = render(running);
    const source = FakeEventSource.last;
    source.send({ type: "done", seq: 1, status: "succeeded" });

    expect(source.closed).toBe(true);
    expect(refreshed()).toContainEqual(["tasks", "t1"]);
  });

  it("asks whether the run is over when the stream drops, and stops once it has ended", () => {
    const { refreshed, rerender } = render(running);
    const source = FakeEventSource.last;

    act(() => source.onerror?.());
    expect(source.closed).toBe(false);
    expect(refreshed()).toContainEqual(["tasks", "t1"]);

    rerender({ run: { ...running, ended: true } });
    act(() => source.onerror?.());
    expect(source.closed).toBe(true);
  });

  it("opens nothing before the run is known", () => {
    vi.stubGlobal("EventSource", vi.fn());
    const { result } = render(undefined);
    expect(EventSource).not.toHaveBeenCalled();
    expect(result.current.events).toEqual([]);
  });
});
