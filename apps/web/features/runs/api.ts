import type { CancelOutcome } from "@hobai/shared";
import { api } from "@/lib/api/client";

export async function cancelRun(runId: string) {
  const { data } = await api.post<{ outcome: CancelOutcome }>(
    `/runs/${runId}/cancel`,
  );
  return data.outcome;
}
