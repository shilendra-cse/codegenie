import { DbEnvironmentStore, getProject, type Db } from "@codegenie/db";
import {
  autoChannel,
  runOnboarding,
  type OnboardingResult,
  type RunOnboardingOptions,
} from "@codegenie/runner";
import type { GithubApp } from "@codegenie/github";
import {
  onboardingChannel,
  type OnboardingMessage,
  type QueuedWork,
} from "@codegenie/shared";
import type { Publisher } from "../events/sink.js";
import { GithubAccessError, repoReadToken } from "../github/repo-token.js";
import type { Log } from "../lib/log.js";
import type { SandboxFactory } from "../lib/sandbox-factory.js";
import { createSerialQueue } from "../lib/serial-queue.js";

export type OnboardProjectDeps = {
  db: Db;
  publisher: Publisher;
  log: Log;
  createSandbox: SandboxFactory;
  github: Pick<GithubApp, "repoToken">;
} & Pick<RunOnboardingOptions, "model" | "agentLimits">;

export async function handleOnboardProject(
  deps: OnboardProjectDeps,
  { projectId }: QueuedWork["onboard-project"],
  signal?: AbortSignal,
): Promise<OnboardingResult> {
  const { db } = deps;
  const project = await getProject(db, projectId);
  if (!project) throw new Error(`Project ${projectId} doesn't exist.`);
  const repo = `${project.repoOwner}/${project.repoName}`;

  const publishes = createSerialQueue();
  const publish = (message: OnboardingMessage) =>
    publishes.add(async () => {
      await deps.publisher.publish(
        onboardingChannel(projectId),
        JSON.stringify(message),
      );
    });

  let token: string;
  try {
    token = await repoReadToken(deps, project);
  } catch (error) {
    if (error instanceof GithubAccessError) {
      publish({ type: "done", status: "failed", error: error.message });
      await publishes.drain().catch(() => {});
    }
    throw error;
  }

  const result = await runOnboarding({
    runId: `onboard-${projectId}`,
    source: {
      type: "git",
      url: `https://github.com/${repo}.git`,
      ref: project.defaultBranch,
      token,
    },
    model: deps.model,
    agentLimits: deps.agentLimits,
    createSandbox: () => deps.createSandbox({ kind: "onboarding", projectId }),
    channel: autoChannel((message) => publish({ type: "info", message })),
    emit: (event) => publish({ type: "event", event }),
    signal,
  });

  const saved =
    result.status === "approved" && result.config
      ? await new DbEnvironmentStore(db).save(
          projectId,
          result.config,
          result.config.meta.source,
        )
      : null;
  publish({
    type: "done",
    status: result.status,
    ...(saved ? { version: saved.version } : {}),
    ...(result.error ? { error: result.error } : {}),
  });
  try {
    await publishes.drain();
  } catch (error) {
    deps.log("warn", "Some onboarding messages weren't published", {
      projectId,
      error: String(error),
    });
  }
  deps.log("info", "Onboarding finished", {
    projectId,
    status: result.status,
    ...(saved ? { version: saved.version } : {}),
  });

  if (result.status === "failed") {
    throw new Error(`Onboarding ${repo} failed: ${result.error}`);
  }
  return result;
}
