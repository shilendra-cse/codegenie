/** An agent's time limit that can stop counting, e.g. while a person decides how to answer it. */
export type Deadline = {
  /** Aborts once the limit is used up. */
  signal: AbortSignal;
  pause(): void;
  resume(): void;
  /** Stops the timer, so a finished agent doesn't keep the process waiting. */
  dispose(): void;
};

export function createDeadline(ms: number): Deadline {
  const controller = new AbortController();
  let remaining = ms;
  let startedAt = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Counted, so overlapping pauses resume only when the last one ends.
  let pauses = 0;

  const start = () => {
    startedAt = Date.now();
    timer = setTimeout(
      () =>
        controller.abort(
          new DOMException("The time limit was reached.", "TimeoutError"),
        ),
      Math.max(0, remaining),
    );
    timer.unref?.();
  };
  start();

  return {
    signal: controller.signal,
    pause() {
      pauses += 1;
      if (pauses > 1 || controller.signal.aborted) return;
      clearTimeout(timer);
      remaining -= Date.now() - startedAt;
    },
    resume() {
      if (pauses === 0) return;
      pauses -= 1;
      if (pauses > 0 || controller.signal.aborted) return;
      start();
    },
    dispose() {
      clearTimeout(timer);
    },
  };
}
