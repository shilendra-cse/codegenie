import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useOnboardingEvents } from "./use-onboarding-events";

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
        data: JSON.stringify({ onboardingId: "s1", ts: "", ...event }),
      } as MessageEvent<string>),
    );
  }
}

function render(onboarding: { id: string; ended: boolean } | undefined) {
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(
    (props: { onboarding?: { id: string; ended: boolean } }) =>
      useOnboardingEvents("p1", props.onboarding),
    { wrapper, initialProps: { onboarding } },
  );
  const refreshed = () =>
    invalidate.mock.calls.map(([filters]) => filters?.queryKey);
  return { ...view, refreshed };
}

describe("useOnboardingEvents", () => {
  beforeEach(() => vi.stubGlobal("EventSource", FakeEventSource));
  afterEach(() => vi.unstubAllGlobals());

  it("follows the setup's stream, in order and without repeats", () => {
    const { result } = render({ id: "s1", ended: false });
    const source = FakeEventSource.last;
    expect(source.url).toBe("/api/projects/p1/onboarding/events");
    expect(source.init).toEqual({ withCredentials: true });

    source.send({ type: "info", seq: 1, message: "Preparing a sandbox…" });
    source.send({ type: "info", seq: 1, message: "Preparing a sandbox…" });
    source.send({ type: "text_delta", delta: "thinking" });
    source.send({ type: "info", seq: 2, message: "Installing…" });

    expect(result.current.map((e) => e.seq)).toEqual([1, 2]);
  });

  it("closes on done, and refreshes the setup, the projects and the environments", () => {
    const { refreshed } = render({ id: "s1", ended: false });
    const source = FakeEventSource.last;

    source.send({ type: "info", seq: 1, message: "Preparing a sandbox…" });
    source.send({ type: "done", seq: 2, status: "succeeded", version: 1 });

    expect(source.closed).toBe(true);
    expect(refreshed()).toEqual(
      expect.arrayContaining([
        ["projects", "p1", "onboarding"],
        ["projects"],
        ["projects", "p1", "environments"],
      ]),
    );
  });

  it("stops reconnecting once a setup has ended without a done event", () => {
    const { rerender, refreshed } = render({ id: "s1", ended: false });
    const source = FakeEventSource.last;

    act(() => source.onerror?.());
    expect(source.closed).toBe(false);
    expect(refreshed()).toContainEqual(["projects", "p1", "onboarding"]);

    rerender({ onboarding: { id: "s1", ended: true } });
    act(() => source.onerror?.());
    expect(source.closed).toBe(true);
  });

  it("starts over for a new setup, and doesn't open without one", () => {
    const { rerender, result } = render(undefined);
    expect(result.current).toEqual([]);

    rerender({ onboarding: { id: "s1", ended: false } });
    const first = FakeEventSource.last;
    first.send({ type: "info", seq: 1, message: "first setup" });

    rerender({ onboarding: { id: "s2", ended: false } });
    expect(first.closed).toBe(true);
    expect(result.current).toEqual([]);
  });
});
