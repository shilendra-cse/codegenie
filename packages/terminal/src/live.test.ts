import { PassThrough } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LiveArea } from "./live.js";

function stream(isTTY: boolean) {
  const out = Object.assign(new PassThrough(), {
    isTTY,
    columns: 80,
    rows: 24,
  });
  let written = "";
  out.on("data", (chunk: Buffer) => (written += chunk.toString()));
  return { out, written: () => written };
}

describe("LiveArea", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("only writes the permanent lines outside a terminal", () => {
    const { out, written } = stream(false);
    const live = new LiveArea(out, () => ["◒ running"]);
    live.start();
    live.print("✓ done");
    live.stop();
    expect(live.interactive).toBe(false);
    expect(written()).toBe("✓ done\n");
  });

  it("redraws the live lines below the permanent ones in a terminal", () => {
    vi.stubEnv("CI", "");
    const { out, written } = stream(true);
    let label = "first";
    const live = new LiveArea(out, () => [`◒ ${label}`]);
    live.start();
    label = "second";
    live.print("✓ done");
    live.stop();
    expect(live.interactive).toBe(true);
    expect(written()).toContain("◒ first");
    expect(written()).toContain("✓ done\n");
    expect(written()).toContain("◒ second");
  });

  it("doesn't animate in a terminal without rows", () => {
    vi.stubEnv("CI", "");
    const { out } = stream(true);
    out.rows = 0;
    expect(new LiveArea(out, () => []).interactive).toBe(false);
  });

  it("doesn't animate in CI", () => {
    vi.stubEnv("CI", "true");
    expect(new LiveArea(stream(true).out, () => []).interactive).toBe(false);
  });
});
