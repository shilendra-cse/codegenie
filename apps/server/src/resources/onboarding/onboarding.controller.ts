import type { Db } from "@hobai/db";
import {
  afterSeqSchema,
  answerOnboardingSchema,
  projectParamsSchema,
} from "@hobai/shared";
import { ok } from "@/lib/api-response";
import { openSse } from "@/lib/sse";
import type {
  AuthenticatedController,
  AuthenticatedStream,
} from "@/types/base.types";
import type { Publisher } from "../runs/services/cancelRun.service";
import type { WorkQueue } from "../tasks/tasks.types";
import { toOnboardingResponse } from "./onboarding.types";
import { answerOnboarding } from "./services/answerOnboarding.service";
import { cancelOnboarding } from "./services/cancelOnboarding.service";
import { getLatestOnboarding } from "./services/getLatestOnboarding.service";
import { startOnboarding } from "./services/startOnboarding.service";
import {
  streamOnboardingEvents,
  type StreamOnboardingEventsDeps,
} from "./services/streamOnboardingEvents.service";

export type OnboardingControllerDeps = {
  db: Db;
  queue: WorkQueue;
  publisher: Publisher;
  dailySpendCapUsd: number;
} & Pick<StreamOnboardingEventsDeps, "hub" | "heartbeatMs">;

export function createOnboardingControllers(deps: OnboardingControllerDeps) {
  const start: AuthenticatedController = async (req) => {
    const { id } = projectParamsSchema.parse(req.params);
    const onboarding = await startOnboarding(deps, req.user.id, id);
    return ok(202, "Accepted", {
      onboarding: toOnboardingResponse(onboarding),
    });
  };

  const getLatest: AuthenticatedController = async (req) => {
    const { id } = projectParamsSchema.parse(req.params);
    const onboarding = await getLatestOnboarding(deps.db, req.user.id, id);
    return ok(200, "OK", { onboarding });
  };

  const answer: AuthenticatedController = async (req) => {
    const { id } = projectParamsSchema.parse(req.params);
    const input = answerOnboardingSchema.parse(req.body);
    await answerOnboarding(deps, req.user.id, id, input);
    return ok(202, "Accepted", { questionId: input.questionId });
  };

  const cancel: AuthenticatedController = async (req) => {
    const { id } = projectParamsSchema.parse(req.params);
    const outcome = await cancelOnboarding(deps, req.user.id, id);
    return ok(202, "Accepted", { outcome });
  };

  const streamEvents: AuthenticatedStream = async (req, res) => {
    const { id } = projectParamsSchema.parse(req.params);
    const afterSeq = afterSeqSchema.parse(
      req.get("last-event-id") ?? req.query.after,
    );
    await streamOnboardingEvents(deps, {
      userId: req.user.id,
      projectId: id,
      afterSeq,
      open: () => openSse(res),
    });
  };

  return { start, getLatest, answer, cancel, streamEvents };
}
