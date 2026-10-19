# Evals

> Status: **In progress** (E1 built: harness, graders, report, fixture repos with 3 tasks) · Last updated: 2026-10-19 · Code: `apps/evals` · Related: [runner.md](./runner.md), [environment.md](./environment.md), [development-plan.md](./development-plan.md)

Evals are a fixed set of tasks the agent is given, graded automatically. They answer "does the agent actually complete real tasks, and did a change make it better or worse?". Every change to the agent (prompt, tools, model) can be measured by running them again.

## 1. Running

```bash
pnpm eval                                     # every task
pnpm eval --repo ts-lib                       # one repository's tasks
pnpm eval --task ts-lib/paginate-bug --repeat 3
pnpm eval --onboard                           # onboard the repositories again first
```

- Uses the model and API key from `apps/cli/.env`. Every task is a real agent run and costs money; runs are manual only, never in CI.
- Tasks run two at a time (`--concurrency`).
- Output: one line per finished task, then the report. Saved in `apps/evals/results/<time>/` (git-ignored): `report.md`, `results.json` and each task's diff (`<repo>--<task>-<attempt>.patch`).

## 2. How a task runs

```
the repository's saved environment (onboarded once with the recommended answers)
  → runJob: sandbox → checkout → pin commit + task patch → setup → baseline → agent → diff → verify
  → grade in the same sandbox → destroy it
  → solved = graded as passed and no check regressed
```

| Grader | How | For |
|---|---|---|
| `hidden-tests` | test files the agent never saw are copied into the repository (`target`, default `codegenie-hidden/`) and `command` runs in `cwd`; exit 0 passes | most tasks |
| `checks` | the listed checks (`name@cwd`) must pass after the agent's changes | bug fixes in repositories without tests |
| `manual` | nothing automatic; the report asks for a review of the saved diff | open-ended tasks |

Hidden tests are checked when they're written: they must fail on the untouched repository and pass with a correct solution.

## 3. Repositories and tasks

Everything about one repository lives in one folder:

```
apps/evals/repos/<repo>/
├── repo.json            { "fixture": true }  or  { "git": "https://…", "commit": "<sha>" }
├── source/              the code, for fixtures only (real repositories are cloned)
├── environment.json     the saved environment (committed, so every run replays the same setup)
└── tasks/<task>/
    ├── task.json        task text, grader, optional patch and limits
    ├── hidden/          files for the hidden-tests grader (never visible to the agent)
    └── <name>.patch     optional: applied after checkout, e.g. to plant a bug
```

```json
{
  "task": "paginate() in src/paginate.ts returns the wrong items: …",
  "grader": { "type": "hidden-tests", "command": "node --test 'codegenie-hidden/*.test.*'" }
}
```

- Task ids are `<repo>/<task>`, e.g. `ts-lib/paginate-bug`.
- A real repository is pinned to one commit in `repo.json`, so results stay comparable while it keeps changing. The eval only reads it; nothing is ever pushed. The patch and the agent's changes exist only in the sandbox.
- `environment.json` records the commit it was made at. After the commit in `repo.json` changes, the next run onboards the repository again; a missing file is onboarded too, and `--onboard` redoes them all.
- `limits` (optional): `maxSteps`, `maxCostUsd`, `maxMinutes`.

| Task | Grader |
|---|---|
| `ts-lib/paginate-bug` | hidden tests: pages start at 1 |
| `ts-lib/rename-fetch-user` | hidden tests: `getUser` exists, `fetchUser` is gone, callers work |
| `http-api/health` | hidden tests: `GET /health` returns `{ "status": "ok" }`, other routes unchanged |

Fixtures: `ts-lib` is TypeScript run directly by Node 24 (`node --test`, `tsc --noEmit`); `http-api` is a dependency-free `node:http` server. Their checks all pass before any task.

## 4. Code layout

```
apps/evals/src/
├── main.ts                 arguments → model → tasks → runEvals → report files
├── args.ts · config.ts · report.ts           the command line
├── suite/                  what to run
│   ├── repos.ts            repo.json, checkout source, commit pinning
│   ├── tasks.ts            task.json, hidden files, --task / --repo selection
│   └── environments.ts     saved environment, or onboarding (also when the commit changed)
├── run/                    how it runs
│   ├── run-evals.ts        onboarding per repository, then tasks with a concurrency limit
│   └── run-task.ts         one attempt: runJob (sandbox kept) → grade → diff saved
└── graders/                how it's graded
    ├── grade.ts            picks the grader
    ├── hidden-tests.ts
    └── checks.ts
```

The runner gained one option for this: `afterCheckout` (in `runJob` and `runOnboarding`) runs right after checkout, where the harness pins the commit and applies the task's patch.

## 5. Next (E2)

- [ ] `repos/dodesk/` (pinned commit): issues filtered by priority, only the author edits a comment, team member pagination, a planted bug, a client utility. Hidden tests in the backend's and client's vitest setups.
- [ ] `repos/buyerbook/`: fix the existing `insertExportUrl.ts` type error (graded by checks), buyer phone validation (manual).
- [ ] First full run with the real model, read the results together.
