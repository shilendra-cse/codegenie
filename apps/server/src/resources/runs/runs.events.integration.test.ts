import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { AddressInfo } from "node:net";
import { type Db, insertRunEvent, runs } from "@codegenie/db";
import { insertRun, testDatabaseOrSkip } from "@codegenie/db/testing";
import { eq } from "drizzle-orm";
import express, { type ErrorRequestHandler } from "express";
import { afterAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { EventHub } from "@/lib/event-hub";
import { handleStream } from "@/lib/sse";
import { HttpError } from "@/lib/http-error";
import type { AuthenticatedRequest } from "@/types/base.types";
import { createRunControllers } from "./runs.controller";

const database = await testDatabaseOrSkip("run event stream");

const answerErrors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ code: error.code });
  } else {
    res.status(error instanceof ZodError ? 400 : 500).json({});
  }
};

type Frame = { id?: number; data?: Record<string, unknown>; comment?: string };

describe.skipIf(!database)("run event stream over HTTP", () => {
  const db = database?.db as Db;
  const servers: { close(): void }[] = [];
  afterAll(async () => {
    servers.forEach((s) => s.close());
    await database?.drop();
  });

  const redis = new EventEmitter();
  const publish = (runId: string, event: Record<string, unknown>) =>
    redis.emit(
      "message",
      `run:${runId}`,
      JSON.stringify({ runId, ts: new Date().toISOString(), ...event }),
    );
  const realHub = new EventHub({
    subscribe: () => Promise.resolve(1),
    unsubscribe: () => Promise.resolve(0),
    on: (event, listener) => redis.on(event, listener),
  });

  function serve(
    options: { heartbeatMs?: number; onListen?: (runId: string) => void } = {},
  ) {
    const stopped: string[] = [];
    const controllers = createRunControllers({
      db,
      publisher: { publish: () => Promise.resolve(0) },
      heartbeatMs: options.heartbeatMs ?? 60_000,
      hub: {
        async listen(channel, viewer) {
          const runId = channel.replace(/^run:/, "");
          const stop = await realHub.listen(channel, viewer);
          options.onListen?.(runId);
          return async () => {
            stopped.push(runId);
            await stop();
          };
        },
      },
    });
    const app = express();
    app.get(
      "/runs/:id/events",
      (req, _res, next) => {
        (req as unknown as AuthenticatedRequest).user = {
          id: req.get("x-user") ?? "",
          email: "",
        };
        next();
      },
      handleStream(controllers.streamEvents, () => {}),
    );
    app.use(answerErrors);
    const server = app.listen(0);
    servers.push(server);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    return { base, stopped };
  }

  function open(
    base: string,
    runId: string,
    userId: string,
    init: { headers?: Record<string, string>; query?: string } = {},
  ) {
    const frames: Frame[] = [];
    const aborter = new AbortController();
    let wake = () => {};
    const ended = (async () => {
      const response = await fetch(
        `${base}/runs/${runId}/events${init.query ?? ""}`,
        {
          headers: { "x-user": userId, ...init.headers },
          signal: aborter.signal,
        },
      );
      if (
        !response.body ||
        response.headers.get("content-type") !== "text/event-stream"
      ) {
        return response;
      }
      const decoder = new TextDecoder();
      let text = "";
      for await (const chunk of response.body) {
        text += decoder.decode(chunk as Uint8Array, { stream: true });
        let end;
        while ((end = text.indexOf("\n\n")) >= 0) {
          const frame: Frame = {};
          for (const line of text.slice(0, end).split("\n")) {
            if (line.startsWith("id: ")) frame.id = Number(line.slice(4));
            else if (line.startsWith("data: "))
              frame.data = JSON.parse(line.slice(6)) as Record<string, unknown>;
            else if (line.startsWith(": ")) frame.comment = line.slice(2);
          }
          frames.push(frame);
          text = text.slice(end + 2);
          wake();
        }
      }
      return response;
    })().catch((error: unknown) => {
      if (!aborter.signal.aborted) throw error;
      return null;
    });
    const until = async (check: () => boolean) => {
      while (!check()) await new Promise<void>((resolve) => (wake = resolve));
    };
    return {
      frames,
      ended,
      abort: () => aborter.abort(),
      received: (count: number) =>
        until(() => frames.filter((f) => f.data).length >= count),
      until,
    };
  }

  const ids = (frames: Frame[]) =>
    frames.filter((f) => f.data).map((f) => f.id ?? null);

  async function storedRun(
    seqs: number[],
    status: typeof runs.$inferSelect.status = "running",
  ) {
    const { project, run } = await insertRun(db, { status });
    for (const seq of seqs) {
      await insertRunEvent(db, {
        runId: run.id,
        seq,
        type: "stage_changed",
        payload: { stage: "setup" },
        createdAt: new Date("2026-10-22T10:00:00Z"),
      });
    }
    return { userId: project.userId, runId: run.id };
  }

  it("replays stored events, then follows live ones until done", async () => {
    const { base } = serve();
    const { userId, runId } = await storedRun([1, 2]);
    const stream = open(base, runId, userId);

    await stream.received(2);
    publish(runId, { type: "text_delta", delta: "Reading the routes" });
    publish(runId, {
      type: "tool_start",
      seq: 3,
      toolCallId: "c1",
      toolName: "read_file",
      input: {},
    });
    publish(runId, { type: "done", seq: 4, status: "succeeded" });
    await stream.ended;

    expect(ids(stream.frames)).toEqual([1, 2, null, 3, 4]);
    expect(stream.frames[0].data).toEqual({
      type: "stage_changed",
      stage: "setup",
      runId,
      seq: 1,
      ts: "2026-10-22T10:00:00.000Z",
    });
    expect(stream.frames[2].data).toMatchObject({
      type: "text_delta",
      delta: "Reading the routes",
    });
  });

  it("resumes after the Last-Event-ID header or the after parameter, and closes for an ended run", async () => {
    const { base } = serve();
    const { userId, runId } = await storedRun([1, 2, 3], "succeeded");

    const fromHeader = open(base, runId, userId, {
      headers: { "last-event-id": "1" },
    });
    const fromQuery = open(base, runId, userId, { query: "?after=2" });
    await Promise.all([fromHeader.ended, fromQuery.ended]);

    expect(ids(fromHeader.frames)).toEqual([2, 3]);
    expect(ids(fromQuery.frames)).toEqual([3]);
  });

  it("sends each stored event once when a live copy arrives during the replay", async () => {
    let runIdToEcho = "";
    const { base } = serve({
      onListen: (runId) => {
        if (runId === runIdToEcho)
          publish(runId, { type: "stage_changed", seq: 2, stage: "setup" });
      },
    });
    const { userId, runId } = await storedRun([1, 2]);
    runIdToEcho = runId;
    const stream = open(base, runId, userId);

    await stream.received(2);
    publish(runId, { type: "done", seq: 3, status: "succeeded" });
    await stream.ended;

    expect(ids(stream.frames)).toEqual([1, 2, 3]);
  });

  it("fills a gap in the live events from the stored ones", async () => {
    const { base } = serve();
    const { userId, runId } = await storedRun([1]);
    const stream = open(base, runId, userId);

    await stream.received(1);
    await insertRunEvent(db, {
      runId,
      seq: 2,
      type: "agent_step",
      payload: {},
    });
    publish(runId, { type: "done", seq: 3, status: "succeeded" });
    await stream.ended;

    expect(ids(stream.frames)).toEqual([1, 2, 3]);
  });

  it("pings while waiting, and closes once the run ends without a done event", async () => {
    const { base } = serve({ heartbeatMs: 30 });
    const { userId, runId } = await storedRun([], "queued");
    const stream = open(base, runId, userId);

    await stream.until(() => stream.frames.some((f) => f.comment === "ping"));
    await db
      .update(runs)
      .set({ status: "cancelled" })
      .where(eq(runs.id, runId));
    await stream.ended;

    expect(ids(stream.frames)).toEqual([]);
  });

  it("stops listening when the browser goes away", async () => {
    const { base, stopped } = serve();
    const { userId, runId } = await storedRun([1]);
    const stream = open(base, runId, userId);

    await stream.received(1);
    stream.abort();
    await stream.ended;
    while (!stopped.includes(runId))
      await new Promise((r) => setTimeout(r, 10));

    expect(stopped).toEqual([runId]);
  });

  it("answers 404 for someone else's run and 400 for a bad event id, without streaming", async () => {
    const { base } = serve();
    const { userId, runId } = await storedRun([1]);

    const notYours = await open(base, runId, randomUUID()).ended;
    const badId = await open(base, runId, userId, {
      headers: { "last-event-id": "x" },
    }).ended;

    expect(notYours?.status).toBe(404);
    expect(await notYours?.json()).toMatchObject({ code: "RUN_NOT_FOUND" });
    expect(badId?.status).toBe(400);
  });
});
