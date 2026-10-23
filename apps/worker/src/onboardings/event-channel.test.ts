import type {
  OnboardingEventBody,
  RunEvent,
  SetupQuestion,
} from "@codegenie/shared";
import { describe, expect, it, vi } from "vitest";
import { createEventChannel } from "./event-channel.js";

const question: SetupQuestion = {
  question: "Backend tests need PostgreSQL. What should I do?",
  options: [{ label: "Skip them" }, { label: "Keep them" }],
};

function channel(timeoutMs = 60_000) {
  const emitted: (RunEvent | OnboardingEventBody)[] = [];
  const record = {
    waiting: vi.fn(async () => {}),
    resumed: vi.fn(async () => {}),
  };
  const stop = new AbortController();
  const onTimeout = vi.fn(() => stop.abort());
  const events = createEventChannel({
    sink: { emit: (e) => void emitted.push(e), flush: async () => {} },
    record,
    signal: stop.signal,
    timeoutMs,
    onTimeout,
  });
  const askedId = () => {
    const asked = emitted.find((e) => e.type === "question_asked");
    return asked?.type === "question_asked" ? asked.questionId : "";
  };
  return { events, emitted, record, stop, onTimeout, askedId };
}

const flush = () => new Promise((r) => setTimeout(r));

describe("event channel", () => {
  it("asks, waits for the matching answer, and records both", async () => {
    const { events, emitted, record, askedId } = channel();
    const answer = events.ask(question);
    await flush();

    expect(record.waiting).toHaveBeenCalledWith(askedId());
    events.receive("another-question", { option: 1 });
    events.receive(askedId(), { option: 7 });
    events.receive(askedId(), { option: 1 });

    expect(await answer).toEqual({ option: 1 });
    expect(record.resumed).toHaveBeenCalledOnce();
    expect(emitted.at(-1)).toMatchObject({
      type: "question_answered",
      questionId: askedId(),
      label: "Keep them",
    });
  });

  it("takes an answer in your own words unless only the options make sense", async () => {
    const open = channel();
    const answer = open.events.ask(question);
    await flush();
    open.events.receive(open.askedId(), { other: "  Use SQLite  " });
    expect(await answer).toEqual({ other: "  Use SQLite  " });
    expect(open.emitted.at(-1)).toMatchObject({ label: "Use SQLite" });

    const closed = channel();
    const choice = closed.events.ask({ ...question, allowOther: false });
    await flush();
    closed.events.receive(closed.askedId(), { other: "Something else" });
    closed.events.receive(closed.askedId(), { option: 0 });
    expect(await choice).toEqual({ option: 0 });
  });

  it("gives up after the wait, stopping setup first", async () => {
    const { events, onTimeout, stop } = channel(20);

    await expect(events.ask(question)).rejects.toThrow(
      "No answer came in time.",
    );
    expect(onTimeout).toHaveBeenCalledOnce();
    expect(stop.signal.aborted).toBe(true);
  });

  it("stops waiting when setup is stopped, and ignores a late answer", async () => {
    const { events, stop, askedId, onTimeout } = channel();
    const answer = events.ask(question);
    await flush();
    stop.abort();

    await expect(answer).rejects.toThrow("Setup was stopped.");
    events.receive(askedId(), { option: 0 });
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
