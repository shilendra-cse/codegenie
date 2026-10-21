import {
  createTaskWithRun,
  ensureInstallation,
  ensureUser,
  markRunEnded,
  upsertProject,
  type Db,
} from "@codegenie/db";
import { CANCEL_CHANNEL, type QueuedWork } from "@codegenie/shared";
import type { Queue } from "bullmq";
import type { Publisher } from "../events/sink.js";

// Until sign-in and the GitHub App exist (phase 3), projects enqueued by hand belong to a dev user.
export const DEV_USER = {
  id: "codegenie-dev-user",
  name: "CodeGenie dev",
  email: "dev@codegenie.local",
};
const DEV_INSTALLATION_ID = 0;

export type RepoInfo = {
  owner: string;
  repo: string;
  githubId: number;
  defaultBranch: string;
};

export async function ensureProject(db: Db, info: RepoInfo) {
  await ensureUser(db, DEV_USER);
  const installation = await ensureInstallation(db, {
    installationId: DEV_INSTALLATION_ID,
    accountLogin: "codegenie-dev",
    accountType: "user",
    installedByUserId: DEV_USER.id,
  });
  return upsertProject(db, {
    userId: DEV_USER.id,
    installationId: installation.id,
    repoGithubId: info.githubId,
    repoOwner: info.owner,
    repoName: info.repo,
    defaultBranch: info.defaultBranch,
  });
}

export async function enqueueRun(
  db: Db,
  queue: Queue,
  options: {
    project: { id: string; userId: string; defaultBranch: string };
    instruction: string;
    model: string;
  },
) {
  const { project, instruction } = options;
  const { task, run } = await createTaskWithRun(db, {
    task: {
      projectId: project.id,
      createdByUserId: project.userId,
      title: instruction.split("\n")[0]!.slice(0, 120),
      baseBranch: project.defaultBranch,
    },
    run: { trigger: "initial", model: options.model },
    message: { authorUserId: project.userId, content: instruction },
  });
  const data: QueuedWork["run-task"] = { runId: run.id };
  const job = await queue.add("run-task", data, { jobId: run.id });
  return { task, run, job };
}

/** At most one onboarding per project is queued or running; a later one is queued again. */
export async function enqueueOnboarding(queue: Queue, projectId: string) {
  const data: QueuedWork["onboard-project"] = { projectId };
  return queue.add("onboard-project", data, {
    deduplication: { id: `onboard-${projectId}` },
  });
}

/** A queued run is cancelled here; a running one is told to stop by the worker that has it. */
export async function cancelRun(db: Db, publisher: Publisher, runId: string) {
  if (await markRunEnded(db, runId, { status: "cancelled" }, ["queued"])) {
    return "cancelled";
  }
  await publisher.publish(CANCEL_CHANNEL, runId);
  return "signalled";
}
