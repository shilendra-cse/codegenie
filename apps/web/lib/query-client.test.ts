import { describe, expect, it } from "vitest";
import { ApiError } from "./api/client";
import { shouldRetry } from "./query-client";

describe("shouldRetry", () => {
  it("doesn't retry a request the API refused", () => {
    expect(shouldRetry(0, new ApiError(404, "Project not found."))).toBe(false);
    expect(shouldRetry(0, new ApiError(409, "Busy."))).toBe(false);
  });

  it("retries server errors and network failures twice", () => {
    expect(shouldRetry(0, new ApiError(503, "Unavailable."))).toBe(true);
    expect(shouldRetry(1, new ApiError(0, "Offline."))).toBe(true);
    expect(shouldRetry(2, new ApiError(0, "Offline."))).toBe(false);
  });
});
