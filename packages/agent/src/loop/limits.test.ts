import { describe, expect, it } from "vitest";
import { DEFAULT_LIMITS, describeLimit } from "./limits.js";

describe("describeLimit", () => {
  it("tells the model which limit it reached", () => {
    const limits = { maxSteps: 150, maxWallTimeMs: 30 * 60_000, maxCostUsd: 2 };
    expect(describeLimit("steps", limits)).toBe(
      "You have used the maximum of 150 steps.",
    );
    expect(describeLimit("time", limits)).toBe(
      "You have reached the time limit of 30 minutes.",
    );
    expect(describeLimit("cost", limits)).toBe(
      "You have reached the cost limit of $2.00.",
    );
  });
});

describe("DEFAULT_LIMITS", () => {
  it("matches the MVP requirements", () => {
    expect(DEFAULT_LIMITS).toEqual({
      maxSteps: 150,
      maxWallTimeMs: 30 * 60_000,
      maxCostUsd: 2,
    });
  });
});
