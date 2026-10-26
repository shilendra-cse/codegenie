import type { UsageResponse } from "@hobai/shared";
import { api } from "@/lib/api/client";

export const usageKey = ["usage"];

export async function fetchUsage() {
  const { data } = await api.get<UsageResponse>("/me/usage");
  return data;
}
