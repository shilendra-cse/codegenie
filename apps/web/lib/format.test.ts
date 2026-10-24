import { describe, expect, it } from "vitest";
import { formatDuration, timeAgo } from "./format";

const now = Date.parse("2026-10-23T12:00:00Z");
const ago = (seconds: number) => new Date(now - seconds * 1000).toISOString();

describe("timeAgo", () => {
  it.each([
    [10, "just now"],
    [5 * 60, "5 minutes ago"],
    [2 * 3600, "2 hours ago"],
    [23.9 * 3600, "23 hours ago"],
    [30 * 3600, "yesterday"],
    [3 * 86400, "3 days ago"],
    [8 * 86400, "last week"],
    [20 * 86400, "2 weeks ago"],
    [65 * 86400, "2 months ago"],
    [400 * 86400, "last year"],
  ])("%i seconds ago reads as %s", (seconds, text) => {
    expect(timeAgo(ago(seconds), now)).toBe(text);
  });
});

describe("formatDuration", () => {
  it.each([
    [0, "0s"],
    [14_400, "14s"],
    [92_000, "1m 32s"],
    [7 * 60_000 + 5_000, "7m 05s"],
    [65 * 60_000, "1h 05m"],
  ])("%i ms reads as %s", (ms, text) => {
    expect(formatDuration(ms)).toBe(text);
  });
});
