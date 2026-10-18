import type { UserChannel } from "@codegenie/shared";

/** For non-interactive runs (--yes, evals): always the recommended option. */
export function autoChannel(
  log: (message: string) => void = () => {},
): UserChannel {
  return {
    ask: async () => ({ option: 0, auto: true }),
    info: log,
  };
}
