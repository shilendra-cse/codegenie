import { readFile, stat, writeFile } from "node:fs/promises";
import { parseEnvironmentConfig, runTask } from "@hobai/runner";
import { UsageError } from "../args/common.js";
import { parseCliArgs, RUN_USAGE } from "../args/run-args.js";
import type { StoredEnvironment } from "@hobai/shared";
import { intro, line, oneLine, styleFor } from "@hobai/terminal";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { loadModel } from "../config.js";
import { createLiveRun } from "../live-run.js";
import { FileEnvironmentStore } from "../store/file-store.js";
import { repoKey } from "../store/repo-key.js";
import {
  healthWarning,
  missingEnvironment,
  versionLine,
} from "../store/saved-environment.js";
import { exitCode, formatSummary } from "../report.js";
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

  const style = styleFor(process.stdout);
  if (options.source.type === "local") {
    const info = await stat(options.source.path).catch(() => null);
    if (!info?.isDirectory()) {
      err(`Not a folder: ${options.source.path}`);
      return 1;
    }
  }

  // A task needs the repository's environment: the saved one, or an explicit file.
  const store = new FileEnvironmentStore();
  const key = await repoKey(options.source);
  let environment;
  let stored: StoredEnvironment | null = null;
  if (!options.environmentPath) {
    try {
      stored = await store.load(key);
    } catch (error) {
      err(error instanceof Error ? error.message : String(error));
      return 1;
    }
    if (!stored) {
      err(missingEnvironment(style, key, options.source));
      return 1;
    }
    environment = stored.config;
  } else {
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

  let model;
  try {
    model = loadModel(options.model);
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    err(error.message);
    return 1;
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

  const live = options.json ? null : createLiveRun(process.stdout, style);
  if (live) {
    const where =
      options.source.type === "local"
        ? options.source.path
        : options.source.url;
    live.print(
      intro(
        style,
        `${PRODUCT_NAME} ${style.dim("·")} ${model.spec.id} ${style.dim("·")} ${where}`,
      ),
      line(style, `Task: ${oneLine(task, 300)}`),
      line(
        style,
        style.dim(
          `Environment: ${stored ? versionLine(stored) : options.environmentPath}`,
        ),
      ),
      ...(stored ? healthWarning(style, stored) : []),
      line(style),
    );
    live.live.start();
  }

  const result = await runTask({
    runId: `cli-${Date.now().toString(36)}`,
    task,
    source: options.source,
    model,
    limits: options.limits,
    environment,
    baselineChecks: options.baselineChecks,
    emit: (event) => live?.onEvent(event),
    signal: controller.signal,
    keepSandbox: options.keep,
  });
  live?.stop();

  if (options.patchPath && result.diff) {
    await writeFile(options.patchPath, result.diff.patch);
  }
  if (stored && result.setup?.health === "needs_attention") {
    await store.markHealth(key, "needs_attention", result.setup.healthReasons);
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
        style,
        patchPath: options.patchPath,
      }),
    );
    if (options.keep && result.sandboxId) {
      out(
        `\n${style.dim(`Sandbox kept: docker exec -it ${result.sandboxId} bash  (remove with pnpm sandbox:clean)`)}`,
      );
    }
  }
  return exitCode(result.status);
}
