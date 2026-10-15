import { tool } from "ai";
import { z } from "zod";
import { wrapWithLog } from "../core/output-log.js";
import { truncateForModel } from "../../lib/truncate.js";
import { CHECK_NAMES, type Check } from "@codegenie/shared";
import type { ToolContext } from "../core/context.js";
import { runChecksDescription } from "./description.js";
import { runTool } from "../core/run-tool.js";

const CHECK_TIMEOUT_MS = 10 * 60_000;
/** Per failing check; the end of the output matters most, so it gets 80%. */
const FAILURE_OUTPUT_CHARS = 6_000;

export const runChecksInput = z.object({
  only: z
    .array(z.enum(CHECK_NAMES))
    .optional()
    .describe('Run only these checks, e.g. ["test"]'),
});

type CheckResult = {
  check: Check;
  label: string;
  passed: boolean;
  timedOut: boolean;
  exitCode: number;
  seconds: number;
  output: string;
  logPath: string;
};

export async function runChecks(
  ctx: ToolContext,
  input: z.input<typeof runChecksInput>,
) {
  const { only } = runChecksInput.parse(input);
  // Run in the canonical order (lint, typecheck, test, build).
  const selected = CHECK_NAMES.flatMap((name) =>
    ctx.checks.filter(
      (check) => check.name === name && (!only || only.includes(name)),
    ),
  );
  // Several checks with the same name (e.g. tests in web/ and api/) are labelled by folder.
  const label = (check: Check) =>
    ctx.checks.filter((c) => c.name === check.name).length > 1
      ? `${check.name} (${check.cwd})`
      : check.name;
  if (selected.length === 0) {
    return only
      ? `None of the requested checks (${only.join(", ")}) are configured for this repository.`
      : "No check commands were detected for this repository. Inspect package.json and run checks with bash.";
  }

  const results: CheckResult[] = [];
  for (const check of selected) {
    const logPath = ctx.outputLog.nextPath(`check-${check.name}`);
    const started = Date.now();
    const result = await ctx.sandbox.exec(wrapWithLog(check.command, logPath), {
      timeoutMs: CHECK_TIMEOUT_MS,
      cwd: check.cwd,
    });
    results.push({
      check,
      label: label(check),
      passed: result.exitCode === 0 && !result.timedOut,
      timedOut: result.timedOut,
      exitCode: result.exitCode,
      seconds: (Date.now() - started) / 1000,
      output: [result.stdout, result.stderr].filter(Boolean).join("\n"),
      logPath,
    });
  }

  const summary = results.map((r) => {
    const status = r.passed
      ? "passed"
      : r.timedOut
        ? "timed out"
        : `failed (exit ${r.exitCode})`;
    return `${r.passed ? "✓" : "✗"} ${r.label}: ${status} in ${r.seconds.toFixed(1)}s — ${r.check.command}`;
  });

  const failures = results
    .filter((r) => !r.passed)
    .map((r) => {
      const tail = truncateForModel(r.output.trimEnd(), {
        maxChars: FAILURE_OUTPUT_CHARS,
        headRatio: 0.2,
      });
      return `--- ${r.label} output (full log: ${r.logPath}) ---\n${tail.text || "(no output)"}`;
    });

  const failed = results.length - results.filter((r) => r.passed).length;
  const verdict =
    failed === 0
      ? "All checks passed."
      : `${failed} of ${results.length} checks failed.`;

  return [...summary, verdict, ...failures].join("\n");
}

export const runChecksTool = (ctx: ToolContext) =>
  tool({
    description: runChecksDescription,
    inputSchema: runChecksInput,
    execute: (input) => runTool(() => runChecks(ctx, input)),
  });
