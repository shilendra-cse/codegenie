import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import type { AddressInfo } from "node:net";
import {
  createOnboarding,
  type Db,
  insertOnboardingEvent,
  markOnboardingEnded,
  markOnboardingStarted,
  markOnboardingWaiting,
} from "@hobai/db";
import { insertProject, testDatabaseOrSkip } from "@hobai/db/testing";
import express, { type ErrorRequestHandler } from "express";
import { afterAll, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { EventHub } from "@/lib/event-hub";
import { HttpError } from "@/lib/http-error";
import { handleStream } from "@/lib/sse";
import type { AuthenticatedRequest } from "@/types/base.types";
import { createOnboardingControllers } from "./onboarding.controller";

const database = await testDatabaseOrSkip("setup event stream");

const answerErrors: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ code: error.code });
  } else {
    res.status(error instanceof ZodError ? 400 : 500).json({});
  }
};

type Frame = { id?: number; data?: Record<string, unknown>; comment?: string };

describe.skipIf(!database)("setup event stream over HTTP", () => {
  const db = database?.db as Db;
  const servers: { close(): void }[] = [];
  afterAll(async () => {
    servers.forEach((s) => s.close());
    await database?.drop();
  });

  const redis = new EventEmitter();
  const publish = (onboardingId: string, event: Record<string, unknown>) =>
    redis.emit(
      "message",
      `onboarding:${onboardingId}`,
      JSON.stringify({ onboardingId, ts: new Date().toISOString(), ...event }),
    );
  const hub = new EventHub({
    subscribe: () => Promise.resolve(1),
    unsubscribe: () => Promise.resolve(0),
    on: (event, listener) => redis.on(event, listener),
  });

  function serve(heartbeatMs = 60_000) {
    const controllers = createOnboardingControllers({
      db,
      queue: { add: () => Promise.resolve({}) },
      publisher: { publish: () => Promise.resolve(0) },
      hub,
      heartbeatMs,
      dailySpendCapUsd: 1000,
    });
    const app = express();
    app.get(
      "/projects/:id/onboarding/events",
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
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  }

  function open(
    base: string,
    projectId: string,
    userId: string,
    headers: Record<string, string> = {},
  ) {
    const frames: Frame[] = [];
    let wake = () => {};
    const ended = (async () => {
      const response = await fetch(
        `${base}/projects/${projectId}/onboarding/events`,
        { headers: { "x-user": userId, ...headers } },
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
    })();
    const until = async (check: () => boolean) => {
      while (!check()) await new Promise<void>((resolve) => (wake = resolve));
    };
    return {
      frames,
      ended,
      until,
      received: (count: number) =>
        until(() => frames.filter((f) => f.data).length >= count),
    };
  }

  const ids = (frames: Frame[]) =>
    frames.filter((f) => f.data).map((f) => f.id ?? null);

  /** A project whose latest setup is running, with `seqs` stored. */
  async function setupWith(seqs: number[]) {
    const project = await insertProject(db);
    const { onboarding } = await createOnboarding(db, {
      projectId: project.id,
      userId: project.userId,
    });
    await markOnboardingStarted(db, onboarding.id);
    for (const seq of seqs) {
      await insertOnboardingEvent(db, {
        onboardingId: onboarding.id,
        seq,
        type: "info",
        payload: { message: `step ${seq}` },
        createdAt: new Date("2026-10-23T10:00:00Z"),
      });
    }
    return {
      projectId: project.id,
      userId: project.userId,
      onboardingId: onboarding.id,
    };
  }

  it("replays the latest setup's events, then follows it live until done", async () => {
    const base = serve();
    const { projectId, userId, onboardingId } = await setupWith([1, 2]);
    const stream = open(base, projectId, userId);

    await stream.received(2);
    publish(onboardingId, { type: "text_delta", delta: "Looking around" });
    publish(onboardingId, { type: "info", seq: 3, message: "Installed" });
    publish(onboardingId, { type: "done", seq: 4, status: "succeeded" });
    await stream.ended;

    expect(ids(stream.frames)).toEqual([1, 2, null, 3, 4]);
    expect(stream.frames[0].data).toEqual({
      type: "info",
      message: "step 1",
      onboardingId,
      seq: 1,
      ts: "2026-10-23T10:00:00.000Z",
    });
  });

  it("resumes after Last-Event-ID, and replays and closes for a setup that ended", async () => {
    const base = serve();
    const { projectId, userId, onboardingId } = await setupWith([1, 2, 3]);
    await markOnboardingEnded(db, onboardingId, { status: "failed" });

    const stream = open(base, projectId, userId, { "last-event-id": "1" });
    await stream.ended;

    expect(ids(stream.frames)).toEqual([2, 3]);
  });

  it("fills a gap in the live events from the stored ones", async () => {
    const base = serve();
    const { projectId, userId, onboardingId } = await setupWith([1]);
    const stream = open(base, projectId, userId);

    await stream.received(1);
    await insertOnboardingEvent(db, {
      onboardingId,
      seq: 2,
      type: "question_asked",
      payload: { questionId: "q-1", question: "Which tests?", options: [] },
    });
    publish(onboardingId, { type: "done", seq: 3, status: "cancelled" });
    await stream.ended;

    expect(ids(stream.frames)).toEqual([1, 2, 3]);
  });

  it("stays open while it waits for an answer, and closes once the setup ends without a done event", async () => {
    const base = serve(30);
    const { projectId, userId, onboardingId } = await setupWith([1]);
    await markOnboardingWaiting(db, onboardingId, "q-1");
    const stream = open(base, projectId, userId);

    await stream.until(
      () => stream.frames.filter((f) => f.comment === "ping").length >= 2,
    );
    await markOnboardingEnded(db, onboardingId, { status: "cancelled" });
    await stream.ended;

    expect(ids(stream.frames)).toEqual([1]);
  });

  it("answers 404 before the first setup and for someone else's project, without streaming", async () => {
    const base = serve();
    const never = await insertProject(db);
    const { projectId } = await setupWith([1]);

    const before = await open(base, never.id, never.userId).ended;
    const someoneElse = await open(base, projectId, randomUUID()).ended;

    expect(before.status).toBe(404);
    expect(await before.json()).toEqual({ code: "ONBOARDING_NOT_FOUND" });
    expect(someoneElse.status).toBe(404);
    expect(await someoneElse.json()).toEqual({ code: "PROJECT_NOT_FOUND" });
  });
});
