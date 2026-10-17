# Agent

> Status: **Accepted** · Last updated: 2026-10-15 · Code: `packages/agent` · Related: [sandbox.md](./sandbox.md), [architecture.md](./architecture.md), [requirements.md](./requirements.md)

The agent is the part of CodeGenie that does the work: an LLM loop that explores a repository, edits code and runs checks inside a sandbox until the task is done. It is a library (`@codegenie/agent`); the CLI and the worker call `runAgent()`.

## 1. How it fits

```
caller (CLI / worker)
  └─ runAgent({ task, ctx, model, setup, limits, emit, signal })
       ├─ prompt:  system rules + repository context (built once per run)
       ├─ loop:    streamText ⇄ tools, until finish_task / limit / cancel / failure
       │     └─ tools ─► Sandbox interface ─► DockerSandbox / DaytonaSandbox
       └─ returns AgentResult { status, summary, usage, steps, messages, … }
```

- The LLM only sees tool **names, descriptions and input schemas**. It sends back a tool name and arguments; the AI SDK looks the tool up and calls its `execute` function.
- Tools run against the run's sandbox through `ToolContext`, which our code binds when the tools are created. The model never supplies or sees the context.
- The agent never commits, pushes or opens PRs. Delivery is the caller's job.

## 2. Code layout

```
packages/agent/src/
├── index.ts                  public API (re-exports each module)
├── loop/
│   ├── run-agent.ts          the flow: segments → finished / failed / cancelled / limit / nudge
│   ├── run-segment.ts        one streamText call: events, infra-error abort, message snapshot
│   ├── agent-result.ts       AgentStatus, AgentResult, finish_task summary lookup
│   ├── compaction.ts         cache-friendly context compaction
│   ├── events.ts             AI SDK stream parts → JobEvent
│   ├── limits.ts             default limits and the messages the model sees
│   └── errors.ts             infrastructure-error detection
├── model/
│   ├── catalog.ts            the models the platform may run (edit this to add one)
│   ├── types.ts              ModelSpec, ModelPricing
│   ├── resolve-model.ts      "openai:<id>" → AI SDK model via the provider registry
│   └── usage.ts              tokens (input / cached / output) → cost
├── prompt/
│   ├── system-prompt.ts      fixed rules
│   └── repo-context.ts       tree, package.json, README excerpt, AGENTS.md, check commands
├── tools/
│   ├── index.ts              createTools(ctx)
│   ├── core/                 context, run-tool, tool-error, workspace-path, output-log
│   └── <tool>/               <tool>.ts · description.ts · tests (one folder per tool)
├── lib/                      truncate, shell-quote, lines
└── testing/                  FakeSandbox, scripted fake model, Docker test helper
```

Tests sit next to the code: `*.test.ts` need nothing, `*.integration.test.ts` need Docker.

## 3. Tools

| Tool | What it does |
|---|---|
| `list_files` | Indented tree (depth 1–5, max 500 entries), skipping `node_modules` and `.git` |
| `read_file` | Line-numbered content (`12│ code`), 2,000 lines per call, `offset` to continue; rejects binary files |
| `search` | ripgrep with `path` / `glob` / `ignoreCase`; respects `.gitignore`; max 100 matches |
| `edit_file` | Exact replacement; `oldString` must match once (or `replaceAll`); returns the edited lines |
| `write_file` | Create or overwrite a file; parent folders created |
| `bash` | Shell command in `/workspace`; 2 min default, 10 min max; stdout + stderr combined |
| `run_checks` | Runs the repo's checks (from setup), each in its own folder; ✓/✗ per check plus the end of failing output |
| `finish_task` | Ends the run with a summary (used in the PR description) |

Shared rules:
- **Paths:** resolved against `/workspace`; anything outside is refused; writes inside `.git` are refused. The container is the real security boundary.
- **Read before edit:** editing or overwriting a file requires reading it first in the same run.
- **Output size:** every result is capped at 30,000 characters, keeping whole lines from the start (40%) and end (60%).
- **Full output kept:** `bash` and `run_checks` save complete output to `/tmp/codegenie/logs/NNNN-*.log` (outside the repo). Shortened results say where the log is; the agent can `search` or `read_file` it.
- **Errors:** expected failures return `Error: …` to the model so it can retry. Infrastructure failures (sandbox gone) stop the run.

## 4. The loop

`runAgent()` runs one or more **segments**. A segment is a single `streamText` call in which the model takes steps (one or more tool calls each) until something stops it. After each segment the loop decides:

| Situation | Outcome |
|---|---|
| Model called `finish_task` | **succeeded**, with its summary |
| A tool hit an infrastructure error (sandbox gone) | **failed** immediately; no more model calls |
| Caller aborted the signal | **cancelled** |
| Model provider failed after 3 retries | **failed** |
| Step, time or cost limit reached | **wrap-up**: one forced `finish_task` step, then **incomplete** with an honest summary |
| Model stopped without `finish_task` | **nudge** ("continue, or call finish_task"), up to 2 times; then **failed** |

