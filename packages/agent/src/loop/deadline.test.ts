import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDeadline } from "./deadline.js";

describe("createDeadline", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("aborts once the time is used up", () => {
    const deadline = createDeadline(1_000);

    vi.advanceTimersByTime(999);
    expect(deadline.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(deadline.signal.aborted).toBe(true);
    expect((deadline.signal.reason as DOMException).name).toBe("TimeoutError");
  });

  it("doesn't count time while paused", () => {
    const deadline = createDeadline(1_000);
    vi.advanceTimersByTime(600);

    deadline.pause();
    vi.advanceTimersByTime(60 * 60_000);
    expect(deadline.signal.aborted).toBe(false);

    deadline.resume();
    vi.advanceTimersByTime(399);
    expect(deadline.signal.aborted).toBe(false);
    vi.advanceTimersByTime(1);
    expect(deadline.signal.aborted).toBe(true);
  });

  it("resumes only when overlapping pauses have all ended", () => {
    const deadline = createDeadline(1_000);
    deadline.pause();
    deadline.pause();
    deadline.resume();

    vi.advanceTimersByTime(5_000);
    expect(deadline.signal.aborted).toBe(false);

    deadline.resume();
    vi.advanceTimersByTime(1_000);
    expect(deadline.signal.aborted).toBe(true);
  });

  it("ignores a resume without a pause, and stops when disposed", () => {
    const deadline = createDeadline(1_000);
    deadline.resume();
    deadline.dispose();

    vi.advanceTimersByTime(5_000);
    expect(deadline.signal.aborted).toBe(false);
  });
});
