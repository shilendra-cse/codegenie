import { SandboxGoneError } from "@codegenie/sandbox";
import type { JobEvent } from "@codegenie/shared";
import { describe, expect, it } from "vitest";
import { FakeSandbox } from "@codegenie/sandbox/testing";
import { scriptedModel, type ScriptedStep } from "../testing/mock-model.js";
import { createToolContext } from "../tools/core/context.js";
import { runAgent, type RunAgentOptions } from "./run-agent.js";

const finish = (summary: string): ScriptedStep => ({
  toolCalls: [{ toolName: "finish_task", input: { summary } }],
});
const call = (toolName: string, input: unknown): ScriptedStep => ({
  toolCalls: [{ toolName, input }],
});

function setup(
  script: Parameters<typeof scriptedModel>[0],
  files: Record<string, string> = { "src/app.ts": "const a = 1;\n" },
) {
  const sandbox = new FakeSandbox(files);
  const { model, resolved } = scriptedModel(script);
  const events: JobEvent[] = [];
  const run = (overrides: Partial<RunAgentOptions> = {}) =>
    runAgent({
      runId: "run-1",
      task: "Change a to 2",
      ctx: createToolContext(sandbox),
      model: resolved,
      emit: (event) => events.push(event),
      ...overrides,
    });
  return { sandbox, model, events, run };
}

