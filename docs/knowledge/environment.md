# Environment

> Status: **In progress** (part A built: config, replay, baseline, before/after, rules-only draft) · Last updated: 2026-10-17 · Related: [runner.md](./runner.md), [agent.md](./agent.md), [database.md](./database.md), [requirements.md](./requirements.md)

Before the agent can work on a repository, something has to know **how to install it and how to check that it still works**. CodeGenie answers that once per repository with an **environment config**, created through a short guided conversation (**onboarding**), and replays that config in every task job.

```
connect repo ──► ONBOARDING (once, interactive) ──► ENVIRONMENT CONFIG ──► every TASK JOB replays it
                 rules → try → AI → ask → verify      saved, versioned       read-only
                                                         ▲                        │
                                                         └── rerun onboarding ◄───┘ "needs attention"
```

## 1. Decisions

| Decision | Choice | Why |
|---|---|---|
| Where setup knowledge lives | One explicit, versioned **environment config per repository**, replayed by every job | Jobs are deterministic and debuggable ("this job ran *this* config"). Matches GitHub Copilot, Codex, Cursor, Devin and OpenHands. |
| How a config is created | **Onboarding**: rules draft → try it → AI setup agent fixes gaps → **asks the user** multiple-choice questions when it can't decide → final check in a fresh sandbox → user approves | Common repos need no AI; hard cases get solved with a click instead of a failed setup. Everything kept is verified. |
| Verification | A step or check is kept only if it actually ran; the final config is re-run in a **fresh** sandbox | Unverified AI setup works poorly (EnvBench ~7% on Python); validate-and-keep-only-what-worked reaches 86% (Repo2Run). |
| AI in task jobs | **None.** Jobs only replay the config | Speed, cost and predictability. All figuring-out happens in onboarding. |
| Storage | **Database** (`project_environments`, versioned) for the product; a local file store for the CLI until the worker exists | Shared with the team, versioned, health-tracked, audit trail per job. |
| Config committed in the user's repo | **Post-MVP**, optional | Adds friction to onboarding; only teams that want setup reviewed in PRs need it. |
| Writing into the user's repo | **Never**, except the agent's task changes | Nothing CodeGenie-specific can end up in a PR. |

## 2. The config

```ts
type EnvironmentConfig = {
  version: 1;
  steps: { name: string; cwd: string; command: string }[];   // replayed in order before every job
  checks: Check[];                                            // { name, cwd, command }: run_checks + verify
  meta: {
    source: "detected" | "ai" | "user" | "mixed";
    createdAt: string;
    commit: string;                                           // commit it was verified on
    decisions: { question: string; answer: string; auto: boolean }[];
    validation: {
      steps: Record<string, "ok" | "failed">;
      checks: Record<string, "passing" | "failing" | "broken" | "timed-out">;
    };
  };
};
```

- **Steps, not one script:** each step is validated and logged on its own, so errors name the exact step, and multi-project repos are simply several steps.
- **Checks:** `Check` from `@codegenie/shared` (`lint`, `typecheck`, `test`, `build`, each with a working folder).
- **Not in the MVP config:** environment variables, secrets and services (e.g. a database for tests).

Example (DoDesk):

```json
{
  "version": 1,
  "steps": [
    { "name": "install backend", "cwd": "backend", "command": "npm ci" },
    { "name": "install client", "cwd": "client", "command": "npm ci" }
  ],
  "checks": [
    { "name": "lint", "cwd": "backend", "command": "npm run lint" },
    { "name": "typecheck", "cwd": "backend", "command": "npm run typecheck" },
    { "name": "test", "cwd": "backend", "command": "npm run test" },
    { "name": "lint", "cwd": "client", "command": "npx eslint ." },
    { "name": "typecheck", "cwd": "client", "command": "npm run typecheck" },
    { "name": "test", "cwd": "client", "command": "npm run test" }
  ],
  "meta": {
    "source": "mixed",
    "commit": "abc123",
    "decisions": [
      { "question": "Backend tests need PostgreSQL. What should I do?", "answer": "Run only the tests that don't need a database", "auto": false },
      { "question": "How should I lint the client?", "answer": "Use eslint directly", "auto": false }
    ]
  }
}
```

## 3. Onboarding

```
runOnboarding({ source, model, channel, store })
 1. sandbox + checkout
 2. DRAFT        rules detect the repository shape → draft config (free, instant)
 3. TRY          run every step and every check → statuses
 4. GAPS?        failed step · broken or timed-out check · no checks · nothing detected
                   none → 6
 5. SETUP AGENT  explores, tries fixes, asks the user when it can't decide → final config
 6. FINAL CHECK  run the final config in a FRESH sandbox (proves it replays from scratch)
 7. APPROVE      show the config and results → Save / Edit / Start over
 8. SAVE         store a new active version
```

Gaps that remain after the agent (e.g. tests that genuinely need a database) are saved with their status or removed, and recorded in `meta.decisions`. They are never hidden.

### 3.1 Draft rules (multi-project)

