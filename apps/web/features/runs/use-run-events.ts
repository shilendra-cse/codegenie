import type { RunEvent } from "@hobai/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { taskKey } from "@/features/tasks/api";

/** Streamed but not stored: gone on reload, and replaced by the run's totals once it ends. */
export type RunLive = {
  /** What the agent has said since its last tool call. */
  reasoning: string;
  steps: number | null;
  costUsd: number | null;
};

const NO_LIVE: RunLive = { reasoning: "", steps: null, costUsd: null };
// Enough for the line under the activity; older text is never shown.
const MAX_REASONING = 1_000;
// These change what the task's own record shows (its stage, title, PR or status).
const CHANGES_TASK = new Set([
  "stage_changed",
  "task_titled",
  "pr_opened",
  "done",
]);

export const runEventsUrl = (runId: string) => `/api/runs/${runId}/events`;

/**
 * Follows one run's events: the stored ones first, then live. The browser reconnects with
 * Last-Event-ID by itself; the stream is closed once the run is done.
 */
export function useRunEvents(
  run: { id: string; taskId: string; ended: boolean } | undefined,
) {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [live, setLive] = useState<RunLive>(NO_LIVE);
  const ended = useRef(run?.ended ?? false);
  ended.current = run?.ended ?? false;
  const runId = run?.id;
  const taskId = run?.taskId;

  useEffect(() => {
    setEvents([]);
    setLive(NO_LIVE);
    if (!runId || !taskId) return;
    const source = new EventSource(runEventsUrl(runId), {
      withCredentials: true,
    });
    let lastSeq = 0;
    let done = false;
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: taskKey(taskId) });
      void queryClient.invalidateQueries({ queryKey: ["tasks", "list"] });
    };

    source.onmessage = (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as RunEvent;
      if (event.runId !== runId) return;
      if (event.type === "text_delta") {
        setLive((now) => ({
          ...now,
          reasoning: (now.reasoning + event.delta).slice(-MAX_REASONING),
        }));
        return;
      }
      if (event.type === "agent_step") {
        setLive((now) => ({
          ...now,
          steps: event.steps,
          costUsd: event.costUsd,
        }));
        return;
      }
      if (event.seq === undefined || event.seq <= lastSeq) return;
      lastSeq = event.seq;
      setEvents((all) => [...all, event]);
      if (event.type === "tool_start") {
        setLive((now) => ({ ...now, reasoning: "" }));
      }
      if (CHANGES_TASK.has(event.type)) refresh();
      if (event.type === "done") {
        done = true;
        source.close();
      }
    };
    // The server ends the stream when the run has ended; without a done event (e.g. cancelled
    // while queued) the browser would keep reconnecting, so ask whether it's over.
    source.onerror = () => {
      if (done || ended.current) source.close();
      else refresh();
    };
    return () => source.close();
  }, [runId, taskId, queryClient]);

  return { events, live };
}
