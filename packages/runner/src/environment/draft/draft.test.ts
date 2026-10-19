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
    });
  });

  it("installs each project in its folder and collects all checks", async () => {
    const draft = await draftEnvironment(
      new FakeSandbox({
        "api/package.json": JSON.stringify({ scripts: { test: "vitest" } }),
        "api/package-lock.json": "{}",
        "web/package.json": JSON.stringify({ scripts: { lint: "eslint ." } }),
      }),
    );
    expect(draft.steps).toEqual([
      {
        name: "install",
        cwd: "api",
        command: "npm ci",
        alternatives: ["npm install"],
      },
      { name: "install", cwd: "web", command: "npm install" },
    ]);
    expect(draft.checks).toEqual([
      { name: "test", command: "npm run test", cwd: "api" },
      { name: "lint", command: "npm run lint", cwd: "web" },
    ]);
    expect(draft.notes[0]).toBe(
      "JavaScript/TypeScript projects: api (npm), web (npm).",
    );
  });

  it("explains when nothing is detected", async () => {
    const draft = await draftEnvironment(new FakeSandbox({ "main.go": "" }));
    expect(draft).toMatchObject({ steps: [], checks: [] });
    expect(draft.notes[0]).toMatch(/No supported project type was detected/);
  });
});
