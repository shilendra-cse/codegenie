import { randomUUID } from "node:crypto";
import { runEvents, type Db } from "@codegenie/db";
import { insertRun, testDatabaseOrSkip } from "@codegenie/db/testing";
import type { JobEvent, JobStage } from "@codegenie/shared";
import { asc, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createEventSink, type Publisher } from "./sink.js";

const database = await testDatabaseOrSkip("event sink");

function recordingPublisher(failOn?: (message: string) => boolean) {
  const messages: { channel: string; event: JobEvent }[] = [];
  const publisher: Publisher = {
    async publish(channel, message) {
      if (failOn?.(message)) throw new Error("redis down");
      messages.push({ channel, event: JSON.parse(message) as JobEvent });
      return 1;
    },
  };
  return { publisher, messages };
}

const ts = "2026-10-20T10:00:00.000Z";
const stage = (jobId: string, stage: JobStage): JobEvent => ({
  type: "stage_changed",
  jobId,
  ts,
  stage,
});

describe.skipIf(!database)("event sink against Postgres", () => {
  const db = database?.db as Db;
  afterAll(() => database?.drop());

  const storedEvents = (jobId: string) =>
    db
      .select({
        seq: runEvents.seq,
        type: runEvents.type,
        payload: runEvents.payload,
        createdAt: runEvents.createdAt,
      })
      .from(runEvents)
      .where(eq(runEvents.runId, jobId))
      .orderBy(asc(runEvents.seq));

  it("stores events numbered in order and publishes each with its number", async () => {
    const { run: job } = await insertRun(db);
    const { publisher, messages } = recordingPublisher();
    const sink = createEventSink({ db, publisher }, job.id);

    sink.emit(stage(job.id, "setup"));
    sink.emit({
      type: "sandbox_created",
      jobId: job.id,
      ts,
      sandboxId: "sb-1",
    });
    sink.emit(stage(job.id, "agent"));
    await sink.flush();

    expect(await storedEvents(job.id)).toEqual([
      {
        seq: 1,
        type: "stage_changed",
        payload: { stage: "setup" },
        createdAt: new Date(ts),
      },
      {
        seq: 2,
        type: "sandbox_created",
        payload: { sandboxId: "sb-1" },
        createdAt: new Date(ts),
      },
      {
        seq: 3,
        type: "stage_changed",
        payload: { stage: "agent" },
        createdAt: new Date(ts),
      },
    ]);
    expect(messages.map((m) => [m.channel, m.event.seq, m.event.type])).toEqual(
      [
        [`job:${job.id}`, 1, "stage_changed"],
        [`job:${job.id}`, 2, "sandbox_created"],
        [`job:${job.id}`, 3, "stage_changed"],
      ],
    );
  });

  it("only publishes text and step progress, without using a number", async () => {
    const { run: job } = await insertRun(db);
    const { publisher, messages } = recordingPublisher();
    const sink = createEventSink({ db, publisher }, job.id);

    sink.emit({ type: "text_delta", jobId: job.id, ts, delta: "Reading" });
    sink.emit({
      type: "agent_step",
      jobId: job.id,
      ts,
      steps: 1,
      costUsd: 0.001,
    });
    sink.emit(stage(job.id, "verify"));
    await sink.flush();

    expect((await storedEvents(job.id)).map((e) => [e.seq, e.type])).toEqual([
      [1, "stage_changed"],
    ]);
    expect(messages.map((m) => [m.event.type, m.event.seq])).toEqual([
      ["text_delta", undefined],
      ["agent_step", undefined],
      ["stage_changed", 1],
    ]);
  });

  it("keeps the order of many quick events", async () => {
    const { run: job } = await insertRun(db);
    const sink = createEventSink(
      { db, publisher: recordingPublisher().publisher },
      job.id,
    );
    for (let i = 0; i < 40; i++) {
      sink.emit({
        type: "sandbox_created",
        jobId: job.id,
        ts,
        sandboxId: `sb-${i}`,
      });
    }
    await sink.flush();

    const stored = await storedEvents(job.id);
    expect(stored.map((e) => e.payload.sandboxId)).toEqual(
      Array.from({ length: 40 }, (_, i) => `sb-${i}`),
    );
    expect(stored.map((e) => e.seq)).toEqual(
      Array.from({ length: 40 }, (_, i) => i + 1),
    );
  });

  it("reports a failed write on flush and keeps going without gaps", async () => {
    const { run: job } = await insertRun(db);
    const { publisher } = recordingPublisher((message) =>
      message.includes("sb-broken"),
    );
    const sink = createEventSink({ db, publisher }, job.id);

    sink.emit({
      type: "sandbox_created",
      jobId: job.id,
      ts,
      sandboxId: "sb-broken",
    });
    sink.emit(stage(job.id, "setup"));
    await expect(sink.flush()).rejects.toThrow("redis down");
    expect((await storedEvents(job.id)).map((e) => [e.seq, e.type])).toEqual([
      [1, "sandbox_created"],
      [2, "stage_changed"],
    ]);

    const missing = createEventSink({ db, publisher }, randomUUID());
    missing.emit(stage(randomUUID(), "setup"));
    await expect(missing.flush()).rejects.toThrow();
  });
});
