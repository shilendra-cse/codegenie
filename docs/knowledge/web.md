# Web app

> Status: **Accepted** (Phase 4) · Last updated: 2026-10-23 · Code: `apps/web` · Related: [ui.md](./ui.md) (screens, states) and its [design canvas](https://claude.ai/artifact/7CrGGxQmeSht3KyDnahRUr), [api.md](./api.md) (the API it calls), [development-plan.md](./development-plan.md)

How the web app is built: the stack, how it talks to the API, how the code is organized, and the order we build it in. **What** each screen shows is in ui.md; this file is **how**.

## 1. Stack

| | |
|---|---|
| Framework | **Next.js** (App Router), React 19, TypeScript |
| Styling | Tailwind v4 with our design tokens (§7) |
| Components | shadcn/ui on Radix, kept in `components/factory/` and only used through our atoms (§6) |
| Data | **axios** for HTTP, **TanStack Query** for loading and caching, the browser's **EventSource** for live run events |
| Auth | Better Auth's React client, GitHub sign-in |
| State | server data in TanStack Query, filters in the URL, the theme in next-themes; **Zustand** only once a real need shows up |
| Tests | Vitest + Testing Library; Playwright for the end-to-end journey |

**How Next.js is used.** Public pages (landing, sign-in) are rendered on the server: fast and readable by search engines. Everything behind sign-in is client-side React: the screens are live and change constantly, the API is its own Express server, and server rendering would add a second place for bugs without helping. So no server components fetching data and no server actions.

## 2. Talking to the API

```
browser ──► localhost:3000/api/*  ──(next.config rewrites)──► localhost:3001/api/*
```

The browser only ever calls `/api/...` on the web app's own address; Next forwards it to the API. To a browser, `:3000` and `:3001` are different websites, and it limits what one may do with another: cookies aren't sent across and every request needs CORS permission. Forwarding makes the API part of the web app's own site, so the session cookie just works and there's no CORS. In production it's one domain.

**Sign-in** goes through the same door: `BETTER_AUTH_URL` is the web app's address and the GitHub App's callback URL is `http://localhost:3000/api/auth/callback/github`, so the session cookie is created for the web app's address.

**Security.** Nothing new is exposed: only `/api/*` is forwarded, and the API still checks the session on every request. The cookie stays on one site (`httpOnly`, `SameSite=Lax`), and Better Auth trusts only the web app's origin (`FRONTEND_URL`). The forwarding target comes from `API_URL` (server-side only).

**The client** (`lib/api/`):
- `client.ts`: one axios instance, `baseURL: "/api"`. Responses: the `{ status, message, type, data }` envelope is unwrapped, callers get `data`. Errors: a typed `ApiError` with the API's `status`, `code` (e.g. `PROJECT_NOT_SET_UP`) and `message`; a **401** sends you to `/signin`.
- `<domain>.ts`: one small typed function per endpoint (`getProjects()`, `createTask(projectId, input)`, `cancelRun(id)`…).
- Live run events don't go through axios (§5).

## 3. Loading and caching data

TanStack Query wraps the axios functions in hooks per domain (`useProjects()`, `useTasks(filter)`, `useTask(id)`, `useCreateTask()`…), in `features/<domain>/`. Pages use the hooks, never axios directly. It avoids fetching the same thing twice, refreshes when you come back to the tab, polls while a run is in progress (Inbox, project tasks), and refreshes lists after a change (a task created → the Inbox refreshes).

## 4. The API contract (`@codegenie/shared`)

Request schemas and response types live in one shared package, organized by domain like the server's `resources/`:

```
packages/shared/src/api/
  envelope.ts      ApiSuccess<T>, ApiErrorBody, the error codes
  github.ts        GitHubInstallation, GitHubRepo
  projects.ts      createProjectSchema, projectParamsSchema · ProjectResponse
  tasks.ts         createTaskSchema, listTasksQuerySchema, taskParamsSchema · TaskListItem, TaskDetail, TaskLabel, CreatedTask
  runs.ts          runParamsSchema, afterSeqSchema · RunResponse, RunDiff, CancelOutcome
  events.ts        RunEvent and its variants
```

- **Requests:** zod schemas. The server validates with them; the web can validate forms with the same rules.
- **Responses:** types. The server's mappers must return them and the web's axios functions are typed with them, so a field renamed on the server breaks the web's build, not its users.
- One file per domain is the readable reference for that part of the API; OpenAPI stays the published one.
- Types disappear at build time, so nothing extra ships. The older draft types in `packages/shared/src/types/api.ts` (`Project`, `Task`, `CreateTaskRequest`…) aren't used anywhere and are replaced.

## 5. The live run view

The screen you watch while the agent works. Its data arrives as a stream of small events ("stage changed", "started reading app.ts", "edited routes.ts", "done") over `GET /api/runs/:id/events` ([api.md](./api.md) §6). Two separate pieces:

1. **The connection, `useRunEvents(runId)`:** opens an `EventSource`, collects events into a list as they arrive, reconnects with `Last-Event-ID` (the browser does it), closes on `done`. It only receives.
2. **The translator, a pure function:** reads the list and works out what to show: stage states, tool calls grouped into "Explored the code · 6 files", edits with +/−, commands with results, the latest reasoning line, the PR. It only understands.

The translator is the hard logic of the main screen; as a plain function it's tested with lists of fake events, no browser or server. The run card just draws its result. (Detailed with a diagram in step 6.)

## 6. Code structure: atomic design

```
apps/web/
  app/                      pages: a route + data hooks + a template
    (marketing)/page.tsx    landing
    signin/page.tsx
    (app)/layout.tsx        the app shell, for signed-in pages
    (app)/welcome · inbox · new
    (app)/projects/new · [id] · [id]/environment · [id]/settings
    (app)/tasks/[id]
  components/
    factory/                library components as generated (shadcn/Radix); never edited, only used by atoms
    atoms/                  our wrappers: our names, props and styling (Button, Input, Badge, Icon, Spinner, Logo…)
    molecules/              a few atoms doing one job (StatusBadge, ActivityRow, FileRow, NavItem…)
    organisms/              complete sections (Sidebar, RunCard, QuestionCard, PrCard, TaskTable, DiffViewer…)
    templates/              page layouts with slots (AppShell, ConversationLayout, TabbedPage, MarketingLayout)
  features/<domain>/        data only: query hooks, the run-events translator (projects, tasks, runs, onboarding)
  lib/                      api/ (axios), query client, auth client
  middleware.ts             the sign-in guard
```

- **Atoms through templates never fetch data.** They take props and render; only pages, through `features/` hooks, load data.
- **Library code stays in `factory/`.** Only atoms import it (or `@radix-ui/*`); the rest of the app knows only our atoms' API. Swapping a library changes atoms only. ESLint enforces it, like the query layer on the server.
- Each layer imports only from the layers below it.

## 7. Look and feel

- **Tokens:** the canvas's colours named once in `app/globals.css`, with a light and a dark value each: surfaces, borders, text (3 levels), the **mono accent** (black in light mode, white in dark), and status colours (`ok`, `warn`, `err`, `merged`, with soft background and border variants), plus `add` / `del` for diffs. They map onto shadcn's variables, so every atom picks them up. Components use names, never raw colours.
- **Fonts:** Geist and Geist Mono through `next/font`. **Icons:** lucide. **Logos:** `public/brand/` (black on light, white on dark).
- **Theme:** follows the system, switchable in the account menu (next-themes).
- **Motion and glow** ([ui.md](./ui.md) §2): plain CSS in `app/globals.css` (`grid-backdrop`, `glow`, `beam`, `sheen`, `rise`, `reveal`), with one reduced-motion block that stops them all; no animation library. Atoms `GridBackdrop` and `Glow` place the backdrop. Each step's screens apply them as they're built: the beam and sheen on what is working, rise on what arrives, the glow on the page's primary action, hover on what opens.
- **Diffs:** our own small renderer for the Changes tab.
- **Layout:** flexbox by default; CSS grid only where a layout really needs two-dimensional alignment (e.g. a table-like set of rows and columns that must line up).

## 8. Sign-in and routing

- `middleware.ts`: without a session cookie, any `(app)` route redirects to `/signin`; signed in, `/` and `/signin` redirect into the app. Any 401 from the API also sends you to `/signin`.
- After signing in you land on `/welcome` until you have a task, then `/inbox` (from step 8).
- GitHub's App install callback returns to `/welcome?github=…` (signing in first returns there too); once Add a repository exists, returning users go to `/projects/new`.

## 9. Testing

- **Vitest + Testing Library:** atoms through organisms, query hooks against a faked API, and above all the run-events translator.
- **Playwright** (step 9): sign in → task → live events → PR link, with a mocked model.
- Every step is also checked by running the app: screenshots against the canvas, light and dark, and at phone width.

## 10. How we build: step by step through the user's journey

Each step: **requirements first** (written here, approved) → built bottom-up within the step (only the atoms and molecules it needs) → checked against the canvas → committed in small batches.

| Step | At the end you can | Branch |
|---|---|---|
| 1. Sign in | open the landing page, sign in with GitHub, arrive in the app | `feat/web-sign-in` |
| 2. Connect GitHub | see the welcome checklist, install the App, come back | `feat/web-connect` |
| 3. Add a repository | pick a repo; it becomes a project in the sidebar | `feat/web-add-repo` |
| 4. Set up the environment | watch setup, answer its question, save; onboarding events stored server-side | `feat/web-onboarding` |
| 5. Start a task | describe a task and start it | `feat/web-new-task` |
| 6. Watch it work | the live run view: stages, activity, diff, terminal | `feat/web-run-view` |
| 7. Get the PR | the finished run, PR card, cancel, every outcome | `feat/web-outcomes` |
| 8. Find your work | Inbox, project page, history | `feat/web-inbox` |
| 9. End to end | the whole journey in Playwright | `feat/e2e` |

## 11. Step 1: Sign in (requirements)

**Goal:** a visitor opens the landing page, signs in with GitHub and arrives in the app shell; everything underneath (contract, tokens, client, guard) is in place for the steps after.

**Screens** (canvas: Landing, Sign in; the shell from any app screen):
- **Landing `/`:** as drawn: header (logo, How it works, Security, Sign in, Get started), hero with "Sign in with GitHub", product preview, how it works, security points, closing call to action, footer. Signed in → redirected into the app.
- **Sign in `/signin`:** the card as drawn; "Continue with GitHub" starts Better Auth's GitHub sign-in and returns to `/welcome`. States: default, signing in (button busy), failed (`?error=…` → the error box).
- **App shell `(app)/layout`:** sidebar (logo, New task, Inbox, Projects with "No projects yet", account menu with avatar, name, theme switch and Sign out) and the content area. Pages behind it in this step: `/welcome` with only its greeting ("Welcome, <name>"); step 2 fills it in.

**Underneath:**
- The shared contract (§4): request schemas and response types move from the server into `packages/shared/src/api/`; the server uses them; the unused draft types go.
- `next.config.ts` rewrite of `/api/*` to `API_URL` (default `http://localhost:3001`); the auth client on the same origin, no hard-coded URLs.
- `lib/api/client.ts` (envelope, `ApiError`, 401), the TanStack Query provider.
- Tokens, fonts, theme (§7); the old dot-matrix background and sign-in styling go.
- `components/factory/` holds the shadcn primitives; atoms for this step: Button, Logo, Icon, Avatar, Spinner, Link, Menu; ESLint rule for the layers.
- `middleware.ts` (§8).

**API used:** Better Auth's `/api/auth/*` (sign in with GitHub, get session, sign out), through the rewrite.

**Done when:**
1. `/` matches the canvas in light and dark and at phone width, with no horizontal scroll.
2. "Sign in with GitHub" goes to GitHub and comes back to `/welcome` inside the shell, with your name and avatar in the account menu.
3. A reload keeps you signed in; Sign out returns you to `/`; opening `/welcome` signed out sends you to `/signin`; opening `/signin` signed in sends you into the app.
4. In the browser's network tab, every request goes to `localhost:3000`; nothing calls `:3001` directly.
5. Importing `components/factory/*` or `@radix-ui/*` outside `components/atoms/` fails lint.
6. Tests cover: the axios client (envelope unwrapped, `ApiError` with `code`, 401 → `/signin`), the middleware's redirects, and the atoms built.
7. The server's tests, lint and type-check still pass with the shared contract.

**Batches** (proposed):
1. **Shared contract:** `packages/shared/src/api/` by domain; the server's resources import from it; the old draft types removed.
2. **Plumbing:** the rewrite and `API_URL`, the axios client, the Query provider, the auth client on the same origin, `middleware.ts`; tests.
3. **Look:** tokens, fonts and theme; `factory/` and the step's atoms; the ESLint layer rule.
4. **Public pages:** landing and sign-in from the canvas.
5. **App shell:** the AppShell template, sidebar, account menu (theme, sign out), `/welcome` greeting; screenshots against the canvas.

## 12. Connect GitHub (requirements)

**Goal:** `/welcome` shows the first-run checklist; "Install on GitHub" goes to GitHub and you come back to `/welcome` with that step done.

**Screen `/welcome`** (canvas: Welcome):
- The greeting ("Welcome, <first name>" and the subtitle), then a checklist of 4 steps. Done steps are ticked, the current one shows its button and hint, later ones are muted:
  1. **Install the GitHub App**: done when you have any installation (`GET /github/installations`); the button goes to its `installUrl`.
  2. **Add a repository**: done when you have any project (`GET /projects`); "Choose a repository" → `/projects/new`.
  3. **Set up its environment**: done when any project has an environment; → that project's environment page.
  4. **Describe your first task**: done when any task exists (`GET /tasks`, first page); → `/new`.
- The note about JavaScript and TypeScript repositories under it.
- **States:** loading (a skeleton of the checklist), an API error (an alert with Try again), GitHub sign-in expired (the API's 401 `GITHUB_SIGN_IN_REQUIRED` → `/signin?next=/welcome`, as any 401).
- **Back from GitHub**, `/welcome?github=…` shows a notice, then the parameter is removed from the address:
  - `installed`: "GitHub App installed."
  - `requested`: "Installation requested. An owner of the organisation needs to approve it."
  - `cancelled`: "Installation cancelled."
  - `not-found`: "We couldn't find that installation on your account."
- **Touches** ([ui.md](./ui.md) §2): the backdrop goes into the AppShell once, below any top bar, so every app page has it; on `/welcome` the greeting and checklist rise in, and the current step's button has the glow.
- The sidebar's Projects list stays "No projects yet." here; it lists projects once Add a repository exists.

**Steps in place** (added after trying the first version, [ui.md](./ui.md) Welcome): the current step opens inside the checklist instead of linking away. Step 2 holds the repository picker (`useRepositoryPicker`, shared with `/projects/new`; on Welcome it loads repositories only while step 2 is open, and its install link returns to Welcome); once added, step 2 reads "<name> added." and step 3 opens. Step 3's "Start setup" and step 4's "New task" show as coming soon until environment setup and New task fill them in place (the live setup card, the task box).

**Getting started card:** in the sidebar until the four steps are done, from the same checklist data; "N of 4", a progress bar, "Next: …", linking to `/welcome`; hidden on `/welcome`.

**Server:** the install callback returns to `/welcome?github=<outcome>`, and sends someone signed out to `/signin?next=/welcome`.

**Underneath:**
- `features/github/` `useInstallations()`, `features/projects/` `useProjects()`, `features/tasks/` `useHasTasks()`: an axios function and a Query hook each, typed by the shared contract.
- `features/onboarding/checklist.ts`: a pure function from those three results to the 4 steps (done, current or todo, and where each button goes).
- Molecule `checklist-step`, organism `welcome-checklist` (with its loading and error states); the `Alert` atom for the notices.

**Done when:**
1. A new user sees step 1 current; installing on GitHub brings them back to `/welcome` with "GitHub App installed." and step 2 current.
2. Cancelling on GitHub, or requesting an organisation's approval, comes back with the right notice.
3. The checklist matches the canvas's Welcome board (steps 1 and 2) in light and dark and at phone width.
4. Tests cover the checklist function for each combination, the step and checklist components with their states, the notices and removing the parameter, and the callback's redirects.
5. The web and server tests, lint and type-check pass.

**Batches:**
1. **Server:** the callback's redirects and their test; these requirements.
2. **Data:** the three query hooks and the checklist function, with tests.
3. **Screen:** the checklist components, the notices, the AppShell backdrop and `/welcome`, with tests.

## 13. Add a repository (requirements)

**Goal:** from the checklist's "Choose a repository" you pick a repository; it becomes a project in the sidebar and the checklist moves on to setting it up.

**Screen `/projects/new`** (canvas: Add a repository):
- A solid top bar "Add a repository", then "Choose a repository" and its subtitle.
- **Account picker:** the user's installations (personal account and organisations), the first selected.
- **Search:** filters the list by name as you type, without new requests.
- **Rows:** name and a Private badge; language with its coloured dot and "Updated 2 hours ago"; **Add**, or **Added · Open** for a repository that is already a project; for one that isn't JavaScript or TypeScript and isn't added, "Doesn't look like JavaScript or TypeScript. CodeGenie may not be able to set it up."
- **Adding:** the button is busy while `POST /projects` runs; the row becomes **Added · Open**, the project appears in the sidebar and the checklist moves to step 3. Open goes to `/projects/:id` (its page comes later).
- **Footer:** "Change which repositories CodeGenie can access on GitHub", to the installation's settings (a personal account's and an organisation's URLs differ).
- **States:** loading (skeleton rows); no installations (install the GitHub App); an installation with no repositories (a note and the access link); no search match ("No repositories match …"); an API error (alert with Try again); GitHub sign-in expired (any 401 → sign in); adding fails, shown in the row: suspended installation (409) "The GitHub App is suspended on this account.", repository gone (404) "This repository is no longer available to CodeGenie."
- **Installing on another account** from this page adds `state=add-repo` to the install link, so GitHub returns here with the same notices as on `/welcome`.
- **Touches:** the backdrop below the top bar; the heading and list rise in; rows light up on hover; no button glow (every row has an Add).

**Sidebar:** Projects lists your projects with a dot for the environment (green ready, amber needs attention, grey not set up), each linking to `/projects/:id` and marked when current; a **+** beside the heading goes to `/projects/new`; "No projects yet." when there are none.

**Server:** repositories gain `language`; the install callback returns to the page named by the install link's `state` (`add-repo` → `/projects/new`, anything else → `/welcome`).

**Underneath:** `features/github` `useRepositories(installationId)`; `features/projects` `useCreateProject()`, which refreshes the projects and that installation's repositories after adding; `lib/format.ts` for relative times (`Intl.RelativeTimeFormat`).

**Done when:**
1. With a new account: pick a repository, Add, and it shows **Added · Open**, appears in the sidebar, and `/welcome` shows step 3 current.
2. Installing on another account from this page comes back to `/projects/new` with the notice.
3. The page matches the canvas in light and dark and at phone width.
4. Tests cover the row in each state (add, adding, added, warning, error), the search, every page state, the sidebar's projects, the hooks, and the server's `language` and `state`.

**Batches:**
1. **Server:** `language`; the install link's `state` and the callback's return page; these requirements.
2. **Data:** `useRepositories`, `useCreateProject`, relative times; tests.
3. **Sidebar:** the projects list and its **+**.
4. **Screen:** `/projects/new` with its states.

## 14. Environment setup in the browser (requirements)

**Goal:** from the Welcome checklist's step 3 (or a project), you start setup, watch it work, answer its questions, and it ends saved; the checklist moves on to step 4.

**The setup page `/projects/:id/environment`** (canvas: Environment setup):
- **Top bar:** "<project> / Environment setup", a status badge (Queued, Setting up, Waiting for your answer, Saved as vN, Failed, Stopped), time and cost, **Stop setup** while it runs or waits.
- **Not started:** what setup does, and **Start setup**.
- **The conversation:** CodeGenie's intro; a **timeline card** built from the events (projects found, installed with a command, checks with their badges, the agent's work grouped and expandable, info lines) with the beam while running and new lines rising in; a **question card** (question, why, options with the first marked Recommended, Something else when allowed, **Answer**; then your answer with your avatar; "Question N · I ask at most 5"); the **result**: saved (the environment's steps, checks and decisions, "Saved. <project> is ready.", **Describe your first task**, to New task with the project picked), failed (the reason, **Try again**), stopped (**Start again**).
- **Live:** reloading replays everything and continues; when setup ends the sidebar dot and the checklist update.

**Welcome step 3, in place:** **Start setup** starts it; the step shows a compact live card (beam, "Setting up <project>", the latest 3 lines, **Watch it live →**); while waiting, the question and **Answer** (opens the setup page); done ticks the step; failed or stopped shows the reason and **Try again**.

**Getting started card:** "Next: Set up <project> · in progress", or "· needs your answer".

**Sidebar:** the project being set up shows "Needs you" while its setup waits for an answer (only that project, to avoid asking for every project's setup); its dot turns green once saved.

**Underneath:** `features/setup/` (kept apart from `features/onboarding/`, the Welcome checklist): `api.ts`; `useOnboarding`, `useEnvironments`, and start / answer / stop mutations that update the cached setup; `useOnboardingEvents` (an `EventSource` on `/api/projects/:id/onboarding/events`, in order without repeats, closed on `done` or once ended, refreshing the setup, projects and environments); `buildTimeline(events)` (pure: the lines, the open question, the latest 3, whether it's done). Setup reports `setup_drafted` and phased `setup_completed` events for the timeline ([api.md](./api.md) §6).

**Not here:** the project page's Environment tab (versions, rollback, editing), re-running setup from "needs attention".

**Done when:**
1. With a new account: step 3 → Start setup → the live card → Watch it live → answer a question if one comes → saved; the step ticks and the sidebar dot turns green.
2. Reloading mid-setup shows everything so far and keeps going; the stream comes through the Next rewrite as it happens.
3. Stop works; a failed setup shows its reason with Try again.
4. Both boards match in light and dark and at phone width.
5. Tests cover the timeline for each event kind, the hooks (the events hook with a fake stream), each component state, the page states, and step 3.

**Batches:** 1. setup's structured events and the data layer; 2. the missing states on the canvas's Environment setup board; 3. the setup page; 4. Welcome step 3, the card and the sidebar.


## 15. Start a task (requirements)

**Goal:** you describe a change for a project that's set up, start it, and land on the task; the Welcome checklist's last step is done.

**The New task page `/new`** (canvas: New task (home)):
- "What should CodeGenie do?", a large composer, and below it a row with the **project picker**, the **base branch**, the shortcut hint (⌘↵) and **Start**.
- **Project picker:** your projects with their default branch. Projects that aren't ready are listed but can't be picked, each with the reason: "Not set up" or "Needs attention" (each with a link to fix it), or "GitHub App suspended" / "GitHub App removed". **Add a repository** at the bottom goes to `/projects/new`. It starts on the project in `?project=`, else the last one you used, else the first ready one.
- **Base branch:** a dropdown showing the project's default branch. Opening it loads the repository's branches (`GET /projects/:id/branches`, once per project for 5 minutes): a search box, the list with the default first and marked, ✓ on the picked one, ↑↓ / ↵ / esc, "No branches match.", placeholders while loading, the reason with **Try again** when it can't load, and a note when only the first 1,000 are listed. Built on shadcn's Command (`cmdk`) in a Radix Popover.
- **Start:** enabled once there's text and a ready project; ⌘↵ (Ctrl↵) starts too. Busy while starting; then you go to `/tasks/:id`.
- A one-line hint on writing good tasks.
- **Recent tasks:** your latest 5 (title, project, status badge), each linking to its task; **View all** to the Inbox comes with the Inbox. Hidden when you have none.
- **States:** no projects (a note and **Add a repository**); no ready project (the picker shows why, with a link to finish setup); loading (skeletons); starting fails, shown above Start: not set up (409) with a link to its setup, needs attention (409) with a link to re-run setup, CodeGenie busy (503) "CodeGenie can't take new work right now. Try again in a moment.", anything else with **Try again**. The text you wrote is kept.
- **Touches:** the backdrop and rise-in like the other pages; **Start** glows.

**The task page `/tasks/:id`, first version:** the top bar (project › title, status badge), your message (avatar, time), and a card saying what the run is doing (Queued, Working, or how it ended) that refreshes every few seconds while it runs. The live run view replaces the card in step 6.

**Welcome step 4, in place:** a small task box for the project you just set up (its branch, **Start**, the hint); after starting, the step reads "“<title>” is running." with **Watch it work**, and the heading becomes "Your first task is running." The step is done once any task exists.

**Elsewhere:** the setup page's **Describe your first task** opens `/new?project=<id>`; the sidebar's **New task** goes to `/new` (marked when current) and **Recent** lists your last 10 tasks with a status icon, each linking to its task.

**Underneath:** `features/tasks/`: `api.ts`; `useTasks(projectId?)` (first page only, refetched every 3 s while any task is queued or working), `useTask(id)` (refetching every 3 s while the latest run is queued or running), `useStartTask(projectId)` (refreshes the task lists); `taskReadiness(project)` (ready, or the reason and its fix) and `startTaskError` (the messages above). `useNewTask` (the composer's state: text, project, branch, starting), shared by `/new` and Welcome step 4. `lib/routes.ts` gains `NEW_TASK`, `newTaskPath`, `environmentPath` and `taskPath`. Uses `POST /projects/:id/tasks`, `GET /tasks`, `GET /tasks/:id`; no server changes.

**Not here:** the live run view, outcomes and the PR card (steps 6–7), the Inbox (step 8).

**Done when:**
1. After setup: Describe your first task → `/new` with the project picked → Start → `/tasks/:id` shows Queued, then Working.
2. From Welcome step 4, a task starts in place and the step ticks; the heading changes.
3. A project that isn't ready can't be picked and says why; each start error shows its message and keeps the text.
4. The pages match the canvas in light and dark and at phone width.
5. Tests cover the picker's choices and reasons, the branch field, Start's enabling and shortcut, each error, the hooks, the task page's states, step 4, and the sidebar's Recent.

**Batches:** 1. these requirements and the missing states on the canvas; 2. the tasks data layer; 3. the New task page; 4. the task page's first version, Welcome step 4, the setup page's link and the sidebar.

## 16. Watch it work (requirements)

**Goal:** on a task's page you watch its run as it happens, the same way you watch setup: what stage it's in, what the agent is reading, editing and running, what it's thinking, which files changed and every command's output. Reloading loses nothing. (The finished run's full outcome, the PR card, Cancel and every outcome state are step 7.)

**The task page `/tasks/:id`** (canvas: Task: run in progress):
- **Top bar:** project › title (it updates when the run writes the task's short title, `task_titled`), the status badge, the base branch, duration and cost so far.
- **Conversation:** your message, then the **run card**:
  - header: CodeGenie, Run N, status, steps and cost (from `agent_step` while live; from the run once ended);
  - **stages** Prepare · Set up · Working · Checks · Pull request, each pending / running (spinner) / done (✓) / failed, with a one-line summary and its duration: Prepare "Sandbox ready, cloned `main`"; Set up "Environment vN · before: 5 checks passing" (from `setup_completed`); Working "N steps"; Checks "run again and compared" until done, then "5 passing" or "1 broken by this change"; Pull request "on a new branch" until `pr_opened`;
  - **Working** shows the agent's activity, built from `tool_start` / `tool_end`: consecutive reads, searches and listings fold into "Explored the code · read 6 files, searched 2 times" (expandable); each edit or written file is a row with its path; each command a row with its result (✓ exit 0, ✗ exit N); `run_checks` a row with its results; the one in progress has a spinner. The agent's latest reasoning streams underneath in a quieter style (`text_delta`, live only);
  - the beam while the run is queued or running; new rows rise in.
- **Side panel**, tabs:
  - **Changes:** while running, the files the agent has edited or written, with +/− counted from its edits (the lines it replaced and wrote), and "The full diff appears when the run finishes."; once the run has ended, the real diff (`GET /runs/:id/diff`): files with +/−, a file's lines when picked.
  - **Terminal:** every command the agent ran, newest last, with its output and exit code; the one running shows "running…". Output is what the run reports, at most 2,000 characters a command, marked when cut short (full logs come later).
  - **Checks:** each check with **Before** (`setup_completed`) and **After** (`checks_completed`, new): passing · fixed · broken by this change · still failing · pending until Checks has run.
  - Picking an edit or a command in the run card opens it in the panel.
- **States:** queued (stages pending, "Waiting for a sandbox"), running, ended (stages final; the summary and the PR link as today, until step 7), the stream reconnecting, the task not found, couldn't load.
- **At phone width** the panel stacks below the conversation.

**Server:** the runner emits **`checks_completed`** when Checks ends: each check's name, folder, command, status and comparison with before (`passing`, `failing`, `fixed`, `regressed`, `still-failing`). Stored like the other events.

**Underneath:**
- `features/runs/`: `useRunEvents(runId)`: an `EventSource` on `/api/runs/:id/events`, stored then live, in order without repeats, closed on `done` or once the run has ended; `text_delta` and `agent_step` kept apart (live only). Refreshes the task when the run's stage, title or outcome changes.
- `buildRunView(events)`: pure. The stages with their state, summary and duration; the activity groups; the latest reasoning; steps and cost; the files touched; the commands with their output; the checks before and after; the PR. Tested with lists of events, no browser or server.
- `useRunDiff(runId)` once the run has ended.
- The polling task page from step 5 stops polling: the stream drives it.

**Not here:** Cancel, the finished run's outcome card (summary, checks table, PR card, failed / cancelled / no changes / incomplete), follow-ups (step 7); full command logs; a live diff while running.

**Done when:**
1. Starting a task and opening it shows each stage in turn, the agent's activity and reasoning as they happen, then the end.
2. Reloading mid-run shows everything so far and keeps going; the stream comes through the Next rewrite as it happens.
3. Changes, Terminal and Checks show what the run did; picking a row opens it.
4. The page matches the canvas in light and dark and at phone width.
5. Tests cover `buildRunView` for each event kind (grouping, stages, durations, checks), the events hook with a fake stream, each component state, and the page.

**Batches:** 1. these requirements and the canvas; 2. `checks_completed` in the runner and worker; 3. the run's events in the browser (`useRunEvents`, `buildRunView`); 4. the run card (stages, activity, reasoning); 5. the side panel (Changes, Terminal, Checks) and linking rows to it.
