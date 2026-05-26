import type { ApiResponse } from "@/types/base.types";

/** Standard success envelope (`docs/api/README.md`). */
export function ok(
  status: number,
  message: string,
  data: Record<string, unknown>,
): ApiResponse {
  return {
    status,
    message,
    type: "success",
    data,
  };
}
