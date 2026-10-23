import { randomUUID } from "node:crypto";
import {
  type Db,
  DbEnvironmentStore,
  findLatestOnboarding,
  findOnboarding,
  getInstallationById,
  insertOnboardingEvent,
  markOnboardingEnded,
  markOnboardingStarted,
  markOnboardingWaiting,
  setInstallationSuspended,
} from "@codegenie/db";
import { insertProject, testDatabaseOrSkip } from "@codegenie/db/testing";
import {
  ANSWER_CHANNEL,
  CANCEL_CHANNEL,
  type OnboardingResponse,
} from "@codegenie/shared";
import type { Response } from "express";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
import type { AuthenticatedRequest } from "@/types/base.types";
import { createOnboardingControllers } from "./onboarding.controller";

const database = await testDatabaseOrSkip("onboarding controllers");

const question = {
  questionId: "q-1",
  question: "Backend tests need PostgreSQL. What should I do?",
  why: "They connect to localhost:5432.",
  options: [{ label: "Skip them" }, { label: "Keep them" }],
  allowOther: true,
};

describe.skipIf(!database)("onboarding controllers against Postgres", () => {
  const db = database?.db as Db;
  const queued: { name: string; data: unknown; options: unknown }[] = [];
  const published: { channel: string; message: string }[] = [];
  let queueDown = false;
  const onboarding = createOnboardingControllers({
    db,
    queue: {
      add(name, data, options) {
        if (queueDown)
          return Promise.reject(new Error("Connection is closed."));
        queued.push({ name, data, options });
        return Promise.resolve({});
      },
    },
    publisher: {
      publish(channel, message) {
        published.push({ channel, message });
        return Promise.resolve(1);
      },
    },
    hub: { listen: () => Promise.resolve(() => Promise.resolve()) },
    heartbeatMs: 60_000,
  });
  const response = {} as Response;
  afterAll(() => database?.drop());
  beforeEach(() => {
    published.length = 0;
  });

  const request = (userId: string, id: string, body?: unknown) =>
    ({
      user: { id: userId, email: `${userId}@example.com` },
      params: { id },
      body,
    }) as unknown as AuthenticatedRequest;

  async function latestSetupId(projectId: string) {
    const setup = await findLatestOnboarding(db, projectId);
    if (!setup) throw new Error("No setup was recorded.");
    return setup.id;
  }

  /** A project with a setup that's running and waiting on `question`. */
  async function waitingSetup(asked: Partial<typeof question> = {}) {
    const project = await insertProject(db);
    await onboarding.start(request(project.userId, project.id), response);
    const setupId = await latestSetupId(project.id);
    await markOnboardingStarted(db, setupId);
    await insertOnboardingEvent(db, {
      onboardingId: setupId,
      seq: 1,
      type: "question_asked",
      payload: { ...question, ...asked },
    });
    await markOnboardingWaiting(db, setupId, question.questionId);
    return { project, setupId };
  }

  describe("starting setup", () => {
    it("records the setup, queues it, and returns the one in progress when started again", async () => {
      const project = await insertProject(db);
      const start = () =>
        onboarding.start(request(project.userId, project.id), response);

      const first = await start();
      expect(first).toMatchObject({
        status: 202,
        data: {
          onboarding: {
            status: "queued",
            question: null,
            environmentVersion: null,
            error: null,
            startedAt: null,
          },
        },
      });
      const id = await latestSetupId(project.id);
      expect(queued.at(-1)).toEqual({
        name: "onboard-project",
        data: { onboardingId: id },
        options: { jobId: id },
      });

      const before = queued.length;
      const again = await start();
      expect(again).toMatchObject({ data: { onboarding: { id } } });
      expect(queued).toHaveLength(before);
    });

    it("refuses when the App is suspended, for someone else's project, and when the queue is down", async () => {
      const suspended = await insertProject(db);
      const installation = await getInstallationById(
        db,
        suspended.installationId,
      );
      await setInstallationSuspended(db, installation!.installationId, true);
      const project = await insertProject(db);
      const start = (userId: string, id: string) =>
        onboarding.start(request(userId, id), response);

      await expect(start(suspended.userId, suspended.id)).rejects.toMatchObject(
        { status: 409, code: "GITHUB_INSTALLATION_SUSPENDED" },
      );
      await expect(start(randomUUID(), project.id)).rejects.toMatchObject({
        status: 404,
        code: "PROJECT_NOT_FOUND",
      });
      queueDown = true;
      await expect(start(project.userId, project.id)).rejects.toMatchObject({
        status: 503,
        code: "QUEUE_UNAVAILABLE",
      });
      queueDown = false;
      expect(await findLatestOnboarding(db, project.id)).toMatchObject({
        status: "failed",
        errorCode: "queue_unavailable",
      });
      await start(project.userId, project.id);
      expect((await findLatestOnboarding(db, project.id))?.status).toBe(
        "queued",
      );
    });
  });

  describe("reading the latest setup", () => {
    it("is null before the first setup, and 404 for someone else", async () => {
      const project = await insertProject(db);

      expect(
        await onboarding.getLatest(
          request(project.userId, project.id),
          response,
        ),
      ).toMatchObject({ status: 200, data: { onboarding: null } });
      await expect(
        onboarding.getLatest(request(randomUUID(), project.id), response),
      ).rejects.toMatchObject({ status: 404, code: "PROJECT_NOT_FOUND" });
    });

    it("includes the open question while it waits", async () => {
      const { project, setupId } = await waitingSetup();

      expect(
        await onboarding.getLatest(
          request(project.userId, project.id),
          response,
        ),
      ).toMatchObject({
        data: {
          onboarding: {
            id: setupId,
            status: "waiting",
            question: {
              id: "q-1",
              question: question.question,
              why: question.why,
              options: question.options,
              allowOther: true,
            },
          },
        },
      });
    });

    it("includes the version it saved, its error, and its timings", async () => {
      const project = await insertProject(db);
      await onboarding.start(request(project.userId, project.id), response);
      const setupId = await latestSetupId(project.id);
      await markOnboardingStarted(db, setupId);
      const environment = await new DbEnvironmentStore(db).save(
        project.id,
        {
          version: 1,
          steps: [],
          checks: [],
          meta: { source: "detected", createdAt: "", decisions: [] },
        },
        "detected",
      );
      await markOnboardingEnded(db, setupId, {
        status: "succeeded",
        environmentId: environment.id,
        inputTokens: 900,
        outputTokens: 120,
        costUsd: "0.0042",
      });

      const result = await onboarding.getLatest(
        request(project.userId, project.id),
        response,
      );
      expect(result).toMatchObject({
        data: {
          onboarding: {
            status: "succeeded",
            question: null,
            environmentVersion: 1,
            inputTokens: 900,
            outputTokens: 120,
            costUsd: 0.0042,
          },
        },
      });
      const latest = (result.data as { onboarding: OnboardingResponse })
        .onboarding;
      expect(latest.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("answering", () => {
    it("hands the answer to the worker", async () => {
      const { project, setupId } = await waitingSetup();

      const result = await onboarding.answer(
        request(project.userId, project.id, {
          questionId: "q-1",
          answer: { option: 1 },
        }),
        response,
      );

      expect(result).toMatchObject({
        status: 202,
        data: { questionId: "q-1" },
      });
      expect(published).toEqual([
        {
          channel: ANSWER_CHANNEL,
          message: JSON.stringify({
            onboardingId: setupId,
            questionId: "q-1",
            answer: { option: 1 },
          }),
        },
      ]);
    });

    it("refuses an answer to a question that isn't open", async () => {
      const { project, setupId } = await waitingSetup();
      const answer = (questionId: string) =>
        onboarding.answer(
          request(project.userId, project.id, {
            questionId,
            answer: { option: 0 },
          }),
          response,
        );

      await expect(answer("q-2")).rejects.toMatchObject({
        status: 409,
        code: "QUESTION_NOT_OPEN",
      });
      await markOnboardingEnded(db, setupId, { status: "cancelled" });
      await expect(answer("q-1")).rejects.toMatchObject({
        status: 409,
        code: "QUESTION_NOT_OPEN",
      });
      expect(published).toEqual([]);
    });

    it("refuses an option that doesn't exist, free text where it isn't allowed, and a malformed body", async () => {
      const open = await waitingSetup();
      const strict = await waitingSetup({ allowOther: false });
      const answer = (
        setup: Awaited<ReturnType<typeof waitingSetup>>,
        answer: unknown,
      ) =>
        onboarding.answer(
          request(setup.project.userId, setup.project.id, {
            questionId: "q-1",
            answer,
          }),
          response,
        );

      await expect(answer(open, { option: 2 })).rejects.toMatchObject({
        status: 400,
      });
      await expect(answer(open, { other: "  " })).rejects.toBeInstanceOf(
        ZodError,
      );
      await expect(
        answer(strict, { other: "Use SQLite" }),
      ).rejects.toMatchObject({ status: 400 });
      expect(published).toEqual([]);
    });

    it("says when the project was never set up", async () => {
      const project = await insertProject(db);

      await expect(
        onboarding.answer(
          request(project.userId, project.id, {
            questionId: "q-1",
            answer: { option: 0 },
          }),
          response,
        ),
      ).rejects.toMatchObject({ status: 404, code: "ONBOARDING_NOT_FOUND" });
    });
  });

  describe("stopping", () => {
    it("cancels a setup that hasn't started", async () => {
      const project = await insertProject(db);
      await onboarding.start(request(project.userId, project.id), response);

      expect(
        await onboarding.cancel(request(project.userId, project.id), response),
      ).toMatchObject({ status: 202, data: { outcome: "cancelled" } });
      expect((await findLatestOnboarding(db, project.id))?.status).toBe(
        "cancelled",
      );
      expect(published).toEqual([]);
    });

    it("tells the worker to stop a setup that's running or waiting", async () => {
      const { project, setupId } = await waitingSetup();

      expect(
        await onboarding.cancel(request(project.userId, project.id), response),
      ).toMatchObject({ status: 202, data: { outcome: "stopping" } });
      expect(published).toEqual([
        { channel: CANCEL_CHANNEL, message: setupId },
      ]);
      expect((await findOnboarding(db, setupId))?.status).toBe("waiting");
    });

    it("refuses a setup that has ended, or that doesn't exist", async () => {
      const { project, setupId } = await waitingSetup();
      await markOnboardingEnded(db, setupId, { status: "failed" });
      const never = await insertProject(db);

      await expect(
        onboarding.cancel(request(project.userId, project.id), response),
      ).rejects.toMatchObject({ status: 409, code: "ONBOARDING_ENDED" });
      await expect(
        onboarding.cancel(request(never.userId, never.id), response),
      ).rejects.toMatchObject({ status: 404, code: "ONBOARDING_NOT_FOUND" });
    });
  });
});
