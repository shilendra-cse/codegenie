import { describe, expect, it } from "vitest";
import { cycleAt } from "./cycle.js";

const at = (iso: string) => new Date(iso);

describe("cycleAt", () => {
  it("runs a month from the anchor", () => {
    expect(
      cycleAt(at("2026-10-25T09:30:00Z"), at("2026-11-02T00:00:00Z")),
    ).toEqual({
      start: at("2026-10-25T09:30:00Z"),
      end: at("2026-11-25T09:30:00Z"),
    });
  });

  it("moves to the next cycle exactly when one ends", () => {
    expect(
      cycleAt(at("2026-10-25T09:30:00Z"), at("2026-11-25T09:30:00Z")).start,
    ).toEqual(at("2026-11-25T09:30:00Z"));
    expect(
      cycleAt(at("2026-10-25T09:30:00Z"), at("2026-11-25T09:29:59Z")).start,
    ).toEqual(at("2026-10-25T09:30:00Z"));
  });

  it("skips months that passed without a request", () => {
    expect(
      cycleAt(at("2026-01-10T00:00:00Z"), at("2027-03-15T00:00:00Z")),
    ).toEqual({
      start: at("2027-03-10T00:00:00Z"),
      end: at("2027-04-10T00:00:00Z"),
    });
  });

  it("ends on a short month's last day, then returns to the anchor's day", () => {
    const anchor = at("2026-01-31T12:00:00Z");
    expect(cycleAt(anchor, at("2026-02-10T00:00:00Z"))).toEqual({
      start: at("2026-01-31T12:00:00Z"),
      end: at("2026-02-28T12:00:00Z"),
    });
    expect(cycleAt(anchor, at("2026-03-05T00:00:00Z"))).toEqual({
      start: at("2026-02-28T12:00:00Z"),
      end: at("2026-03-31T12:00:00Z"),
    });
  });

  it("starts at the anchor when now is before it", () => {
    expect(
      cycleAt(at("2026-10-25T00:00:00Z"), at("2026-10-24T00:00:00Z")).start,
    ).toEqual(at("2026-10-25T00:00:00Z"));
  });
});
