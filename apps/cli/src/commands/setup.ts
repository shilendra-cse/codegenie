import { stat, writeFile } from "node:fs/promises";
import { autoChannel, runOnboarding } from "@codegenie/runner";
import { UsageError } from "../args/common.js";
import { parseSetupArgs, SETUP_USAGE } from "../args/setup-args.js";
import { terminalChannel } from "../channel/terminal.js";
import { loadModel } from "../config.js";
import {
  createLiveReporter,
  formatSetupSummary,
  setupExitCode,
} from "../report.js";
import { err, out } from "./output.js";

export async function setupCommand(
  argv: string[],
  cwd: string,
): Promise<number> {
  let options;
  try {
    options = parseSetupArgs(argv, cwd);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    err(`${error.message}\n\n${SETUP_USAGE}`);
    return 1;
  }
  if (options.help) {
    out(SETUP_USAGE);
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

  const controller = new AbortController();
  process.on("SIGINT", () => {
    if (controller.signal.aborted) process.exit(130);
    err("\nCancelling… (Ctrl+C again to force quit)");
    controller.abort();
  });

  const channel = options.yes
    ? { ...autoChannel(out), close: () => {} }
    : terminalChannel(process.stdin, process.stdout);
  const live = createLiveReporter(out);
  const where =
    options.source.type === "local" ? options.source.path : options.source.url;
  out(`CodeGenie setup · ${model.spec.id} · ${where}\n`);

  const result = await runOnboarding({
    runId: `setup-${Date.now().toString(36)}`,
    source: options.source,
    model,
    channel,
    emit: (event) => live.onEvent(event),
    signal: controller.signal,
  }).finally(() => {
    live.flush();
    channel.close();
  });

  let saved: string | null = null;
  if (result.status === "approved" && result.config) {
    await writeFile(
      options.savePath,
      `${JSON.stringify(result.config, null, 2)}\n`,
    );
    saved = options.savePath;
  }
  out(formatSetupSummary(result, saved));
  return setupExitCode(result.status);
}
