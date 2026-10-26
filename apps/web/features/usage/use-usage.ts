import { useQuery } from "@tanstack/react-query";
import { fetchUsage, usageKey } from "./api";

/** Your plan and the runs used this cycle. */
export function useUsage() {
  return useQuery({ queryKey: usageKey, queryFn: fetchUsage });
}
