import { failLostOnboardings } from "./lost-onboardings.js";
import { failLostRuns, type LostRunsDeps } from "./lost-runs.js";

export async function handleReap(deps: LostRunsDeps) {
  const lost = await failLostRuns(deps);
  const lostOnboardings = await failLostOnboardings(deps);
  deps.log("info", "Reaped", {
    lostRuns: lost.length,
    lostOnboardings: lostOnboardings.length,
  });
}
