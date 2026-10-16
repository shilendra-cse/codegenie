export type AgentLimits = {
  maxSteps: number;
  maxWallTimeMs: number;
  maxCostUsd: number;
};

export const DEFAULT_LIMITS: AgentLimits = {
  maxSteps: 150,
  maxWallTimeMs: 30 * 60_000,
  maxCostUsd: 2,
};

export type LimitReached = "steps" | "time" | "cost";

export function describeLimit(limit: LimitReached, limits: AgentLimits) {
  switch (limit) {
    case "steps":
      return `You have used the maximum of ${limits.maxSteps} steps.`;
    case "time":
      return `You have reached the time limit of ${Math.round(limits.maxWallTimeMs / 60_000)} minutes.`;
    case "cost":
      return `You have reached the cost limit of $${limits.maxCostUsd.toFixed(2)}.`;
  }
}
