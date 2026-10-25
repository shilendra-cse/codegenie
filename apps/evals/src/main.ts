import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseEvalArgs, USAGE, UsageError } from "./args.js";
import { loadModel } from "./config.js";
import { RESULTS_DIR } from "./paths.js";
import { cost, duration, intro, outro, styleFor } from "@hobai/terminal";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { formatReport } from "./report.js";
import { EvalProgress } from "./run/progress.js";
import { attemptName, runEvals } from "./run/run-evals.js";
import { loadTasks } from "./suite/tasks.js";

const out = (line: string) => process.stdout.write(`${line}\n`);
const err = (line: string) => process.stderr.write(`${line}\n`);

async function main(): Promise<number> {
  let options;
  try {
    options = parseEvalArgs(process.argv.slice(2));
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    err(`${error.message}\n\n${USAGE}`);
    return 1;
  }
  if (options.help) {
    out(USAGE);
    return 0;
  }

  let model;
  let tasks;
  try {
    model = loadModel(options.model);
    tasks = await loadTasks({ tasks: options.tasks, repos: options.repos });
  } catch (error) {
    err(error instanceof Error ? error.message : String(error));
    return 1;
  }

  const startedAt = new Date();
  const resultsDir = path.join(
    RESULTS_DIR,
    startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19),
  );
  await mkdir(resultsDir, { recursive: true });
  const style = styleFor(process.stdout);
  out(
    `${intro(style, `${PRODUCT_NAME} evals · ${model.spec.id} · ${tasks.length} task${tasks.length === 1 ? "" : "s"}${options.repeat > 1 ? ` × ${options.repeat}` : ""}`)}\n`,
  );

  const names = tasks.flatMap((task) =>
    Array.from({ length: options.repeat }, (_, i) =>
      attemptName(task, i + 1, options.repeat),
    ),
  );
  const progress = new EvalProgress(process.stdout, {
    total: names.length,
    nameWidth: Math.max(
      ...names.map((n) => n.length),
      ...tasks.map((t) => t.repo.name.length),
    ),
    style,
  });
  progress.start();
  const results = await runEvals({
    tasks,
    model,
    repeat: options.repeat,
    concurrency: options.concurrency,
    refreshEnvironments: options.onboard,
    resultsDir,
    progress,
  }).finally(() => progress.stop());

  const report = formatReport(results, {
    model: model.spec.id,
    startedAt,
    durationMs: Date.now() - startedAt.getTime(),
    resultsDir,
  });
  await writeFile(
    path.join(resultsDir, "results.json"),
    `${JSON.stringify(results, null, 2)}\n`,
  );
  await writeFile(path.join(resultsDir, "report.md"), `${report}\n`);
  const solved = results.filter((r) => r.solved === true).length;
  const review = results.filter((r) => r.solved === null).length;
  const spent = results.reduce((sum, r) => sum + (r.agent?.costUsd ?? 0), 0);
  const where = path.relative(process.cwd(), resultsDir);
  out(
    `\n${outro(style, `${style.bold(`Solved ${solved} of ${results.length - review}`)}${review ? ` (${review} to review)` : ""} · ${cost(spent)} · ${duration(Date.now() - startedAt.getTime())}`)}`,
  );
  out(
    `  ${style.dim(`Report: ${where}/report.md · logs and diffs in ${where}/`)}`,
  );
  return 0;
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
