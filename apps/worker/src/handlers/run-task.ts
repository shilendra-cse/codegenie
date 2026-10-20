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
  createRunRecord,
  runFailure,
  RunStateError,
  type RunRecord,
} from "../runs/run-record.js";
import type { Log } from "../lib/log.js";
import type { SandboxFactory } from "../lib/sandbox-factory.js";

export type RunTaskDeps = {
  db: Db;
  publisher: Publisher;
  log: Log;
  createSandbox: SandboxFactory;
} & Pick<RunTaskOptions, "model" | "limits">;

async function loadRun(db: Db, runId: string) {
  const run = await db.query.runs.findFirst({
    where: eq(runs.id, runId),
    with: { task: { with: { project: true } } },
  });
  if (!run) throw new Error(`Run ${runId} doesn't exist.`);
  const message = await db.query.messages.findFirst({
    where: and(eq(messages.runId, runId), eq(messages.role, "user")),
    orderBy: desc(messages.createdAt),
  });
  return { ...run, instruction: message?.content ?? run.task.title };
}

async function endRun(
  deps: Pick<RunTaskDeps, "log">,
  run: {
    id: string;
    emit: (event: RunEvent) => void;
    record: RunRecord;
    sink: EventSink;
  },
  result: RunResult,
) {
  const ts = new Date().toISOString();
  const failure = runFailure(result);
  if (result.status === "failed" && failure) {
    run.emit({ type: "error", runId: run.id, ts, ...failure });
  }
  run.emit({ type: "done", runId: run.id, ts, status: result.status });

  await run.record.flush();
  try {
    await run.sink.flush();
  } catch (error) {
    deps.log("warn", "Some run events weren't saved or published", {
      runId: run.id,
      error: String(error),
    });
  }
  if (!(await run.record.finish(result))) {
    deps.log(
      "warn",
      "The run was ended elsewhere; its result wasn't recorded",
      {
        runId: run.id,
        status: result.status,
      },
    );
  }
}

export async function handleRunTask(
  deps: RunTaskDeps,
  { runId }: QueuedWork["run-task"],
  signal?: AbortSignal,
): Promise<RunResult | null> {
  const { db } = deps;
  const run = await loadRun(db, runId);
  const { project } = run.task;
  const record = createRunRecord(db, runId);
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
    if (!(error instanceof RunStateError)) throw error;
    deps.log("warn", "Skipping a run that isn't queued", { runId });
    return null;
  }

  const sink = createEventSink({ db, publisher: deps.publisher }, runId);
  const emit = (event: RunEvent) => {
    sink.emit(event);
    record.observe(event);
  };

  let result: RunResult;
  try {
    result = await runTask({
      runId,
      task: run.instruction,
      source: {
        type: "git",
        url: `https://github.com/${project.repoOwner}/${project.repoName}.git`,
        ref: run.task.baseBranch,
      },
      model: deps.model,
      limits: deps.limits,
      environment: environment.config,
      createSandbox: () => deps.createSandbox({ kind: "run", runId }),
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

  await endRun(deps, { id: runId, emit, record, sink }, result);
  if (result.setup?.health === "needs_attention") {
    await environments.markHealth(
      project.id,
      "needs_attention",
      result.setup.healthReasons,
    );
  }
  deps.log("info", "Run finished", {
    runId,
    status: result.status,
    steps: result.agent?.steps ?? 0,
    costUsd: result.agent?.usage.costUsd ?? 0,
  });
  return result;
}
