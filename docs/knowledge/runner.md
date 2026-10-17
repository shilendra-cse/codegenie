# Runner

> Status: **In progress** (everything except deliver built) · Last updated: 2026-10-17 · Code: `packages/runner`, `apps/cli` · Related: [agent.md](./agent.md), [sandbox.md](./sandbox.md), [architecture.md](./architecture.md)

The runner executes a coding job end to end: get the repository into a sandbox, prepare it, run the agent, verify the result and deliver it. It contains **no AI logic of its own**: everything it does is deterministic. The AI work happens in `@codegenie/agent`, which the runner calls.

The CLI (`apps/cli`) and the worker (`apps/worker`) both use the runner, so a local run behaves exactly like production.

## 1. Stages: `runJob()`

```
sandbox → checkout → setup → baseline → agent → verify → diff → (deliver) → cleanup
```

| Stage | What it does | Status |
|---|---|---|
| sandbox | Create a fresh sandbox | built |
| checkout | Git URL: shallow clone (public repos). Local folder: copy tracked and untracked-but-not-ignored files, so `node_modules`, build output and `.env` stay out | built |
| setup | Detect the project type, install dependencies, find check commands (section 3). Next: replay the project's environment config ([environment.md](./environment.md)) | built; being replaced |
| baseline | Commit the state after setup, so the diff only contains the agent's changes; `node_modules/` always excluded. Next: also run every check once before the agent (pre-existing failures) | built; checks run planned |
| agent | `runAgent()` with the setup result | built |
| verify | Run every check again, independently of the agent. Next: compare with the baseline (fixed / regressed / still failing) | built; comparison planned |
| diff | Patch and per-file changes against the baseline | built |
| deliver | Commit, push, open the PR | planned (needs the GitHub App) |
| cleanup | Destroy the sandbox, always (unless asked to keep it) | built |

`runJob()` never throws for job problems. It returns a `JobResult`: `status` (the agent's status, or `failed` with `failedStage` and `error` when an earlier stage broke), plus the checkout, setup, agent, verify and diff results that exist. `checksPassed` is the verify outcome (`null` when there are no checks); failing checks don't change the agent's status.

Events: `stage_changed` (prepare, checkout, setup, agent, verify), `sandbox_created`, and the setup and agent events.

```
packages/runner/src/
├── index.ts              public API
├── job/                  runJob(), JobResult (+ unit and integration tests)
├── stages/               each stage: index.ts, its files and tests
│   ├── checkout/         clone or local copy; local-files picks what to copy
│   ├── setup/            detectors, install
│   ├── changes/          baseline commit, diff
│   └── verify/           re-run checks
└── lib/                  run-logged (command + full log), shell-quote
```

## 2. CLI: `pnpm agent:run`

`apps/cli` runs a job from the terminal and prints live progress, the summary, check results and the diff.

```bash
pnpm agent:run --repo ../my-project --task "Add a /health endpoint with a test"
pnpm agent:run --repo https://github.com/org/repo.git --ref main --task-file task.md --patch out.patch
```

- Configuration in `apps/cli/.env`: `OPENAI_API_KEY`, `AGENT_MODEL` (default `openai:gpt-6-luna`).
- Options: `--model`, `--max-steps`, `--max-cost`, `--timeout`, `--install` / `--no-install`, `--check name=cmd`, `--patch`, `--keep`, `--json`. See `--help`.
- Planned with environment onboarding: `pnpm agent:setup`, `--show-environment`, `--no-baseline-checks`; `--install`, `--no-install` and `--check` are removed in favor of the environment config ([environment.md](./environment.md)).
- Relative paths resolve against the folder the command was run from.
- Ctrl+C cancels cleanly (the sandbox is removed); a second Ctrl+C force-quits.
- Exit codes: 0 succeeded, 2 incomplete, 1 failed, 130 cancelled.
- Your local repository is never modified: the agent works on a copy.

## 3. Setup stage

> **Being replaced** by environment onboarding: a per-repository environment config created once through a guided conversation and replayed by every job. Design: [environment.md](./environment.md). The description below is the current implementation until that lands.

Prepares the repository the way a developer would, before the agent starts, so the agent begins with dependencies installed and knows how to check its work.

### Flow

1. **Detect:** each registered detector looks at the repository through `RepoReader`; the first match wins. No match: the agent is told no supported project type was found and can explore with `bash`.
2. **Overrides:** caller corrections win over detection. `install: "<cmd>"` or `false`; `checks: Check[]` replace detected checks with the same name. Used by CLI flags now, project settings in the UI later.
3. **Install:** the frozen (reproducible) command first, the lenient fallback if it fails; if both fail, setup **continues** and the agent sees the error. Output goes to `/tmp/codegenie/logs/setup-install.log` (`-retry.log` for the fallback). Timeout: 10 minutes.
4. **Result:** `SetupResult` (in `@codegenie/shared`): ecosystem, package manager, install result, checks, notes. Events: `setup_started`, `setup_completed { success, commands }`.

The caller passes `result.checks` to the agent's tool context (for `run_checks`) and the whole result to `runAgent({ setup })`, which summarizes it in the agent's prompt.

### Node detector (JavaScript / TypeScript)

Matches any repository with a `package.json` in the root.

**Package manager:** the `packageManager` field wins (corepack installs that exact version), then the lockfile, then npm.

| Signal | Manager | Frozen install | Fallback |
|---|---|---|---|
| `pnpm-lock.yaml` | pnpm | `pnpm install --frozen-lockfile` | `pnpm install` |
| `yarn.lock` | yarn | `yarn install --frozen-lockfile` | `yarn install` |
| `package-lock.json` / `npm-shrinkwrap.json` | npm | `npm ci` | `npm install` |
| `bun.lock` / `bun.lockb` | bun | not installed (note: bun is not in the sandbox) | – |
| no lockfile | npm (or the field) | plain install | – |

**Checks**, each run as `<pm> run <script>` in the repository root:

| Check | Scripts (first match) |
|---|---|
| lint | `lint` |
| typecheck | `typecheck`, `type-check`, `tsc`, `check-types`; otherwise `tsc --noEmit` via the package manager when `tsconfig.json` exists and `typescript` is a dependency |
| test | `test`, unless it is npm's placeholder (`no test specified`) |
| build | `build` |

### Non-interactive environment

The sandbox image sets `CI=true` (test runners don't start in watch mode) and `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` (corepack doesn't ask before downloading pnpm or yarn). This applies to every command, including the agent's own `bash` calls.

### Adding a language

Write a detector in `detectors/<language>/` implementing `EcosystemDetector`, add it to `DETECTORS`, and make sure its toolchain is available in the sandbox. Nothing else changes: checks are already a list with a working directory, and the result format is language-neutral.

## 4. Deferred (not in the MVP)

Moved into the MVP by environment onboarding ([environment.md](./environment.md)): several projects per repository, user-editable setup, baseline check run before the agent.

- [ ] Private repositories (needs GitHub App tokens)
- [ ] Node version selection (`.nvmrc`, `engines`) and toolchain checks; other languages via `mise`
- [ ] yarn 2+ specifics, bun, private registries, git submodules and LFS
