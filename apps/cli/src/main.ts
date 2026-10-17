import { readFile, stat, writeFile } from "node:fs/promises";
import { resolveModel } from "@codegenie/agent";
import { parseEnvironmentConfig, runJob } from "@codegenie/runner";
import { parseCliArgs, USAGE, UsageError } from "./args.js";
import { loadEnvFile, parseConfig } from "./config.js";
import { createLiveReporter, exitCode, formatSummary } from "./report.js";

const out = (line: string) => process.stdout.write(`${line}\n`);
const err = (line: string) => process.stderr.write(`${line}\n`);

async function main(): Promise<number> {
  // pnpm runs the script inside apps/cli; INIT_CWD is where the user ran it.
  const cwd = process.env.INIT_CWD ?? process.cwd();

  let options;
  try {
    options = parseCliArgs(process.argv.slice(2), cwd);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    err(`${error.message}\n\n${USAGE}`);
    return 1;
  }
  if (options.help) {
    out(USAGE);
    return 0;
  }

  loadEnvFile();
  let model;
  try {
    const config = parseConfig(process.env);
    model = resolveModel(options.model ?? config.model);
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

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    err(
      error instanceof Error ? (error.stack ?? error.message) : String(error),
    );
    process.exit(1);
  },
);
