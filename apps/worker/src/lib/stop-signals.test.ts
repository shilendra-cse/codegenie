import { describe, expect, it, vi } from "vitest";
import { createStopHandler } from "./stop-signals.js";

function setup() {
  let time = 0;
  let finish!: () => void;
  const stop = vi.fn(() => new Promise<void>((resolve) => (finish = resolve)));
  const exit = vi.fn();
  const handle = createStopHandler({
    stop,
    log: () => {},
    exit,
    now: () => time,
  });
  return {
    handle,
    stop,
    exit,
    finish: () => finish(),
    wait: (ms: number) => (time += ms),
  };
}

describe("createStopHandler", () => {
  it("stops after the work in progress on SIGTERM", async () => {
    const { handle, stop, exit, finish } = setup();
    const stopping = handle("SIGTERM");
    expect(stop).toHaveBeenCalledOnce();
    finish();
    await stopping;
    expect(exit).not.toHaveBeenCalled();
  });

  it("ignores repeated SIGTERMs, however late they come", async () => {
    const { handle, stop, exit, wait } = setup();
    void handle("SIGTERM");
    for (const ms of [10, 5_000, 30 * 60_000]) {
      wait(ms);
      await handle("SIGTERM");
    }
    expect(stop).toHaveBeenCalledOnce();
    expect(exit).not.toHaveBeenCalled();
  });

  it("stops now on a second Ctrl-C", async () => {
    const { handle, exit, wait } = setup();
    void handle("SIGINT");
    wait(2_000);
    await handle("SIGINT");
    expect(exit).toHaveBeenCalledWith(1);
  });

  it("treats a Ctrl-C passed on twice within a second as one press", async () => {
    const { handle, exit, wait } = setup();
    void handle("SIGINT");
    wait(5);
    await handle("SIGINT");
    expect(exit).not.toHaveBeenCalled();
  });
});
