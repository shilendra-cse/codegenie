import { describe, expect, it } from "vitest";
import { clock, cost, duration, oneLine, plural } from "./format.js";

describe("format", () => {
  it("writes durations people can read", () => {
    expect(duration(45_000)).toBe("45s");
    expect(duration(192_000)).toBe("3m 12s");
    expect(duration(3_840_000)).toBe("1h 4m");
  });

  it("writes running timers", () => {
    expect(clock(48_900)).toBe("0:48");
    expect(clock(723_000)).toBe("12:03");
    expect(clock(3_723_000)).toBe("1:02:03");
  });

  it("writes costs, counts and single lines", () => {
    expect(cost(0.00351)).toBe("$0.0035");
    expect(plural(1, "step")).toBe("1 step");
    expect(plural(3, "step")).toBe("3 steps");
    expect(oneLine("a\n  b   c", 160)).toBe("a b c");
    expect(oneLine("abcdef", 4)).toBe("abc…");
  });
});
