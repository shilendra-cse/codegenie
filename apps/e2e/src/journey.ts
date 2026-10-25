import type { ScriptedStep } from "@codegenie/agent/testing";

/** What the scripted models say during the journey, shared by the worker and the test that checks it. */
export const JOURNEY = {
  setup: {
    question: "Hello-World is a README only. Should tasks check it?",
    options: [
      {
        label: "Check the README says hello",
        detail: "grep -q Hello README",
      },
      { label: "No checks" },
    ],
    check: { name: "test", cwd: ".", command: "grep -q Hello README" },
  },
  task: {
    prompt: "Add a greeting from CodeGenie to the README.",
    title: "Add a greeting to the README",
    readme: "Hello World!\nHello from CodeGenie.\n",
    summary: "Added a greeting from CodeGenie to the README.",
  },
  prNumber: 7,
} as const;

export const setupScript: ScriptedStep[] = [
  {
    toolCalls: [
      {
        toolName: "ask_user",
        input: {
          question: JOURNEY.setup.question,
          options: JOURNEY.setup.options,
        },
      },
    ],
  },
  {
    toolCalls: [
      {
        toolName: "finish_setup",
        input: {
          steps: [],
          checks: [JOURNEY.setup.check],
          notes: ["A README only; nothing to install."],
        },
      },
    ],
  },
];

export const titleScript = (): ScriptedStep => ({ text: JOURNEY.task.title });

// The delays keep each stage on screen long enough to be seen changing.
export const taskScript: ScriptedStep[] = [
  {
    delayMs: 1_500,
    toolCalls: [{ toolName: "read_file", input: { path: "README" } }],
  },
  {
    delayMs: 1_500,
    text: "The README is one line; I'll add the greeting below it.",
    toolCalls: [
      {
        toolName: "write_file",
        input: { path: "README", content: JOURNEY.task.readme },
      },
    ],
  },
  {
    delayMs: 1_500,
    toolCalls: [
      {
        toolName: "finish_task",
        input: { title: JOURNEY.task.title, summary: JOURNEY.task.summary },
      },
    ],
  },
];
