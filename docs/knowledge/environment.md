# Environment

> Status: **Built** (parts A–D) · Last updated: 2026-10-18 · Related: [runner.md](./runner.md), [agent.md](./agent.md), [database.md](./database.md), [requirements.md](./requirements.md)

Before the agent can work on a repository, something has to know **how to install it and how to check that it still works**. CodeGenie answers that once per repository with an **environment config**, created through a short guided conversation (**onboarding**), and replays that config in every task run.

```
connect repo ──► ONBOARDING (once, interactive) ──► ENVIRONMENT CONFIG ──► every TASK RUN replays it
                 rules → try → AI → ask → verify      saved, versioned       read-only
                                                         ▲                        │
                                                         └── rerun onboarding ◄───┘ "needs attention"
```

## 1. Decisions

| Decision | Choice | Why |
|---|---|---|
| Where setup knowledge lives | One explicit, versioned **environment config per repository**, replayed by every run | Runs are deterministic and debuggable ("this run replayed *this* config"). Matches GitHub Copilot, Codex, Cursor, Devin and OpenHands. |
| How a config is created | **Onboarding**: rules draft → try it → AI setup agent fixes gaps → **asks the user** multiple-choice questions when it can't decide → final check in a fresh sandbox → user approves | Common repos need no AI; hard cases get solved with a click instead of a failed setup. Everything kept is verified. |
| Verification | A step or check is kept only if it actually ran; the final config is re-run in a **fresh** sandbox | Unverified AI setup works poorly (EnvBench ~7% on Python); validate-and-keep-only-what-worked reaches 86% (Repo2Run). |
| AI in task runs | **None.** Runs only replay the config | Speed, cost and predictability. All figuring-out happens in onboarding. |
| Storage | **Database** (`project_environments`, versioned) for the product; a local file store for the CLI until the worker exists | Shared with the team, versioned, health-tracked, audit trail per run. |
| Config committed in the user's repo | **Post-MVP**, optional | Adds friction to onboarding; only teams that want setup reviewed in PRs need it. |
| Writing into the user's repo | **Never**, except the agent's task changes | Nothing CodeGenie-specific can end up in a PR. |

## 2. The config

