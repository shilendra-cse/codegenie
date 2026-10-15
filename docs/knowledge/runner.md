# Runner

> Status: **In progress** (setup stage built) · Last updated: 2026-10-15 · Code: `packages/runner` · Related: [agent.md](./agent.md), [sandbox.md](./sandbox.md), [architecture.md](./architecture.md)

The runner executes a coding job end to end: get the repository into a sandbox, prepare it, run the agent, verify the result and deliver it. It contains **no AI logic of its own**: everything it does is deterministic. The AI work happens in `@codegenie/agent`, which the runner calls.

The CLI (`apps/cli`) and the worker (`apps/worker`) both use the runner, so a local run behaves exactly like production.

## 1. Stages

```
checkout → setup → agent → verify → deliver
```

| Stage | What it does | Status |
|---|---|---|
| checkout | Repository into `/workspace` (clone or local copy) + baseline commit | planned |
| **setup** | Detect the project type, install dependencies, find check commands | **built** |
| agent | `runAgent()` from `@codegenie/agent`, with the setup result | agent built; wiring planned |
| verify | Run the checks again after the agent | planned |
| deliver | Commit, push, open the PR | planned |

```
packages/runner/src/
├── index.ts
├── lib/shell-quote.ts
└── stages/
    └── setup/
        ├── run-setup.ts           runSetup(sandbox, { runId, emit, overrides }) → SetupResult
        ├── install/run-install.ts frozen install → fallback → continue on failure
        ├── core/
        │   ├── detector.ts        EcosystemDetector interface, Detection, InstallPlan
        │   └── repo-reader.ts     read-only view of the repo for detectors
        └── detectors/
            ├── index.ts           registry: [nodeDetector]
            └── node/              package-manager · scripts · node-detector
```

## 2. Setup stage

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

## 3. Deferred (not in the MVP)

- [ ] `.codegenie.yml` for repository owners to override install and checks
- [ ] User settings layer (project setup editable in the UI, stored in `projects.setup_config`)
- [ ] Several projects per repository (e.g. `web/` and `api/` each with their own install and checks)
- [ ] Node version selection (`.nvmrc`, `engines`) and toolchain checks; other languages via `mise`
- [ ] Baseline check run before the agent starts, to separate pre-existing failures from new ones
- [ ] yarn 2+ specifics, bun, private registries, git submodules and LFS
