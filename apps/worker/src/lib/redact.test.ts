import { describe, expect, it } from "vitest";
import { redactGithubTokens } from "./redact.js";

describe("redactGithubTokens", () => {
  it.each([
    ["ghs_faketoken0123456789abcdefghij", "ghs_***"],
    ["ghu_faketoken0123456789abcdefghij", "ghu_***"],
    ["gho_faketoken0123456789abcdefghij", "gho_***"],
    ["ghp_faketoken0123456789abcdefghij", "ghp_***"],
    ["github_pat_11ABCDEFG0123456789_abcdefghijklmnop", "github_pat_***"],
  ])("hides %s", (token, hidden) => {
    expect(
      redactGithubTokens(`remote: https://x-access-token:${token}@github.com`),
    ).toBe(`remote: https://x-access-token:${hidden}@github.com`);
  });

  it("leaves ordinary text alone", () => {
    const text = "ghs_ is a prefix; ghost_town and gh_pages are fine";
    expect(redactGithubTokens(text)).toBe(text);
  });
});