```ts
type EnvironmentConfig = {
  version: 1;
  steps: { name: string; cwd: string; command: string }[];   // replayed in order before every run
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

- Limits: 40 steps, 20 minutes (one DoDesk install already takes ~1.5 minutes), $0.20, at most 5 questions. Its cost is reported with the onboarding result.
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

### 3.5 Setup from the website

The website starts setup, shows it live and asks its questions in the browser.

- **Stored:** each setup is an `onboardings` row (status `queued` → `running` ⇄ `waiting` → `succeeded` / `failed` / `cancelled`, what it saved, what it cost) with its events in `onboarding_events` ([database.md](./database.md)). At most one active setup per project; starting again returns it.
- **Watched:** the worker stores every event, then publishes it; the browser follows `GET /projects/:id/onboarding/events`, replayed from the database then live, the same way as run events ([api.md](./api.md) §6).
- **Questions (`EventChannel`):** the worker records `question_asked` and waits; the answer comes through `POST /projects/:id/onboarding/answer` and reaches the worker over Redis; the worker records `question_answered` and carries on.
- **Waiting:** the sandbox stays open while a question is unanswered. After **30 minutes** setup stops (`failed`, `NO_ANSWER`: "Setup stopped after waiting 30 minutes for an answer.") and the sandbox goes; it can be started again.
- **Stop:** a queued setup is cancelled directly; a running or waiting one is told to stop and ends `cancelled`.
- **Saving:** a setup that succeeds is saved straight away as the project's next active version, as the worker did before; re-running setup makes a newer one.
- **API:** `POST /onboarding` (start), `GET /onboarding` (latest), `GET /onboarding/events` (stream), `POST /onboarding/answer`, `POST /onboarding/cancel`, `GET /environments` (versions), all under `/projects/:id`. Rollback comes with the project page.

## 4. Task runs

```
1. LOAD        the project's active config (none → onboarding first)
2. SANDBOX + CHECKOUT
3. REPLAY      run the steps; a failed step doesn't stop the run (the agent is told)
4. BASELINE    run every check once → passing / failing / broken / timed-out
5. AGENT       the prompt shows setup status and which checks were already failing
6. VERIFY      run the checks again → fixed / regressed / still failing / passing
7. DIFF + RESULT
8. CLEANUP
```

- The config is **read-only** during runs: no detection, no AI, no questions.
- Baseline is on by default; `--no-baseline-checks` skips it for slow suites.
- Before/after comparison per check:

| Baseline | After | Result |
|---|---|---|
| passing | passing | passing |
| failing | passing | **fixed** |
| passing | failing | **regressed** |
| failing | failing | still failing (pre-existing) |

Known limitation: the comparison is pass/fail per check, so a check that was already failing can't show new problems. If the agent adds lint or type errors in a repository whose lint already fails, the check just stays "still failing". In BuyerBook five of six checks fail before any change, so verify catches little there. Options for later: compare error counts, or run the check on the changed files only. Decide after the evals.

### 4.1 Health

Runs flag the config as **needs attention** (without stopping) when:

- a setup step failed, or
- a folder with a `package.json` appears that the config doesn't cover (`uncoveredProjects`: the multi-project rules run on the checkout; workspace packages don't count, since the root installs them).

The fix is to rerun onboarding, which starts from the current config and only works on what's broken, producing a new version.

## 5. Storage

All storage goes through one interface (`@codegenie/shared`), so the runner doesn't know where configs live:

```ts
interface EnvironmentStore {
  load(repoKey): Promise<StoredEnvironment | null>;   // the active (latest) version
  list(repoKey): Promise<StoredEnvironment[]>;        // kept versions, newest first
  save(repoKey, config, source): Promise<StoredEnvironment>;   // new active version, health ok
  markHealth(repoKey, "ok" | "needs_attention", reasons?): Promise<void>;   // on the active version
}
// StoredEnvironment: { repoKey, version, source, savedAt, config, health: { status, reasons, at? } }
```

| Where | Store | Notes |
|---|---|---|
| Product (worker + website) | `DbEnvironmentStore` (`packages/db`): **database** table `project_environments` ([database.md](./database.md)), keyed by project id | every version kept, one active per project, health with reasons; `runs.environment_id` records which version each run used (set by the worker) |
| CLI (built) | `FileEnvironmentStore` (`apps/cli/src/store/`): `~/.codegenie/environments/<repo-key>.json`, or under `$CODEGENIE_HOME` | the last 5 versions in one file, numbered on; written through a temporary file; configs validated on load |

**Repo key** (`repo-key.ts`): git URLs become host/path, lowercased, without protocol, user or `.git` (`github.com/acme/app`), so every URL form of a repository matches. A local folder uses its `origin` remote when it is the repository's top level, so a clone and its URL share one environment; otherwise (no remote, or a folder inside another repository) it is `local:<absolute path>`.

Lifecycle: onboarding saves a new active version (health ok); a run marks the active version as needing attention; rollback to an older version comes with the website (phase 4).

## 6. CLI

```bash
pnpm agent:setup --repo ../DoDesk             # onboarding conversation → saved as the next version
pnpm agent:setup --repo ../DoDesk --yes       # non-interactive: recommended answers, saved
pnpm agent:setup --repo ../DoDesk --show      # active version, health, steps, checks, answers, file
pnpm agent:run   --repo ../DoDesk --task "…"  # uses the saved environment
```

- A task needs a set-up repository: without a saved environment `agent:run` stops and prints the `agent:setup` command (a task is only given after setup, as in the product).
- `agent:setup --save <file>` also writes a copy; `agent:run --environment <file>` uses a file instead of the saved environment, e.g. to try a hand-edited config.
- `agent:run`'s header names the version in use and warns, with the reasons, when it needs attention.
- `--install`, `--no-install`, `--check` and `--save-environment` were removed: setup changes go through `agent:setup` or by editing the config.

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
│   ├── apply.ts      replay steps (onboarding and runs)
│   ├── validate.ts   statuses + classifier
│   ├── health.ts     uncovered project folder hint
│   └── store.ts      EnvironmentStore interface
├── run/              load → replay → baseline → agent → verify (before/after)
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
| A ✅ | config type + schema; `apply` / `validate`; runs replay the config; baseline + before/after; rules-only draft, auto-approved | runs replay an explicit config |
| B ✅ | multi-project draft rules | correct drafts for DoDesk and BuyerBook |
| C ✅ | C1 setup agent (`try_environment`, `ask_user`, `finish_setup`) on a shared loop · C2 onboarding pipeline; fresh-sandbox final check; terminal and auto channels; basic `pnpm agent:setup --save <file>` | the guided conversation works |
| D ✅ | `EnvironmentStore` + CLI file store (versions); `agent:setup` saves and `--show`s, `agent:run` loads; health signals | complete onboarding in the CLI |
| Phase 2 | DB migration + `DbEnvironmentStore` | product storage |
| Phase 4 | `EventChannel`, stored setups and events, the setup API (§3.5); then question cards, config panel, needs-attention banner | onboarding on the website |

## 9. Not in the MVP

- [ ] Config committed in the user's repository (`.codegenie/environment.json`, checked before the database)
- [ ] Services in the sandbox (e.g. PostgreSQL for tests)
- [ ] Environment variables and secrets (onboarding offers "skip" or "dummy value" options meanwhile)
- [ ] Snapshots after setup for faster runs, plus a maintenance step on resume. Measured in the baseline eval run ([evals.md](./evals.md)): DoDesk tasks took 6–10 minutes for only 7–15 agent steps, most of it clone + `npm ci` in two projects (client ~80 s), baseline checks (client build ~45 s) and the same checks again in verify. Options, largest gain first:
  - start runs from a sandbox snapshot taken after setup (keyed by environment version + lockfiles), so the install is skipped;
  - reuse the saved environment's check results as the baseline when the commit hasn't changed, instead of running the checks again;
  - keep `build` out of the baseline for slow builds (it rarely differs before the agent's changes).
- [ ] Non-JavaScript ecosystems (new draft detectors)

## 10. References

- [GitHub Copilot coding agent environment](https://docs.github.com/en/copilot/how-tos/use-copilot-agents/coding-agent/customize-the-agent-environment)
- [OpenAI Codex cloud environments](https://learn.chatgpt.com/docs/environments/cloud-environment)
- [Cursor background agents](https://docs.cursor.com/background-agent)
- [Devin repo setup](https://docs.devin.ai/onboard-devin/repo-setup)
- [OpenHands repository customization](https://docs.all-hands.dev/modules/usage/customization/repository)
- [Jules environment setup](https://jules.google/docs/environment/)
- [EnvBench](https://arxiv.org/html/2503.14443) · [Repo2Run](https://arxiv.org/html/2502.13681v2)
