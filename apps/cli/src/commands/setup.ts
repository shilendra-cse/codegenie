import { stat, writeFile } from "node:fs/promises";
import { autoChannel, runOnboarding } from "@codegenie/runner";
import { UsageError } from "../args/common.js";
import { parseSetupArgs, SETUP_USAGE } from "../args/setup-args.js";
import { intro, line, styleFor, type Style } from "@codegenie/terminal";
import { promptChannel } from "../channel/prompt.js";
import { terminalChannel } from "../channel/terminal.js";
import { loadModel } from "../config.js";
import { createLiveJob } from "../live-job.js";
import { formatSetupSummary, setupExitCode } from "../report.js";
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

  const style = styleFor(process.stdout);
  const live = createLiveJob(process.stdout, style);
  const info = (message: string) => showProgress(live, style, message);
  const channel = options.yes
    ? { ...autoChannel(info), close: () => {} }
    : process.stdin.isTTY && live.live.interactive
      ? promptChannel({
          pause: () => live.live.stop(),
          resume: () => live.live.start(),
          info,
        })
      : { ...terminalChannel(process.stdin, process.stdout), info };
  const where =
    options.source.type === "local" ? options.source.path : options.source.url;
  live.print(
    intro(
      style,
      `CodeGenie setup ${style.dim("·")} ${model.spec.id} ${style.dim("·")} ${where}`,
    ),
    line(style),
  );
  live.live.start();

  const result = await runOnboarding({
    runId: `setup-${Date.now().toString(36)}`,
    source: options.source,
    model,
    channel,
    emit: (event) => live.onEvent(event),
    signal: controller.signal,
  }).finally(() => {
    live.stop();
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
  out(formatSetupSummary(result, saved, style));
  return setupExitCode(result.status);
}

const MARK = /^(\s*)([✓✗⚠])/;

/** Onboarding's progress messages: shown in the gutter, the latest one beside the spinner. */
function showProgress(
  live: ReturnType<typeof createLiveJob>,
  style: Style,
  message: string,
) {
  const lines = message.split("\n");
  const first = lines.find((l) => l.trim()) ?? "";
  live.setActivity(first.replace(/[:…]$/, ""));
  live.print(
    ...lines.map((text) =>
      line(
        style,
        text.replace(
          MARK,
          (_, indent: string, mark: string) =>
            indent +
            (mark === "✓"
              ? style.ok(mark)
              : mark === "✗"
                ? style.fail(mark)
                : style.warn(mark)),
        ),
      ),
    ),
  );
}
