import { FakeSandbox } from "@codegenie/sandbox/testing";
import { describe, expect, it } from "vitest";
import { draftEnvironment } from "./draft.js";

const nodeRepo = {
  "package.json": JSON.stringify({
    scripts: { test: "vitest run", lint: "eslint ." },
  }),
  "package-lock.json": "{}",
};

describe("draftEnvironment", () => {
  it("turns a detected project into steps (with a lenient alternative) and checks", async () => {
    expect(await draftEnvironment(new FakeSandbox(nodeRepo))).toEqual({
      steps: [
        {
          name: "install",
          cwd: ".",
          command: "npm ci",
          alternatives: ["npm install"],
        },
      ],
      checks: [
        { name: "lint", command: "npm run lint", cwd: "." },
        { name: "test", command: "npm run test", cwd: "." },
      ],
      notes: ["JavaScript/TypeScript project using npm."],
      overridden: false,
    });
  });

  it("explains when nothing is detected", async () => {
    const draft = await draftEnvironment(new FakeSandbox({ "main.go": "" }));
    expect(draft).toMatchObject({ steps: [], checks: [], overridden: false });
    expect(draft.notes[0]).toMatch(/No supported project type was detected/);
  });

  it("applies install and check overrides", async () => {
    const draft = await draftEnvironment(new FakeSandbox(nodeRepo), {
      overrides: {
        install: "npm install --legacy-peer-deps",
        checks: [{ name: "test", command: "npm run test:unit", cwd: "." }],
      },
    });
    expect(draft.steps).toEqual([
      { name: "install", cwd: ".", command: "npm install --legacy-peer-deps" },
    ]);
    expect(draft.checks).toEqual([
      { name: "lint", command: "npm run lint", cwd: "." },
      { name: "test", command: "npm run test:unit", cwd: "." },
    ]);
    expect(draft.overridden).toBe(true);
  });

  it("can skip installing", async () => {
    const draft = await draftEnvironment(new FakeSandbox(nodeRepo), {
      overrides: { install: false },
    });
    expect(draft.steps).toEqual([]);
  });
});
