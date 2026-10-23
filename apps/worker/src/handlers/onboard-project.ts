import {
  DbEnvironmentStore,
  findOnboarding,
  getProject,
  type Db,
} from "@codegenie/db";
import type { GithubApp } from "@codegenie/github";
import {
  autoChannel,
  runOnboarding,
  type OnboardingResult,
  type RunOnboardingOptions,
} from "@codegenie/runner";
import type {
  OnboardingEndStatus,
  OnboardingEventBody,
  QueuedWork,
  RunEvent,
} from "@codegenie/shared";
import {
  createEventSink,
  onboardingEventTarget,
  type Publisher,
} from "../events/sink.js";
import { GithubAccessError, repoReadToken } from "../github/repo-token.js";
import type { Log } from "../lib/log.js";
import type { SandboxFactory } from "../lib/sandbox-factory.js";
import {
  createOnboardingRecord,
  onboardingOutcome,
} from "../onboardings/onboarding-record.js";

export type OnboardProjectDeps = {
  db: Db;
  publisher: Publisher;
  log: Log;
  createSandbox: SandboxFactory;
  github: Pick<GithubApp, "repoToken">;
} & Pick<RunOnboardingOptions, "model" | "agentLimits">;

/** Null when the setup was no longer queued (e.g. cancelled before it started). */
export async function handleOnboardProject(
  deps: OnboardProjectDeps,
  { onboardingId }: QueuedWork["onboard-project"],
  signal?: AbortSignal,
): Promise<OnboardingResult | null> {
  const { db } = deps;
  const onboarding = await findOnboarding(db, onboardingId);
  if (!onboarding) throw new Error(`Setup ${onboardingId} doesn't exist.`);
  const project = await getProject(db, onboarding.projectId);
  if (!project)
    throw new Error(`Project ${onboarding.projectId} doesn't exist.`);
  const repo = `${project.repoOwner}/${project.repoName}`;

  const record = createOnboardingRecord(db, onboardingId);
  if (!(await record.start())) {
    deps.log("info", "Setup skipped: it isn't queued", { onboardingId });
    return null;
  }

  const sink = createEventSink<RunEvent | OnboardingEventBody>(
    deps,
    onboardingEventTarget(db, onboardingId),
  );
  const now = () => new Date().toISOString();
  const info = (message: string) =>
    sink.emit({ type: "info", ts: now(), message });
  const done = (
    status: OnboardingEndStatus,
    extra: { version?: number; error?: string } = {},
  ) => sink.emit({ type: "done", ts: now(), status, ...extra });
  const flush = () =>
    sink.flush().catch((error: unknown) =>
      deps.log("warn", "Some setup events weren't saved or published", {
        onboardingId,
        error: String(error),
      }),
    );

  let token: string;
  try {
    token = await repoReadToken(deps, project);
  } catch (error) {
    if (error instanceof GithubAccessError) {
      done("failed", { error: error.message });
      await flush();
      await record.fail({ code: "github_access", message: error.message });
    }
    throw error;
  }

  const result = await runOnboarding({
    runId: `onboarding-${onboardingId}`,
    source: {
      type: "git",
      url: `https://github.com/${repo}.git`,
      ref: project.defaultBranch,
      token,
    },
    model: deps.model,
    agentLimits: deps.agentLimits,
    createSandbox: () =>
      deps.createSandbox({ kind: "onboarding", projectId: project.id }),
    channel: autoChannel(info),
    emit: (event) => sink.emit(event),
    signal,
  });

  const saved =
    result.status === "approved" && result.config
      ? await new DbEnvironmentStore(db).save(
          project.id,
          result.config,
          result.config.meta.source,
        )
      : null;
  const outcome = onboardingOutcome(result, saved?.id ?? null);
  done(outcome.status, {
    ...(saved ? { version: saved.version } : {}),
    ...(outcome.errorMessage ? { error: outcome.errorMessage } : {}),
  });
  await flush();
  await record.finish(outcome);
  deps.log("info", "Setup finished", {
    onboardingId,
    projectId: project.id,
    status: outcome.status,
    ...(saved ? { version: saved.version } : {}),
  });

  if (outcome.status === "failed") {
    throw new Error(`Setup of ${repo} failed: ${outcome.errorMessage}`);
  }
  return result;
}
