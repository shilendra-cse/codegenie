import { createDb } from "@codegenie/db";
import { createGithubApp, type GithubApp } from "@codegenie/github";
import { WORK_QUEUE } from "@codegenie/shared";
import { Queue } from "bullmq";
import { config as loadDotenv } from "dotenv";
import { Redis } from "ioredis";
import { ConfigError, ENV_FILE, parseConfig } from "../config.js";
import {
  cancelRun,
  enqueueOnboarding,
  enqueueRun,
  ensureProject,
  InstallationNotRecordedError,
} from "./work.js";

const USAGE = `Usage:
  pnpm worker:enqueue onboard <owner/repo>
  pnpm worker:enqueue run <owner/repo> "<task>"
  pnpm worker:enqueue cancel <runId>`;

class UsageError extends Error {}

async function lookUpRepo(app: GithubApp, fullName: string | undefined) {
  const [owner, repo] = fullName?.split("/") ?? [];
  if (!owner || !repo || !/^[\w.-]+\/[\w.-]+$/.test(fullName ?? "")) {
    throw new UsageError(`Expected <owner/repo>, got "${fullName ?? ""}".`);
  }
  const found = await app.findInstalledRepo(owner, repo);
  if (!found) {
    throw new UsageError(
      `The GitHub App isn't installed on ${fullName}. Install it: https://github.com/apps/${await app.slug()}/installations/new`,
    );
  }
  return found;
}

async function main() {
  const [command, target, instruction] = process.argv.slice(2);
  loadDotenv({ path: ENV_FILE, quiet: true });
  const config = parseConfig(process.env);
  const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null });
  const queue = new Queue(WORK_QUEUE, { connection: redis });
  const { db, pool } = createDb(config.databaseUrl);
  const github = createGithubApp(config.github);

  try {
    switch (command) {
      case "onboard": {
        const project = await ensureProject(
          db,
          await lookUpRepo(github, target),
        );
        await enqueueOnboarding(queue, project.id);
        console.log(
          `Queued onboarding of ${project.repoOwner}/${project.repoName} (project ${project.id}).`,
        );
        return;
      }
      case "run": {
        if (!instruction) throw new UsageError("The task is missing.");
        const project = await ensureProject(
          db,
          await lookUpRepo(github, target),
        );
        const { run } = await enqueueRun(db, queue, {
          project,
          instruction,
          model: config.model,
        });
        console.log(
          `Queued run ${run.id} on ${project.repoOwner}/${project.repoName}.\nCancel it with: pnpm worker:enqueue cancel ${run.id}`,
        );
        return;
      }
      case "cancel": {
        if (!target) throw new UsageError("The run id is missing.");
        const outcome = await cancelRun(db, redis, target);
        console.log(
          outcome === "cancelled"
            ? `Run ${target} was still queued; it's cancelled.`
            : `Asked the worker running ${target} to stop.`,
        );
        return;
      }
      default:
        throw new UsageError(
          command ? `Unknown command "${command}".` : "No command.",
        );
    }
  } finally {
    await queue.close();
    await redis.quit();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  if (error instanceof UsageError) {
    console.error(`${error.message}\n\n${USAGE}`);
  } else if (error instanceof InstallationNotRecordedError) {
    console.error(error.message);
  } else if (error instanceof ConfigError) {
    console.error(`Invalid worker configuration:\n${error.message}`);
  } else {
    console.error(error);
  }
  process.exit(1);
});
