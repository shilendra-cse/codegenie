import { describe, expect, it } from "vitest";
import { scriptedModel } from "../testing/index.js";
import { cleanTitle, titleTask } from "./title-task.js";

const prompt =
  "can you add a skill aws, lambda, s3, ecs, ec2, cloudwatch for me";

describe("cleanTitle", () => {
  it.each([
    ["Add AWS skills to the profile", "Add AWS skills to the profile"],
    ['"Add AWS skills to the profile."', "Add AWS skills to the profile"],
    ["Title: add AWS skills", "Add AWS skills"],
    ["**Add AWS skills**\n\nThis adds…", "Add AWS skills"],
    ["  Add   AWS   skills  ", "Add AWS skills"],
  ])("tidies %j", (answer, title) => {
    expect(cleanTitle(answer)).toBe(title);
  });

  it("cuts a long answer at a word, within 60 characters", () => {
    const title = cleanTitle(
      "Add AWS Lambda, S3, ECS, EC2 and CloudWatch to the cloud skills section of the profile",
    );
    expect(title).toBe(
      "Add AWS Lambda, S3, ECS, EC2 and CloudWatch to the cloud",
    );
    expect(title!.length).toBeLessThanOrEqual(60);
  });

  it.each(["", "   ", '""', "..."])("finds nothing usable in %j", (answer) => {
    expect(cleanTitle(answer)).toBeNull();
  });
});

describe("titleTask", () => {
  it("asks the model for a short title, with the task as the prompt", async () => {
    const { model, resolved } = scriptedModel([
      {
        text: "Add AWS skills to the profile",
        usage: { inputTokens: 120, outputTokens: 8 },
      },
    ]);

    const result = await titleTask(resolved, prompt);

    expect(result.title).toBe("Add AWS skills to the profile");
    expect(result.usage).toMatchObject({ inputTokens: 120, outputTokens: 8 });
    expect(result.usage.costUsd).toBeGreaterThan(0);
    const call = model.doStreamCalls[0]!;
    expect(JSON.stringify(call.prompt)).toContain("3 to 6 words");
    expect(JSON.stringify(call.prompt)).toContain(prompt);
  });

  it("gives no title when the model fails", async () => {
    const { resolved } = scriptedModel([
      { error: new Error("rate limited") },
      { error: new Error("rate limited") },
    ]);
    expect((await titleTask(resolved, prompt)).title).toBeNull();
  });

  it("gives no title when the model is too slow", async () => {
    const { resolved } = scriptedModel([
      { text: "Add AWS skills", delayMs: 200 },
    ]);
    expect(
      (await titleTask(resolved, prompt, { timeoutMs: 20 })).title,
    ).toBeNull();
  });

  it("stops when the run is cancelled", async () => {
    const { resolved } = scriptedModel([
      { text: "Add AWS skills", delayMs: 200 },
    ]);
    const cancel = new AbortController();
    const pending = titleTask(resolved, prompt, { signal: cancel.signal });
    cancel.abort();
    expect((await pending).title).toBeNull();
  });
});
