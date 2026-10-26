/** `GET /me/usage`: the signed-in user's plan and how much of it this cycle has used. */
export type UsageResponse = {
  plan: { slug: string; name: string };
  /** `limit` is null on a plan without one. */
  runs: { used: number; limit: number | null };
  concurrentRuns: number;
  periodStart: string;
  resetsAt: string;
};
