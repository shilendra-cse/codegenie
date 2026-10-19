import type { JobEvent } from "@codegenie/shared";
import {
  clock,
  cost,
  createJobReporter,
  LiveArea,
  plural,
  spinnerFrame,
  type Style,
} from "@codegenie/terminal";

const STAGE_LABEL: Record<string, string> = {
  prepare: "Starting a sandbox",
  checkout: "Checking out",
  setup: "Setting up",
  agent: "Agent working",
  verify: "Verifying",
};

type Stream = NodeJS.WritableStream & { isTTY?: boolean };

/**
 * Live output for a job or an onboarding: event lines above, and in a terminal a
 * spinner line below with what's happening now (steps and cost while the agent works).
 */
export function createLiveJob(stream: Stream, style: Style) {
  let activity: string | null = null;
  let since = Date.now();
  let steps = 0;
  let spent = 0;

  const live = new LiveArea(stream, () => {
    if (!activity) return [];
    const agent = steps ? ` · ${plural(steps, "step")} · ${cost(spent)}` : "";
    return [
      `${style.accent(spinnerFrame())} ${activity}${style.dim(`${agent} · ${clock(Date.now() - since)}`)}`,
    ];
  });
  const reporter = createJobReporter((text) => live.print(text), style);

  const setActivity = (label: string | null) => {
    activity = label;
    since = Date.now();
    steps = 0;
    spent = 0;
  };

  return {
    live,
    print: (...lines: string[]) => live.print(...lines),
    setActivity,
    onEvent(event: JobEvent) {
      if (event.type === "stage_changed") {
        setActivity(STAGE_LABEL[event.stage] ?? event.stage);
      } else if (event.type === "agent_step") {
        steps = event.steps;
        spent = event.costUsd;
      }
      reporter.onEvent(event);
    },
    stop() {
      reporter.flush();
      live.stop();
    },
  };
}
