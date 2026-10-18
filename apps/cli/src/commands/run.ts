import { readFile, stat, writeFile } from "node:fs/promises";
import { parseEnvironmentConfig, runJob } from "@codegenie/runner";
import { UsageError } from "../args/common.js";
import { parseCliArgs, RUN_USAGE } from "../args/run-args.js";
import { loadModel } from "../config.js";
import { createLiveReporter, exitCode, formatSummary } from "../report.js";
import { err, out } from "./output.js";

export async function runCommand(argv: string[], cwd: string): Promise<number> {
  let options;
  try {
    options = parseCliArgs(argv, cwd);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    err(`${error.message}\n\n${RUN_USAGE}`);
    return 1;
  }
  if (options.help) {
    out(RUN_USAGE);
    return 0;
  }

  let model;
  try {
    model = loadModel(options.model);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    err(error.message);
    return 1;
  }

  if (options.source.type === "local") {
    const info = await stat(options.source.path).catch(() => null);
    if (!info?.isDirectory()) {
      err(`Not a folder: ${options.source.path}`);
      return 1;
    }
  }
  let environment;
  if (options.environmentPath) {
    try {
      environment = parseEnvironmentConfig(
        JSON.parse(await readFile(options.environmentPath, "utf8")),
      );
    } catch (error) {
      err(
        `Can't use ${options.environmentPath}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return 1;
    }
  }

  const task =
    "text" in options.task
      ? options.task.text
      : await readFile(options.task.file, "utf8");

  const controller = new AbortController();
  process.on("SIGINT", () => {
    if (controller.signal.aborted) process.exit(130);
    err("\nCancelling… (Ctrl+C again to force quit)");
    controller.abort();
  });

  const live = options.json ? null : createLiveReporter(out);
  if (live) {
    const where =
      options.source.type === "local"
        ? options.source.path
        : options.source.url;
    out(`CodeGenie · ${model.spec.id} · ${where}`);
    out(`Task: ${task.trim()}\n`);
  }

  const result = await runJob({
    runId: `cli-${Date.now().toString(36)}`,
    task,
    source: options.source,
    model,
    limits: options.limits,
    environment,
    setupOverrides: Object.keys(options.setupOverrides).length
      ? options.setupOverrides
      : undefined,
    baselineChecks: options.baselineChecks,
    emit: (event) => live?.onEvent(event),
    signal: controller.signal,
    keepSandbox: options.keep,
  });
  live?.flush();

  if (options.patchPath && result.diff) {
    await writeFile(options.patchPath, result.diff.patch);
  }
  if (options.saveEnvironmentPath && result.setup) {
    await writeFile(
      options.saveEnvironmentPath,
      `${JSON.stringify(result.setup.config, null, 2)}\n`,
    );
  }

  if (options.json) {
    const { agent, ...rest } = result;
    out(
      JSON.stringify(
        agent ? { ...rest, agent: { ...agent, messages: undefined } } : rest,
        null,
        2,
      ),
    );
  } else {
    out(
      formatSummary(result, {
        patchPath: options.patchPath,
        environmentPath: options.saveEnvironmentPath,
      }),
    );
    if (options.keep && result.sandboxId) {
      out(
        `\nSandbox kept: docker exec -it ${result.sandboxId} bash  (remove with pnpm sandbox:clean)`,
      );
    }
  }
  return exitCode(result.status);
}