| Repository shape | Detected by | Steps | Checks |
|---|---|---|---|
| Single project | root `package.json` with dependencies | frozen install at root | root scripts |
| Workspaces | `pnpm-workspace.yaml`, or `workspaces` in root `package.json` | one install at root | root scripts; otherwise each workspace package's scripts |
| Independent sub-projects (e.g. BuyerBook) | no workspaces; first-level folders with their own `package.json` | install in each folder | each folder's scripts |
| Orchestration-only root (e.g. DoDesk) | root dependencies are only tools such as `concurrently`, `npm-run-all`, `turbo`, `nx`, `lerna`, `husky`, `lint-staged`, `prettier` | install in each sub-project | each sub-project's scripts; root `--prefix` scripts skipped |
| Real root + sub-projects | root has real dependencies and folders have their own `package.json` | each | each |

- Package manager per project: `packageManager` field, then lockfile (pnpm, yarn, npm), then npm. Frozen installs (`npm ci`, `pnpm install --frozen-lockfile`, `yarn install --frozen-lockfile`); if one fails, that is a gap for the setup agent.
- Checks per project: `lint`; `typecheck` / `type-check` / `tsc` / `check-types` (or `tsc --noEmit` for TypeScript projects without a script); `test` (ignoring npm's placeholder); `build`.
- Limits: sub-projects one folder level deep; at most 8 projects; workspace patterns `dir` and `dir/*` only (others produce a note). Skipped folders: `node_modules`, dot-folders, and folders without a `package.json`.

### 3.2 Validation

Every step and check is run and classified:

| Status | Meaning | Kept? |
|---|---|---|
| step `ok` / `failed` | the step's exit code | failed steps are gaps |
| check `passing` | ran and succeeded | yes |
| check `failing` | ran and found problems (e.g. failing tests) | yes, marked as failing at onboarding |
| check `broken` | command not found (exit 127), missing script, crash before running | no: a gap |
| check `timed-out` | hung (watch mode, interactive prompt) | no: a gap |

### 3.3 Setup agent

`runSetupAgent({ sandbox, model, draft, report, validate, channel, limits }) → { config, decisions, usage }`

- Lives in `@codegenie/agent` (`setup-agent/`), reusing the agent loop, with its own prompt: make the repository installable and checkable, prefer recommended choices, ask only when it can't decide.
- Tools:

| Tool | Purpose |
|---|---|
| `list_files`, `read_file`, `search`, `bash` | explore and try commands (existing tools) |
| `try_environment(config)` | validates a candidate config (the runner's `validate`, passed in) and returns statuses with output tails |
| `ask_user(question)` | asks the user through the channel; returns the chosen option or free text |
| `finish_setup(config, notes)` | structured final answer; ends the agent |

- Limits: 40 steps, 10 minutes, $0.20, at most 5 questions. Its cost is reported with the onboarding result.
- The agent package does not depend on the runner: `validate` and `channel` are passed in.

### 3.4 Questions

```ts
type SetupQuestion = {
  id: string;
  question: string;                                   // "Backend tests need PostgreSQL. What should I do?"
  why?: string;
  options: { label: string; detail?: string }[];      // 2–4; the first is the recommended one
  allowOther: true;                                   // "Something else…" free text
};
type SetupAnswer = { option: number } | { other: string };

interface UserChannel {
  ask(question: SetupQuestion): Promise<SetupAnswer>;
  info(message: string): void;
}
```

- Ask only what can't be figured out: real decisions (which tests matter) or facts only the user has. At most 5 questions per onboarding.
- Every option maps to a concrete config change; every answer is applied and verified before moving on.

| Channel | Where | Behavior |
|---|---|---|
| `TerminalChannel` | CLI | numbered options in the terminal |
| `AutoChannel` | evals, `--yes` | always the recommended option; recorded as `auto: true` |
| `EventChannel` | website (later) | `question_asked` event → question cards → answer through the API |

Example conversation (DoDesk):

```
Found 2 projects: backend/ (Express + Prisma) and client/ (Next.js). Installing both… ✓
Running checks… lint ✓  typecheck ✓  client tests ✓
backend tests: 6 pass, 9 fail: "connect ECONNREFUSED localhost:5433"

? Backend tests need a PostgreSQL database. What should I do?
  1. Run only the tests that don't need a database (npm run test) (recommended)
  2. Skip backend tests entirely
  3. Something else…
› 1
Using "npm run test" for backend. Re-running… ✓ 6/6 pass.
```

## 4. Task jobs

```
1. LOAD        the project's active config (none → onboarding first)
2. SANDBOX + CHECKOUT
3. REPLAY      run the steps; a failed step doesn't stop the job (the agent is told)
4. BASELINE    run every check once → passing / failing / broken / timed-out
5. AGENT       the prompt shows setup status and which checks were already failing
6. VERIFY      run the checks again → fixed / regressed / still failing / passing
7. DIFF + RESULT
8. CLEANUP
```

- The config is **read-only** during jobs: no detection, no AI, no questions.
- Baseline is on by default; `--no-baseline-checks` skips it for slow suites.
- Before/after comparison per check:

| Baseline | After | Result |
|---|---|---|
| passing | passing | passing |
| failing | passing | **fixed** |
| passing | failing | **regressed** |
| failing | failing | still failing (pre-existing) |

### 4.1 Health

Jobs flag the config as **needs attention** (without stopping) when:

- a setup step failed, or
- a folder with a `package.json` appears that the config doesn't cover (a hint).

The fix is to rerun onboarding, which starts from the current config and only works on what's broken, producing a new version.

## 5. Storage

All storage goes through one interface, so the runner doesn't know where configs live:

```ts
interface EnvironmentStore {
  load(repoKey: string): Promise<StoredEnvironment | null>;   // the active version
  save(repoKey: string, config: EnvironmentConfig, source: EnvironmentSource): Promise<StoredEnvironment>;
  markHealth(repoKey: string, health: "ok" | "needs_attention", reason?: string): Promise<void>;
}
```

| Where | Store | Notes |
|---|---|---|
| Product (worker + website) | **Database**, `project_environments` ([database.md](./database.md)) | versions, one active per project, health, `jobs.environment_id` records which version each job used |
| CLI (now) | File store: `~/.codegenie/environments/<repo-key>.json` | keeps the last 5 versions; repo key = git remote URL, or the folder path without a remote |

Lifecycle: onboarding inserts a new active version (the previous one becomes superseded); user edits create a new version with `source: user`; rollback reactivates an older version.

## 6. CLI

```bash
pnpm agent:setup --repo ../DoDesk             # onboarding conversation → saves a config
pnpm agent:setup --repo ../DoDesk --yes       # non-interactive: recommended answers, auto-approve
pnpm agent:run   --repo ../DoDesk --task "…"  # uses the saved config (runs onboarding first if none)
pnpm agent:run   … --show-environment         # which config version is used, and where it is stored
pnpm agent:run   … --no-baseline-checks
```

The `--install`, `--no-install` and `--check` flags are removed: changes go through onboarding or by editing the config.

## 7. Code layout

```
packages/shared/src/types/environment.ts   EnvironmentConfig, statuses, SetupQuestion/Answer, events

packages/agent/src/setup-agent/
├── run-setup-agent.ts · prompt.ts
└── tools/  try-environment.ts · ask-user.ts · finish-setup.ts

packages/runner/src/
├── onboarding/       runOnboarding(), AutoChannel
├── environment/
│   ├── config.ts     zod schema
│   ├── draft/        rules → draft (multi-project detectors)
│   ├── apply.ts      replay steps (onboarding and jobs)
│   ├── validate.ts   statuses + classifier
│   ├── health.ts     uncovered project folder hint
│   └── store.ts      EnvironmentStore interface
├── job/              load → replay → baseline → agent → verify (before/after)
└── stages/           checkout · changes · verify

apps/cli/src/
├── commands/         run.ts · setup.ts
├── channel/          terminal.ts
└── store/            file-store.ts
```

The existing setup stage (`stages/setup`, `runSetup` with overrides) is replaced: its detectors become the draft rules, its install code becomes `apply`.

## 8. Build order

| Part | Contents | Outcome |
|---|---|---|
| A ✅ | config type + schema; `apply` / `validate`; jobs replay the config; baseline + before/after; rules-only draft, auto-approved | jobs run from an explicit config |
| B | multi-project draft rules | correct drafts for DoDesk and BuyerBook |
| C | setup agent (`try_environment`, `ask_user`, `finish_setup`); onboarding pipeline; fresh-sandbox final check; terminal and auto channels | the guided conversation works |
| D | `EnvironmentStore` + CLI file store (versions); `agent:setup` and flags; health signals | complete onboarding in the CLI |
| Phase 2 | DB migration + `DbEnvironmentStore` | product storage |
| Phase 4 | `EventChannel`, question cards, config panel, needs-attention banner | onboarding on the website |

## 9. Not in the MVP

- [ ] Config committed in the user's repository (`.codegenie/environment.json`, checked before the database)
- [ ] Services in the sandbox (e.g. PostgreSQL for tests)
- [ ] Environment variables and secrets (onboarding offers "skip" or "dummy value" options meanwhile)
- [ ] Snapshots after setup for faster jobs, plus a maintenance step on resume
- [ ] Non-JavaScript ecosystems (new draft detectors)

## 10. References

- [GitHub Copilot coding agent environment](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment)
- [OpenAI Codex cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environment)
- [Cursor background agents](https://docs.cursor.com/background-agent)
- [Devin repo setup](https://docs.devin.ai/onboard-devin/repo-setup)
- [OpenHands repository customization](https://docs.all-hands.dev/modules/usage/customization/repository)
- [Jules environment setup](https://jules.google/docs/environment/)
- [EnvBench](https://arxiv.org/html/2503.14443) · [Repo2Run](https://arxiv.org/html/2502.13681v2)