Details:
- **Limits** (defaults, override per run): 150 steps, 30 minutes, $2. The cost check runs after each step, so the last step plus the wrap-up can go slightly over.
- **Wrap-up** has its own 2-minute budget and forces the `finish_task` tool (`toolChoice`).
- **Messages** of completed steps are kept even if a segment is aborted mid-step.
- **Events:** the loop emits `tool_start`, `tool_end` (output preview ≤ 2 KB) and `text_delta`. It does not emit `done`/`error`: the run ending is not the job ending (checks and delivery follow), so the caller reports the outcome.

### Result

```ts
AgentResult {
  status: "succeeded" | "incomplete" | "failed" | "cancelled";
  summary: string | null;      // from finish_task
  error?: string;              // why it failed or ended early
  limitReached?: "steps" | "time" | "cost";
  steps, durationMs, model, compactions;
  usage: { inputTokens, cachedInputTokens, outputTokens, costUsd };
  messages;                    // full transcript
}
```

The worker maps `incomplete` to a succeeded job delivered as a draft PR marked incomplete.

## 5. Prompt

- **System prompt** = fixed rules (`AGENT_RULES`) + repository context. It is built once per run and never changes, so together with the tool definitions it forms a stable prefix the provider can cache.
- **Repository context:** file tree (2 levels), `package.json` (name, scripts, dependencies), first 80 lines of the README, `AGENTS.md` (capped at 8,000 characters). Missing files are skipped.
- **Setup section:** what the runner's setup stage did (package manager, install status with the end of the error and the log path if it failed, the checks for `run_checks`, notes). Passed in as `runAgent({ setup })`; see [runner.md](./runner.md). With environment onboarding it will show the replayed setup steps and each check's baseline status, so the agent knows which checks were already failing ([environment.md](./environment.md)).
- **First user message** = the task.

## 6. Context compaction

Every step resends the whole conversation. Long tasks would overflow the context window, and cost grows with every step.

- **Trigger:** estimated prompt size (characters ÷ 4) above **60%** of the model's context window.
- **Action:** in one batch, replace the content of old tool results with a one-line note (`[Output of read_file src/app.ts removed to save context (9,031 characters). Run the tool again if you need it.]`) until the prompt is under **40%**. Kept: the task, every tool **call**, the model's own text, and the last **10** steps in full (fewer, down to 3, if those steps are huge).
- **Watermark:** the cut-off is remembered and only moves at the next compaction. Between compactions every request starts with an identical prefix, so the provider's prompt cache keeps hitting. Compaction costs one cache miss each time it runs, which is rarely.
- No LLM summarization: replacing results is free, deterministic and testable, and the agent can re-read anything it needs.

## 7. Models

Model choice is **platform-controlled** for the MVP (see [requirements.md §7](./requirements.md)): users don't pick a model.

- **Catalog** (`model/catalog.ts`): the only models that can run. Each entry has an id (`openai:<model id>`), context window and prices (input, cached input, output per 1M tokens). Unknown ids are rejected, because the cost limit needs prices.
- **Resolution:** `resolveModel(id)` creates the model through the AI SDK provider registry. API keys come from the environment (`OPENAI_API_KEY`).
- **Who picks:** `runAgent` receives an already resolved model. The CLI and worker choose it (from `AGENT_MODEL`), so tiers or bring-your-own-key can be added later without changing the loop.
- **Current catalog:** `openai:gpt-6-luna` ($0.10 input / $0.01 cached / $0.50 output per 1M tokens). Its `contextWindow` is set to 272K, not the real 1.05M, because prompts above 272K are billed at double rates; compaction then keeps prompts well under that threshold.
- **Usage:** input, cached input and output tokens are tracked per step; cost is computed from catalog prices. Tokens are the source of truth if prices change.

To add a model: add a catalog entry with values from the provider's model and pricing pages, then select it with `AGENT_MODEL`.

## 8. Testing

- **Fake model** (`testing/mock-model.ts`): a scripted LLM that replays tool calls and text per call, with configurable usage, delays and errors. No network, no cost.
- **Fake sandbox** (`testing/fake-sandbox.ts`): in-memory files and scripted `exec`.
- **Loop tests** cover finishing, real tool execution, event order, the prompt sent, nudges, all three limits with forced wrap-up, cancellation, sandbox loss before and during the run, provider errors, and recovery from tool errors.
- **Integration tests** run tools against a real `DockerSandbox`.

## 9. Setup agent (planned)

A second agent in this package, `setup-agent/`, used only during environment onboarding: it makes a repository installable and checkable, asks the user multiple-choice questions when it can't decide, and returns a structured environment config. It reuses the loop, with its own prompt and tools (`try_environment`, `ask_user`, `finish_setup`, plus the read/search/bash tools). Limits: 40 steps, 10 minutes, $0.20, at most 5 questions. Design: [environment.md](./environment.md).

## 10. Known limitations / TODO

- [ ] Not yet run against a real model end to end (first real runs come with the CLI).
- [ ] Cost limit is checked between steps, so a run can slightly exceed it.
- [ ] Token estimate for compaction is a character heuristic.
- [ ] Utility model for cheap side tasks (PR titles/descriptions), tiers, bring-your-own-key and fallback models are post-MVP.
- [ ] LLM-based summarization of old context, if evals show the agent losing track on long tasks.
