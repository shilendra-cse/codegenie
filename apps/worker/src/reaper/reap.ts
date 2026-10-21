import { failLostRuns, type LostRunsDeps } from "./lost-runs.js";

export async function handleReap(deps: LostRunsDeps) {
  const lost = await failLostRuns(deps);
  deps.log("info", "Reaped", { lostRuns: lost.length });
}
