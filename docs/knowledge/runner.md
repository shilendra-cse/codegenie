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
| setup | Replay the given environment config, or draft one from the repository (rules) and apply it; failed steps flag the environment as needing attention ([environment.md](./environment.md)) | built |
| baseline | Commit the state after setup, then run every check once: passing / failing / broken / timed-out. Broken and timed-out checks are dropped; files the checks write are excluded from the diff | built |
| agent | `runAgent()` with the setup result | built |
| verify | Run the checks again and compare with the baseline: passing / fixed / regressed / still failing | built |
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
- Environment: `--environment <file>` replays a saved config, `--save-environment <file>` writes the config this run used, `--no-baseline-checks` skips the check run before the agent. `--install`, `--no-install` and `--check` only apply to drafted configs.
- Planned with environment onboarding: `pnpm agent:setup`, `--show-environment`; `--install`, `--no-install` and `--check` are removed in favor of the environment config ([environment.md](./environment.md)).
- Relative paths resolve against the folder the command was run from.
- Ctrl+C cancels cleanly (the sandbox is removed); a second Ctrl+C force-quits.
- Exit codes: 0 succeeded, 2 incomplete, 1 failed, 130 cancelled.
- Your local repository is never modified: the agent works on a copy.

## 3. Setup

Setup now runs from an **environment config** (steps + checks): either one passed in, which is replayed, or one drafted by the rules and applied. The full design, including onboarding, lives in [environment.md](./environment.md).

```
packages/runner/src/
├── job/                 runJob(): runs the stages in order
├── stages/              one folder per stage, in run order
│   ├── checkout/
│   ├── setup/           run-setup.ts: apply steps, baseline commit, baseline checks, check artifacts
│   ├── verify/          rerun checks; compare.ts: passing / fixed / regressed / still failing
│   └── changes/         baseline commit + diff (check artifacts excluded)
└── environment/         config building blocks, independent of jobs (reused by onboarding)
    ├── config.ts        schema: parseEnvironmentConfig()
    ├── build-config.ts  draft + results → EnvironmentConfig
    ├── apply.ts         run steps in order; install alternatives (frozen first, then lenient), keeping what worked
    ├── checks.ts        run checks; classify passing / failing / broken / timed-out
    └── draft/           rules: draft.ts, detector.ts, repo-reader.ts, detectors.ts (registry), node/
```

### Node rules (draft)

The `packageManager` field wins (corepack installs that exact version), then the lockfile, then npm.

| Signal | Manager | Install (frozen) | Alternative |
|---|---|---|---|
| `pnpm-lock.yaml` | pnpm | `pnpm install --frozen-lockfile` | `pnpm install` |
| `yarn.lock` | yarn | `yarn install --frozen-lockfile` | `yarn install` |
| `package-lock.json` / `npm-shrinkwrap.json` | npm | `npm ci` | `npm install` |
| `bun.lock` / `bun.lockb` | bun | not installed (bun is not in the sandbox) | – |
| no lockfile | npm (or the field) | plain install | – |

Checks from `package.json` scripts, run as `<pm> run <script>`: `lint`; `typecheck` / `type-check` / `tsc` / `check-types` (or `tsc --noEmit` for TypeScript projects without one); `test` (ignoring npm's placeholder); `build`. Only the repository root is considered until multi-project rules land (environment part B).

### Non-interactive environment

The sandbox image sets `CI=true` (test runners don't start in watch mode) and `COREPACK_ENABLE_DOWNLOAD_PROMPT=0`. This applies to every command, including the agent's own `bash` calls.

## 4. Deferred (not in the MVP)

Moved into the MVP by environment onboarding ([environment.md](./environment.md)): several projects per repository, user-editable setup, baseline check run before the agent.

- [ ] Private repositories (needs GitHub App tokens)
- [ ] Node version selection (`.nvmrc`, `engines`) and toolchain checks; other languages via `mise`
- [ ] yarn 2+ specifics, bun, private registries, git submodules and LFS
