import type { Log } from "./log.js";

export type StopSignalOptions = {
  /** Stops taking new work and resolves once the work in progress is done. */
  stop: () => Promise<void>;
  log: Log;
  exit?: (code: number) => void;
  now?: () => number;
};

/**
 * The first signal stops after the work in progress. Only a second Ctrl-C stops now: Docker ends
 * a stop with SIGKILL anyway, so a repeated SIGTERM must never cut the users' runs short.
 */
export function createStopHandler({
  stop,
  log,
  exit = (code) => process.exit(code),
  now = Date.now,
}: StopSignalOptions) {
  let stoppingSince: number | null = null;
  return async (signal: NodeJS.Signals) => {
    if (stoppingSince !== null) {
      if (signal !== "SIGINT") return;
      // Wrappers like pnpm pass a Ctrl-C on as well, so the same press can arrive twice within milliseconds.
      if (now() - stoppingSince < 1000) return;
      log("warn", "Stopping now; work in progress is left to the reaper", {
        signal,
      });
      exit(1);
      return;
    }
    stoppingSince = now();
    log("info", "Stopping after the work in progress", { signal });
    await stop();
    log("info", "Worker stopped");
  };
}
