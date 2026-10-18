import { describe, expect, it } from "vitest";
import { AGENT_RULES, buildSystemPrompt } from "./system-prompt.js";

describe("buildSystemPrompt", () => {
  it("puts the fixed rules first and the repository context after them", () => {
    const prompt = buildSystemPrompt("REPO CONTEXT");
    expect(prompt.startsWith(AGENT_RULES)).toBe(true);
    expect(prompt.endsWith("# Repository\n\nREPO CONTEXT")).toBe(true);
  });
});