describe("runAgent", () => {
  it("succeeds when the model calls finish_task", async () => {
    const { run } = setup([finish("Nothing to change.")]);
    const result = await run();
    expect(result).toMatchObject({
      status: "succeeded",
      summary: "Nothing to change.",
      steps: 1,
      model: "test:scripted",
    });
    // 100 input tokens × $1/M + 20 output × $4/M
    expect(result.usage).toEqual({
      inputTokens: 100,
      cachedInputTokens: 0,
      outputTokens: 20,
      costUsd: 0.00018,
    });
  });

  it("runs real tools against the sandbox and emits paired events", async () => {
    const { sandbox, events, run } = setup([
      {
        text: "Reading the file.",
        ...call("read_file", { path: "src/app.ts" }),
      },
      call("edit_file", {
        path: "src/app.ts",
        oldString: "a = 1",
        newString: "a = 2",
      }),
      finish("Changed a to 2."),
    ]);
    const result = await run();

    expect(result.status).toBe("succeeded");
    expect(sandbox.files.get("/workspace/src/app.ts")).toBe("const a = 2;\n");
    expect(events.map((e) => e.type)).toEqual([
      "text_delta",
      "tool_start",
      "tool_end",
      "tool_start",
      "tool_end",
      "tool_start",
      "tool_end",
    ]);
    const [start, end] = events.filter((e) => e.type !== "text_delta");
    expect(start).toMatchObject({
      toolName: "read_file",
      toolCallId: "call-1",
      jobId: "run-1",
    });
    expect(end).toMatchObject({ toolName: "read_file", toolCallId: "call-1" });
    expect((end as { output: string }).output).toContain("1│ const a = 1;");
  });

  it("sends the system prompt with repository context and the task", async () => {
    const { model, run } = setup([finish("done")]);
    await run();
    const prompt = model.doStreamCalls[0]!.prompt;
    expect(prompt[0]).toMatchObject({ role: "system" });
    expect(JSON.stringify(prompt[0])).toContain("# Repository");
    expect(JSON.stringify(prompt[0])).toContain("app.ts");
    expect(prompt[1]).toMatchObject({ role: "user" });
    expect(JSON.stringify(prompt[1])).toContain("Change a to 2");
  });

  it("nudges a model that stops without finishing", async () => {
    const { run } = setup([
      { text: "I think I'm done." },
      finish("Done after nudge."),
    ]);
    const result = await run();
    expect(result.status).toBe("succeeded");
    expect(JSON.stringify(result.messages)).toContain(
      "You stopped without calling finish_task",
    );
  });

  it("fails after repeated stops without finish_task", async () => {
    const { model, run } = setup(() => ({ text: "Still thinking." }));
    const result = await run();
    expect(result).toMatchObject({
      status: "failed",
      error: "The agent stopped without calling finish_task.",
    });
    expect(model.doStreamCalls).toHaveLength(3); // first try + 2 nudges
  });

  it("wraps up with a forced finish_task when the step limit is reached", async () => {
    const { model, run } = setup((i) =>
      i < 3
        ? call("list_files", {})
        : finish("Listed files; task not finished."),
    );
    const result = await run({ limits: { maxSteps: 3 } });

    expect(result).toMatchObject({
      status: "incomplete",
      limitReached: "steps",
      summary: "Listed files; task not finished.",
      steps: 4,
    });
    expect(model.doStreamCalls[3]!.toolChoice).toEqual({
      type: "tool",
      toolName: "finish_task",
    });
    expect(JSON.stringify(model.doStreamCalls[3]!.prompt)).toContain(
      "You have used the maximum of 3 steps.",
    );
  });

  it("wraps up when the cost limit is reached", async () => {
    // 1M input tokens per step at $1/M → $1 per step; limit $1.50 → stops after 2 steps.
    const { run } = setup((i) =>
      i < 2
        ? { ...call("list_files", {}), usage: { inputTokens: 1_000_000 } }
        : finish("Stopped for cost."),
    );
    const result = await run({ limits: { maxCostUsd: 1.5 } });
    expect(result).toMatchObject({
      status: "incomplete",
      limitReached: "cost",
      summary: "Stopped for cost.",
      steps: 3,
    });
  });

  it("wraps up when the time limit is reached", async () => {
    const { run } = setup((i) =>
      i === 0
        ? { ...call("list_files", {}), delayMs: 200 }
        : finish("Out of time."),
    );
    const result = await run({ limits: { maxWallTimeMs: 100 } });
    expect(result).toMatchObject({
      status: "incomplete",
      limitReached: "time",
      summary: "Out of time.",
    });
  });

  it("is cancelled through the abort signal", async () => {
    const controller = new AbortController();
    const { run } = setup(() => ({ ...call("list_files", {}), delayMs: 20 }));
    const result = await run({
      signal: controller.signal,
      emit: (event) => {
        if (event.type === "tool_end") controller.abort();
      },
    });
    expect(result.status).toBe("cancelled");
    expect(result.steps).toBeLessThanOrEqual(2);
  });

  it("fails immediately when the sandbox disappears", async () => {
    const { sandbox, model, run } = setup((i) =>
      i === 0
        ? call("read_file", { path: "src/app.ts" })
        : finish("never reached"),
    );
    const original = sandbox.readFile.bind(sandbox);
    sandbox.readFile = async (path) => {
      if (path.endsWith("src/app.ts")) {
        throw new SandboxGoneError("Sandbox fake-sandbox no longer exists");
      }
      return original(path);
    };
    const result = await run();
    expect(result).toMatchObject({
      status: "failed",
      error: "Sandbox error: Sandbox fake-sandbox no longer exists",
    });
    expect(model.doStreamCalls).toHaveLength(1);
  });

  it("fails without calling the model when the sandbox is gone before the run starts", async () => {
    const { sandbox, model, run } = setup([finish("never reached")]);
    sandbox.listFiles = async () => {
      throw new SandboxGoneError("Sandbox fake-sandbox no longer exists");
    };
    const result = await run();
    expect(result).toMatchObject({ status: "failed", steps: 0 });
    expect(model.doStreamCalls).toHaveLength(0);
  });

  it("fails when the model provider keeps erroring", async () => {
    const { run } = setup(() => ({ error: new Error("rate limited") }));
    const result = await run();
    expect(result.status).toBe("failed");
    expect(result.error).toMatch(/^Model request failed: .*rate limited/);
  });

  it("returns errors from tools to the model, which can recover", async () => {
    const { run, events } = setup([
      call("edit_file", {
        path: "src/app.ts",
        oldString: "a = 1",
        newString: "a = 2",
      }),
      call("read_file", { path: "src/app.ts" }),
      call("edit_file", {
        path: "src/app.ts",
        oldString: "a = 1",
        newString: "a = 2",
      }),
      finish("Edited after reading."),
    ]);
    const result = await run();
    expect(result.status).toBe("succeeded");
    const firstEnd = events.find((e) => e.type === "tool_end") as {
      output: string;
    };
    expect(firstEnd.output).toContain("Read src/app.ts with read_file first");
  });
});
