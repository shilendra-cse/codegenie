import {
  createTaskWithRun,
  getInstallation,
  markRunEnded,
  upsertProject,
  type Db,
} from "@codegenie/db";
import type { InstalledRepo } from "@codegenie/github";
import { CANCEL_CHANNEL, type QueuedWork } from "@codegenie/shared";
import type { Queue } from "bullmq";
import type { Publisher } from "../events/sink.js";

export class InstallationNotRecordedError extends Error {}

export async function ensureProject(db: Db, repo: InstalledRepo) {
  const installation = await getInstallation(db, repo.installationId);
  if (!installation || installation.uninstalledAt) {
    throw new InstallationNotRecordedError(
      `The GitHub App's installation for ${repo.owner}/${repo.name} isn't recorded here yet: sign in at the web app and install it from there.`,
    );
  }
  return upsertProject(db, {
    userId: installation.installedByUserId,
    installationId: installation.id,
    repoGithubId: repo.id,
    repoOwner: repo.owner,
    repoName: repo.name,
    defaultBranch: repo.defaultBranch,
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
