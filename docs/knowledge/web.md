# Web app

> Status: **Accepted** (Phase 4) · Last updated: 2026-10-23 · Code: `apps/web` · Related: [ui.md](./ui.md) (screens, states) and its [design canvas](https://claude.ai/artifact/21Gfpi2Kmd71mahuxtNSfu), [api.md](./api.md) (the API it calls), [development-plan.md](./development-plan.md)

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
