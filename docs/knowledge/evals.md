# Evals

> Status: **In progress** (harness and 10 tasks on 4 repositories built; first real run pending) · Last updated: 2026-10-19 · Code: `apps/evals` · Related: [runner.md](./runner.md), [environment.md](./environment.md), [development-plan.md](./development-plan.md)

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

Hidden tests are checked when they're written: they must fail on the untouched repository (with the planted bug, if any) and pass with `reference.patch` applied, while the repository's own checks still pass. The reference solution stays in the task folder so this can be checked again; it's never copied into the sandbox.

Hidden tests are written against the interface the task text spells out (function names and signatures, error codes, messages), so a correct solution in any style passes.

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
    ├── planted.patch    optional (named in task.json): applied after checkout to plant a bug
    └── reference.patch  a correct solution, never used in runs (see below)
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

| Task | What | Grader |
|---|---|---|
| `ts-lib/paginate-bug` | fix the page offset (pages start at 1) | hidden tests |
| `ts-lib/rename-fetch-user` | rename `fetchUser` to `getUser` everywhere | hidden tests |
| `http-api/health` | add `GET /health` | hidden tests |
| `dodesk/comment-author-only` | only a comment's author may edit or delete it (403 otherwise) | hidden tests (backend vitest, mocked queries) |
| `dodesk/issue-number-bug` | planted bug: new issues reuse the previous number; find and fix it | hidden tests; the repository's own tests don't catch it |
| `dodesk/due-date-validation` | accept only real dates / ISO timestamps as `dueDate` | hidden tests (schemas) |
| `dodesk/issue-labels-cleanup` | trim, drop empty and de-duplicate labels on create and update | hidden tests (service, mocked queries) |
| `dodesk/relative-date` | `formatRelativeDate` in the client ("5 minutes ago", "yesterday", "Jun 5") | hidden tests (client vitest) |
| `buyerbook/export-type-error` | make the server compile again (`insertExportUrl.ts`) | checks: `typecheck@server`, `build@server` |
| `buyerbook/budget-range` | reject `budgetMax` below `budgetMin` in the buyer validators | hidden tests (`node --test`) |

Repositories: DoDesk at `fcc85c1` (all 8 checks pass), BuyerBook at `12e4333` (5 of 6 checks fail before any change; see the limitation in [environment.md](./environment.md)). Their saved environments come from the onboarding runs at those commits.

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

## 5. Next

- [ ] First full run with the real model; read the results together.
- [ ] More tasks where the results show gaps (e.g. multi-file features, UI changes graded manually).
