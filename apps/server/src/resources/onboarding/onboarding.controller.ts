import type { Db } from "@codegenie/db";
import { answerOnboardingSchema, projectParamsSchema } from "@codegenie/shared";
import { ok } from "@/lib/api-response";
import type { AuthenticatedController } from "@/types/base.types";
import type { Publisher } from "../runs/services/cancelRun.service";
import type { WorkQueue } from "../tasks/tasks.types";
import { toOnboardingResponse } from "./onboarding.types";
import { answerOnboarding } from "./services/answerOnboarding.service";
import { cancelOnboarding } from "./services/cancelOnboarding.service";
import { getLatestOnboarding } from "./services/getLatestOnboarding.service";
import { startOnboarding } from "./services/startOnboarding.service";

export type OnboardingControllerDeps = {
  db: Db;
  queue: WorkQueue;
  publisher: Publisher;
};

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

  return { start, getLatest, answer, cancel };
}
