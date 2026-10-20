import { DbEnvironmentStore, runs, messages, type Db } from "@codegenie/db";
import {
  runTask,
  type RunResult,
  type RunTaskOptions,
} from "@codegenie/runner";
import type { RunEvent, QueuedWork } from "@codegenie/shared";
import { and, desc, eq } from "drizzle-orm";
import {
  createEventSink,
  type EventSink,
  type Publisher,
} from "../events/sink.js";
import {
  createJobRecord,
  jobFailure,
  JobStateError,
  type JobRecord,
} from "../jobs/job-record.js";
import type { Log } from "../lib/log.js";

export type RunJobDeps = {
  db: Db;
  publisher: Publisher;
  log: Log;
} & Pick<RunTaskOptions, "model" | "limits" | "createSandbox">;

async function loadJob(db: Db, jobId: string) {
  const job = await db.query.runs.findFirst({
    where: eq(runs.id, jobId),
    with: { task: { with: { project: true } } },
  });
  if (!job) throw new Error(`Job ${jobId} doesn't exist.`);
  const message = await db.query.messages.findFirst({
    where: and(eq(messages.runId, jobId), eq(messages.role, "user")),
    orderBy: desc(messages.createdAt),
  });
  return { ...job, instruction: message?.content ?? job.task.title };
}

async function endJob(
  deps: Pick<RunJobDeps, "log">,
  job: {
    id: string;
    emit: (event: RunEvent) => void;
    record: JobRecord;
    sink: EventSink;
  },
  result: RunResult,
) {
  const ts = new Date().toISOString();
  const failure = jobFailure(result);
  if (result.status === "failed" && failure) {
    job.emit({ type: "error", runId: job.id, ts, ...failure });
  }
  job.emit({ type: "done", runId: job.id, ts, status: result.status });

  await job.record.flush();
  try {
    await job.sink.flush();
  } catch (error) {
    deps.log("warn", "Some job events weren't saved or published", {
      runId: job.id,
      error: String(error),
    });
  }
  if (!(await job.record.finish(result))) {
    deps.log(
      "warn",
      "The job was ended elsewhere; its result wasn't recorded",
      {
        runId: job.id,
        status: result.status,
      },
    );
  }
}

export async function handleRunJob(
  deps: RunJobDeps,
  { runId: jobId }: QueuedWork["run-task"],
  signal?: AbortSignal,
): Promise<RunResult | null> {
  const { db } = deps;
  const job = await loadJob(db, jobId);
  const { project } = job.task;
  const record = createJobRecord(db, jobId);
  const environments = new DbEnvironmentStore(db);

  const environment = await environments.load(project.id);
  if (!environment) {
    await record.fail({
      code: "no_environment",
      message: `${project.repoOwner}/${project.repoName} hasn't been set up yet; onboard the project first.`,
    });
    return null;
  }
  try {
    await record.start(environment.id);
  } catch (error) {
    if (!(error instanceof JobStateError)) throw error;
    deps.log("warn", "Skipping a job that isn't queued", { jobId });
    return null;
  }

  const sink = createEventSink({ db, publisher: deps.publisher }, jobId);
  const emit = (event: RunEvent) => {
    sink.emit(event);
    record.observe(event);
  };

  let result: RunResult;
  try {
    result = await runTask({
      runId: jobId,
      task: job.instruction,
      source: {
        type: "git",
        url: `https://github.com/${project.repoOwner}/${project.repoName}.git`,
        ref: job.task.baseBranch,
      },
      model: deps.model,
      limits: deps.limits,
      environment: environment.config,
      createSandbox: deps.createSandbox,
      emit,
      signal,
    });
  } catch (error) {
    await record.fail({
      code: "worker_error",
      message: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  await endJob(deps, { id: jobId, emit, record, sink }, result);
  if (result.setup?.health === "needs_attention") {
    await environments.markHealth(
      project.id,
      "needs_attention",
      result.setup.healthReasons,
    );
  }
  return result;
}
