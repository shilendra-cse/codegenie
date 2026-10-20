import {
  githubInstallations,
  messages,
  projects,
  runs,
  tasks,
  user,
  type Db,
} from "@codegenie/db";
import { CANCEL_CHANNEL, type QueuedWork } from "@codegenie/shared";
import type { Queue } from "bullmq";
import { and, eq } from "drizzle-orm";
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
  await db.insert(user).values(DEV_USER).onConflictDoNothing();
  await db
    .insert(githubInstallations)
    .values({
      installationId: DEV_INSTALLATION_ID,
      accountLogin: "codegenie-dev",
      accountType: "user",
      installedByUserId: DEV_USER.id,
    })
    .onConflictDoNothing();
  const [installation] = await db
    .select({ id: githubInstallations.id })
    .from(githubInstallations)
    .where(eq(githubInstallations.installationId, DEV_INSTALLATION_ID));
  const repo = {
    repoOwner: info.owner,
    repoName: info.repo,
    defaultBranch: info.defaultBranch,
  };
  const [project] = await db
    .insert(projects)
    .values({
      userId: DEV_USER.id,
      installationId: installation!.id,
      repoGithubId: info.githubId,
      ...repo,
    })
    .onConflictDoUpdate({
      target: [projects.userId, projects.repoGithubId],
      set: { ...repo, updatedAt: new Date() },
    })
    .returning();
  return project!;
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
  const { task, run } = await db.transaction(async (tx) => {
    const [task] = await tx
      .insert(tasks)
      .values({
        projectId: project.id,
        createdByUserId: project.userId,
        title: instruction.split("\n")[0]!.slice(0, 120),
        baseBranch: project.defaultBranch,
      })
      .returning();
    const [run] = await tx
      .insert(runs)
      .values({ taskId: task!.id, trigger: "initial", model: options.model })
      .returning();
    await tx.insert(messages).values({
      taskId: task!.id,
      runId: run!.id,
      role: "user",
      authorUserId: project.userId,
      content: instruction,
    });
    return { task: task!, run: run! };
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
  const cancelled = await db
    .update(runs)
    .set({ status: "cancelled", finishedAt: new Date() })
    .where(and(eq(runs.id, runId), eq(runs.status, "queued")))
    .returning({ id: runs.id });
  if (cancelled.length > 0) return "cancelled";
  await publisher.publish(CANCEL_CHANNEL, runId);
  return "signalled";
}
