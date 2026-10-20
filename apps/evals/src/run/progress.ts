import path from "node:path";
import type { RunEvent } from "@codegenie/shared";
import {
  clock,
  cost,
  duration,
  LiveArea,
  plural,
  spinnerFrame,
  type Style,
} from "@codegenie/terminal";
import type { TaskResult } from "./run-eval-task.js";

const STAGE: Record<string, string> = {
  prepare: "sandbox",
  checkout: "checkout",
  setup: "setup",
  agent: "agent",
  verify: "verify",
};
const HEARTBEAT_MS = 30_000;

type Running = {
  startedAt: number;
  stage: string;
  steps: number;
  costUsd: number;
  lastPrinted: number;
};

type Stream = NodeJS.WritableStream & { isTTY?: boolean };

/**
 * What the eval run shows while it works. In a terminal: one line per running task,
 * redrawn in place, with finished tasks listed above. Elsewhere: a line per stage
 * change, and a progress line every 30 seconds while an agent works.
 */
export class EvalProgress {
  private readonly running = new Map<string, Running>();
  private readonly live: LiveArea;
  private readonly startedAt: number;
  private done = 0;
  private totalCost = 0;
  private heartbeat: NodeJS.Timeout | null = null;

  constructor(
    stream: Stream,
    private readonly options: {
      total: number;
      nameWidth: number;
      style: Style;
      now?: () => number;
    },
  ) {
    this.startedAt = this.now();
    this.live = new LiveArea(stream, () => this.liveLines());
  }

  private now() {
    return (this.options.now ?? Date.now)();
  }

  private name(name: string) {
    return name.padEnd(this.options.nameWidth);
  }

  start() {
    this.live.start();
    if (!this.live.interactive) {
      this.heartbeat = setInterval(() => this.beat(), 5_000);
      this.heartbeat.unref();
    }
  }

  stop() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.live.stop();
  }

  info(message: string) {
    this.live.print(this.options.style.dim(message));
  }

  /** Something long-running that isn't a task, e.g. onboarding a repository. */
  activity(name: string, stage: string) {
    this.track(name, stage);
    if (!this.live.interactive)
      this.live.print(`  ${this.name(name)}  ${stage}`);
    return () => this.running.delete(name);
  }

  taskStarted(name: string, logFile: string) {
    const { style } = this.options;
    this.track(name, "starting");
    this.live.print(
      `${style.accent("▶")} ${this.name(name)}  ${style.dim(`log: ${path.relative(process.cwd(), logFile)}`)}`,
    );
  }

  taskEvent(name: string, event: RunEvent) {
    const task = this.running.get(name);
    if (!task) return;
    if (event.type === "stage_changed") {
      task.stage = STAGE[event.stage] ?? event.stage;
      task.lastPrinted = this.now();
      if (!this.live.interactive) {
        this.live.print(`  ${this.name(name)}  ${task.stage}`);
      }
    } else if (event.type === "agent_step") {
      task.steps = event.steps;
      task.costUsd = event.costUsd;
    }
  }

  taskFinished(name: string, result: TaskResult) {
    const { style } = this.options;
    this.running.delete(name);
    this.done += 1;
    this.totalCost += result.agent?.costUsd ?? 0;
    const mark =
      result.solved === null
        ? style.warn("?")
        : result.solved
          ? style.ok("✓")
          : style.fail("✗");
    const why = result.solved === false ? style.dim(`  ${reason(result)}`) : "";
    this.live.print(
      `${mark} ${this.name(name)}  ${duration(result.durationMs).padStart(7)}  ${cost(result.agent?.costUsd ?? 0)}${why}`,
    );
  }

  private track(name: string, stage: string) {
    const now = this.now();
    this.running.set(name, {
      startedAt: now,
      stage,
      steps: 0,
      costUsd: 0,
      lastPrinted: now,
    });
  }

  private describe(task: Running) {
    const agent =
      task.stage === "agent" && task.steps
        ? ` · ${plural(task.steps, "step")} · ${cost(task.costUsd)}`
        : "";
    return `${task.stage}${agent} · ${clock(this.now() - task.startedAt)}`;
  }

  private beat() {
    for (const [name, task] of this.running) {
      if (this.now() - task.lastPrinted < HEARTBEAT_MS) continue;
      task.lastPrinted = this.now();
      this.live.print(`  ${this.name(name)}  ${this.describe(task)}`);
    }
  }

  private liveLines() {
    const { style, total } = this.options;
    const lines = [...this.running].map(
      ([name, task]) =>
        `${style.accent(spinnerFrame(this.now()))} ${this.name(name)}  ${style.dim(this.describe(task))}`,
    );
    lines.push(
      "",
      style.dim(
        `${this.done} of ${total} done · ${this.running.size} running · ${cost(this.totalCost)} · ${clock(this.now() - this.startedAt)}`,
      ),
    );
    return lines;
  }
}

/** Why a task wasn't solved, in a few words. */
export function reason(result: TaskResult) {
  if (!result.agent) return `failed at ${result.run.failedStage ?? "start"}`;
  if (result.grade.passed && result.checks?.regressions) {
    return `${plural(result.checks.regressions, "check")} regressed`;
  }
  const first = result.grade.detail.split("\n")[0] ?? "";
  return first.replace(/:$/, "").toLowerCase();
}
