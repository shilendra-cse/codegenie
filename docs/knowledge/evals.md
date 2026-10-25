# Evals

> Status: **In progress** (harness and 10 tasks on 4 repositories built; baseline run: 10 of 10) · Last updated: 2026-10-25 · Code: `apps/evals` · Related: [runner.md](./runner.md), [environment.md](./environment.md), [development-plan.md](./development-plan.md)

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

### Progress while running

- **In a terminal**, a live view: one line per running task, redrawn in place (spinner, stage, steps and cost while the agent works, time), finished tasks listed above it, totals below:
  ```
  ✓ ts-lib/paginate-bug           1m 35s  $0.0041
  ✗ http-api/health               2m 10s  $0.0062  hidden tests failed
  ◒ dodesk/comment-author-only    agent · 12 steps · $0.0030 · 2:41
  ◓ dodesk/due-date-validation    setup · 0:52

  3 of 10 done · 2 running · $0.0133 · 6:40
  ```
- **Elsewhere** (pipes, CI): a line per stage change, and every 30 seconds while a task runs a line with its stage, steps, cost and time.
- **A full log per task** in `results/<time>/<repo>--<task>-<attempt>.log`: the same detail as `agent:run` (tool calls, check results, the agent's notes) plus the grade; its path is printed when the task starts, so `tail -f` follows one task.
- Code: `src/run/progress.ts` (`EvalProgress`), on `packages/terminal`.
- Later, `--verbose`: the full agent output in the terminal (implies `--concurrency 1`).

## 2. How a task runs

```
the repository's saved environment (onboarded once with the recommended answers)
  → runTask: sandbox → checkout → pin commit + task patch → setup → baseline → agent → diff → verify
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
├── paths.ts                the evals folder, repos/ and results/
├── suite/                  what to run
│   ├── repos.ts            repo.json, checkout source, commit pinning
│   ├── tasks.ts            task.json, hidden files, --task / --repo selection
│   └── environments.ts     saved environment, or onboarding (also when the commit changed)
├── run/                    how it runs
│   ├── run-evals.ts        onboarding per repository, then tasks with a concurrency limit
│   ├── run-eval-task.ts    one attempt: runTask (sandbox kept) → grade → diff saved
│   └── progress.ts         live progress: a line per running task, or periodic lines outside a terminal
└── graders/                how it's graded
    ├── grade.ts            picks the grader
    ├── hidden-tests.ts
    └── checks.ts
```

The runner gained one option for this: `afterCheckout` (in `runTask` and `runOnboarding`) runs right after checkout, where the harness pins the commit and applies the task's patch.

## 5. Results

Baseline, run 2026-10-19 with `openai:gpt-6-luna`: **10 of 10 solved**, $0.0214 in total, 25m 8s (two tasks at a time).

| Task | Solved | Checks | Steps | Time | Cost |
|---|---|---|---|---|---|
| buyerbook/budget-range | ✓ | 4 failing (already failing) | 11 | 4m 33s | $0.0026 |
| buyerbook/export-type-error | ✓ | 2 fixed, 2 failing (already failing) | 10 | 3m 33s | $0.0017 |
| dodesk/comment-author-only | ✓ | all passing | 15 | 8m 25s | $0.0048 |
| dodesk/due-date-validation | ✓ | all passing | 12 | 9m 45s | $0.0034 |
| dodesk/issue-labels-cleanup | ✓ | all passing | 10 | 6m 31s | $0.0020 |
| dodesk/issue-number-bug | ✓ | all passing | 7 | 7m 32s | $0.0024 |
| dodesk/relative-date | ✓ | all passing | 7 | 6m 39s | $0.0021 |
| http-api/health | ✓ | all passing | 5 | 17s | $0.0006 |
| ts-lib/paginate-bug | ✓ | all passing | 6 | 30s | $0.0008 |
| ts-lib/rename-fetch-user | ✓ | all passing | 10 | 43s | $0.0009 |

What it shows:

- **The suite is too easy to measure improvements.** With every task solved, a change to the agent can only show up as a drop. The task texts spell out the interface the hidden tests expect, which keeps grading fair but makes them easier than real tickets.
- **Time goes to setup, not the agent.** DoDesk tasks took 6–10 minutes for 7–15 agent steps: cloning, `npm ci` in `backend/` and `client/` (the client alone ~80 s), the baseline checks (client build ~45 s) and the same checks again in verify. Snapshots after setup ([environment.md](./environment.md), not in the MVP) are the largest speed-up available.
- **BuyerBook's checks were already failing**, so verify can't show new problems there (the pass/fail limitation in [environment.md](./environment.md)).
- **Cost is far below the limits:** about $0.002 per task against the $2 per-task limit, so harder tasks can use more steps.

## 6. Next

- [ ] Harder tasks: vaguer, ticket-like descriptions; features across several files; bugs that need investigation; manually graded BuyerBook tasks.
- [ ] `--repeat 3` runs to see whether results are stable.
- [ ] Faster tasks once runs get faster (setup snapshots, reused baselines; see the "Not in the MVP" list in [environment.md](./environment.md)): the eval run time is mostly setup.
- [ ] Rerun after every change to the agent's prompt, tools or model, and compare with the baseline above.
