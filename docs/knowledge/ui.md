# Web UI

> Status: **Accepted** (design for Phase 4) · Last updated: 2026-10-25 · Code: `apps/web` · Design: [hobai App Design canvas](https://claude.ai/artifact/7CrGGxQmeSht3KyDnahRUr) (private; clickable, light and dark) · Related: [requirements.md](./requirements.md) (U1–U10), [architecture.md](./architecture.md), [environment.md](./environment.md)

The screens, what they show in every state, and what each needs from the API. The canvas is the visual source of truth; this file is the written one. Phase 4 builds what's drawn.

## 1. Principles

- **Tasks first, projects as context.** You set a project up once and then live in tasks, so New task and the Inbox are always one click away; projects hold their tasks, environment and settings.
- **The story and the evidence.** The middle of a task page is a readable story (your message, the run's stages, grouped activity, the result). Every detail behind it (diffs, command output, checks) opens in a side panel, one click away, never in the way.
- **A task is a conversation.** Your messages and the agent's runs alternate; later, follow-ups and PR comments join the same thread.
- **One way of watching the agent.** Environment setup and task runs use the same timeline and the same cards.
- **MVP screens, room to grow.** Previews, follow-ups, quotas, Jira and teams fit as new tabs, cards or sidebar sections, without a new layout.

## 2. Visual system

| | |
|---|---|
| Type | **Geist** for the interface, **Geist Mono** for code, paths, commands and branches |
| Accent | **Mono**: black in light mode, white in dark mode, for the one primary action and anything in progress |
| Status colours | green = passing, PR open, succeeded · amber = draft, incomplete, needs attention · red = failed, broken · purple = merged. Used only for status, never decoration |
| Neutrals | greys for text (3 levels), borders, surfaces (page, sidebar and panels, hover) |
| Themes | light and dark, both complete |
| Shape | 8 px radius on controls, 12 px on cards, 1 px borders, shadows only on floating things (menus, the composer) and on hover (below) |
| Icons | Lucide, 16 px, 1.75 stroke |
| Logos | `apps/web/public/brand/` (black on light, white on dark; full logo and icon) |

Tokens map onto the shadcn CSS variables already in `apps/web/app/globals.css` (`--background`, `--foreground`, `--primary`, `--muted`, `--border`…), plus status tokens: `--ok`, `--warn`, `--err`, `--merged`, each with a soft background and border variant, and `--add` / `--del` for diffs. The **Components and states** board on the canvas lists every token, badge, banner and card.

### Motion and glow

The landing page's touches carry into the app, quieter, and only where they mean something (canvas: **App touches**, with each one switchable):

| Touch | Where | Meaning |
|---|---|---|
| **Backdrop** | a faint grid and glow behind the top of each app page, fading out under the heading; top bars and tab rows stay solid above it | the same place as the landing page |
| **Beam** | a light running around the border of a run (or setup) that is working right now; nowhere else | something is alive |
| **Sheen** | across "Working" badges (task header, run card, Inbox rows) | the one moving label |
| **Rise** | content fades up once as it arrives: a page's sections on load, a new activity line, a new message | this just arrived |
| **Button glow** | the page's one primary action | the next thing to do |
| **Hover** | cards you can open lift slightly; list rows only light up | this opens |

Never on status colours, errors or the diff; nothing loops except the beam, the sheen and the backdrop's glow. With reduced motion (the system setting) nothing moves: the beam is a plain border, content just appears.

## 3. Navigation

```
┌──────────────┬────────────────────────────────────────────┐
│ hobai    │ topbar: breadcrumb · status · meta · action│
│ [+ New task] ├────────────────────────────────────────────┤
│ Inbox     2  │                                            │
│ PROJECTS  +  │   page                                     │
│ ● dodesk     │                                            │
│ ⚠ api        │                                            │
│ RECENT       │                                            │
│ ⟳ Add /health│                                            │
│ you        ⚙ │                                            │
└──────────────┴────────────────────────────────────────────┘
```

- **Sidebar:** New task; Inbox (count = tasks that need you or are running); Projects with a health dot (green ok, amber ⚠ needs attention, accent "Needs you" during setup) and Add repository; Recent (the last ~10 tasks with a live status icon); the runs used this cycle (see Usage & limits); the account menu.
- At phone width the sidebar stacks above the page, and the task side panel stacks below the conversation.

| Route | Screen | Signed in? |
|---|---|---|
| `/` | Landing (signed in: Open hobai, no redirect) | no |
| `/pricing` | Pricing | no |
| `/signin` | Sign in | no |
| `/welcome` | First-run checklist | yes |
| `/new` | New task | yes |
| `/inbox` | Inbox | yes |
| `/projects/new` | Add a repository | yes |
| `/projects/:id` | Project: Tasks | yes |
| `/projects/:id/environment` | Project: Environment (setup conversation while it runs) | yes |
| `/projects/:id/settings` | Project: Settings | yes |
| `/tasks/:id` | Task | yes |

The install callback returns to `/projects/new` when the install started there (`state=add-repo`), else `/welcome?github=…`.

## 4. Screens

### Landing
Hero ("Describe the change. Review the pull request."), Sign in with GitHub, a static product preview (a task thread with a diff), how it works in 3 steps, 4 security points (sandbox, never the main branch, per-repository short-lived access with no write token for the agent, checks that really ran), a closing call to action, footer. Free to start is said in the hero (its main button is **Start free with GitHub**, and below the buttons a short heading, "Free to start: 10 runs every month", above "No card needed. For JavaScript and TypeScript repositories on GitHub.") and in the closing call to action (**Start free with GitHub**). **Data:** none.

### Pricing
Public, linked from the landing page's header (**Pricing**) and from Usage & limits (**See plans**).
- **Hero:** "Simple pricing", and one line: every run happens in its own sandbox and ends in a pull request on your repository.
- **Free:** ₹0 / month; 10 runs per cycle, 1 task at a time, GPT-6 Luna, setups free, PRs with your checks run; **Start free** (signed in: **Open hobai**).
- **Pro:** **Coming soon**, "Soon" where the price goes (prices are set from measured run costs, [billing.md](./billing.md) §3), what it adds (more runs every month, the model for each task, more tasks at once, everything in Free) and a disabled **Coming soon** button, so it sits level with Free.
- **Questions:** what a run is (one attempt at a task; setups don't count, nor runs that failed through hobai's fault), when runs reset (a month from the day you signed up), what happens at the limit.

**Data:** none; the plans shown are fixed text until Pro exists.

### Sign in
One card: Continue with GitHub, what's shared (name and email; repository access comes separately). **States:** default, sign-in failed. **Data:** Better Auth.

### Welcome (first run)
A 4-step checklist: install the GitHub App → add a repository → set up its environment → describe your first task. Finished steps are ticked and say what happened ("dodesk added."); later steps are muted. **Every step happens in place**, so you never lose the thread: the current step opens up inside the checklist (the repository picker in step 2, a compact live setup card with "Watch it live" and any question in step 3, a small task box in step 4); only the GitHub install leaves the page, and comes back to it. Shown until the first task exists. **Data:** has an installation? any project? its environment? any task?

**Getting started card:** until the four steps are done, a small card at the bottom of the sidebar (above the account) shows "2 of 4", a progress bar and "Next: …", linking back to the checklist. It's hidden on the welcome page itself, and wherever you are (watching setup, exploring) it's the way back.

### Add a repository
Installation picker (accounts and orgs), search, repository rows: name, private badge, language, updated time, **Add** or **Added · Open**, and a warning for repositories that don't look like JS/TS (U3). A link to change repository access on GitHub. **States:** loading, empty search, no installations (→ install), GitHub sign-in expired (→ sign in). **Data:** the repo picker API that exists ([github.md](./github.md) §6) plus, per repository, whether it's already a project.

### Environment setup (conversation)
On the project's Environment tab while setup runs or before there's an environment.
1. hobai's intro.
2. The timeline: sandbox ready (commit), detected shape (projects as chips), install, checks run (each as a status badge), "looked into" steps (collapsible).
3. **Question card** (≤ 5 per setup): the question, 2–4 options with the recommended one marked and a detail line each, "Something else" with free text, Answer. After answering, your answer shows under it.
4. Progress after the answer, then **Final check in a fresh sandbox**.
5. **Result:** the environment is saved automatically ("Saved as vN"): setup steps and checks (folder, command, duration, ✓ ran), decisions (yours and detected), and "Describe your first task". Shaping it by hand comes after the MVP.

**States:** running, waiting for your answer (topbar badge, sidebar "Needs you", Inbox row), saved, failed (with the step and log), stopped. **Data:** onboarding events, replayable (see §6), the pending question, answer/stop/restart actions.

### New task (home)
"What should hobai do?", a large composer, a project picker (projects that need attention are shown but can't be picked), a base-branch picker (default branch), Start (enabled once there's text; ⌘↵). A one-line hint on writing good tasks. Recent tasks below. **Data:** projects with health and default branch; branches; create task.

### Inbox
All tasks across projects, newest first, grouped by day. Filters: All · Needs you · Running · PR open · Done. A row: status icon, title, a detail line (what it's doing now, why it failed, checks), project, status badge, duration and cost, updated time. **States:** empty (per filter), loading. **Data:** task list with project, derived status (§5), PR, latest run (status, stage, current step, detail line), totals, updated time.

### Task
- **Topbar:** project › title, status badge, branch, duration and cost, Cancel while running.
- **Conversation:** your message (author, time), then one **run card** per run:
  - header: hobai, run number, status, steps and cost;
  - stages: Prepare · Set up · Working · Checks · Pull request, each ✓ / spinner / pending / failed with a one-line summary and duration;
  - Working shows the agent's activity, grouped: consecutive reads and searches collapse into "Explored the code · read 6 files, searched 2 times"; each edit is a row with its path and +/−; each command is a row with its result; the one in progress has a spinner; the agent's reasoning streams underneath in a quieter style;
  - when finished: the summary, a before/after checks table, the **PR card** (title, number, ready / draft / merged / closed, verified commit, Open on GitHub). "Show steps" re-opens the timeline.
- **Side panel**, tabs: **Changes** (files with +/−, the diff), **Terminal** (every command, its output up to 2,000 characters), **Checks** (before and after). Clicking an edit or command in the story opens it here. Later: **Preview**.
- **Composer** (post-MVP, with follow-ups): disabled while running (with Stop); after a run, "Ask for a change to this pull request"; when there's nothing to follow up (merged, closed, no changes, failed, cancelled) it says why and offers Start a new task.

**Outcome states** (all drawn): PR ready, draft (checks failing or incomplete, with the reason), merged, no changes (the agent's explanation, no PR), failed (which stage, the error, nothing pushed; Re-run setup; Run again post-MVP), cancelled.

**Data:** task, messages, runs; live run events (§6); the diff; command output; check results.

### Project
- **Tasks:** table of the project's tasks: title, status, PR, runs, duration, cost, updated.
- **Environment:** the active version (verified when), steps and checks, versions with Restore, Re-run setup; shaping it by hand after the MVP.
- **Settings:** repository, default branch (follows GitHub), GitHub access (Manage on GitHub), Remove project (hobai data only; GitHub untouched).
- **Needs attention** banner (with the reason and Re-run setup) on every tab when the environment's health says so.

**Data:** project, its tasks, environment and its versions, health.

### Usage & limits
How many runs you've used and what your plan allows ([billing.md](./billing.md) §2).
- **Sidebar line**, above the account menu: "4 of 10 runs · resets 25 Nov", amber from 8 used, red at the limit; on a plan without a run limit, "Unlimited". Clicking it opens the dialog.
- **Account menu:** a **Usage & limits** item opens the same dialog.
- **The dialog:** your plan; the cycle (from, resets on) with a usage bar; the limits (runs per cycle, tasks at once, setups don't count); a note that runs failed on hobai's side don't count; **See plans** (the pricing page).
- **At the limit:** New task (and Welcome's last step) shows a banner above the composer, "You've used all 10 runs this cycle. They reset on 25 Nov. See plans", and Start is disabled. Task pages, the Inbox and setups keep working.
- **The other refusals** (a task already running, today's capacity reached) show above Start like the other errors when starting fails.

**Data:** `GET /me/usage`.

### Everywhere
Banners for: the App suspended or uninstalled (tasks can't start), setup needs attention, run limit reached (above the composer, see Usage & limits). Empty states point to the next step.

## 5. Status vocabulary

A task's label is derived from `tasks.status`, its PR and its latest run:

| Label | When | Colour |
|---|---|---|
| Queued | latest run `queued` | neutral |
| Working | latest run `running` | accent, spinner |
| Needs your answer | setup is waiting on a question (projects) | accent |
| PR #n open | `pr_open`, PR ready | green |
| Draft PR #n | `pr_open`, PR draft | amber |
| PR #n merged | `merged` | purple |
| PR #n closed | `closed` | neutral |
| No changes | run succeeded, no diff | neutral |
| Failed | latest run `failed` | red |
| Cancelled | latest run `cancelled` | neutral |

Run outcomes: Succeeded · Incomplete (with the limit) · Failed (with the stage) · Cancelled · No changes needed. Check comparisons: passing · fixed, passing · broken by this change · still failing · pending.

## 6. Live updates

The run view replays stored events and then follows live ones (`GET /runs/:id/events`, SSE with `Last-Event-ID`), so a reload mid-run loses nothing (U5).

| Event | Drives |
|---|---|
| `stage_changed`, `sandbox_created` | the stage list |
| `setup_started`, `setup_completed` | the Set up line (steps, checks, health) |
| `checks_completed` | the Checks line and the Checks tab's After column |
| `tool_start`, `tool_end` | activity rows (grouped reads/searches, edits with +/−, commands with results), the Changes and Terminal tabs |
| `text_delta` | the streaming reasoning line |
| `agent_step` | step count and cost (streamed, not stored) |
| `branch_created`, `git_push`, `pr_opened` | the Pull request stage and PR card |
| `error`, `done` | the outcome |

**Onboarding works the same way:** its events are stored (`onboarding_events`) and replayed then followed live (`GET /projects/:id/onboarding/events`), and the setup records the question it's waiting on, so a reload loses nothing and the sidebar and Inbox can show "Needs you".

## 7. What the API must provide

Drawn from the screens above; the shapes are fixed in each Phase 4 branch.

- **Projects:** list (name, repo, default branch, health, setup state, latest task), get, create from the picker, remove; per picker repository, whether it's already a project.
- **Tasks:** list across projects and per project, with the derived label (§5), PR (number, url, draft/merged/closed), latest run (status, stage, step, a one-line detail), total duration and cost, updated time; get with messages and runs; create (project, prompt, base branch).
- **Runs:** get (stages, summary, checks before/after, PR, totals); events (replay + live); cancel; the diff; a command's full output.
- **Environment:** active version and history, restore, start or re-run setup, answer a question, save / start over.
- **Account:** installations (exists), sign out, usage (plan, runs used and limit, concurrency, cycle and reset).

## 8. Not in the MVP, already placed

Follow-up messages (the composer after a run) · PR review comments in the thread · Preview tab · Jira tasks (a sidebar section and a task source) · team switcher (above the logo).

**Task assistant** (post-MVP): a chat about the task, separate from its thread. The thread is for work: every message there is a run that changes the code. The assistant is for talk: it answers questions, never changes the branch and never starts a run.
- **What it knows:** read-only tools over the task's branch, every run's saved diff (so it can explain a cancelled run's edits too), commands, checks and summaries. One conversation per task, saved.
- **The window:** a popup docked to the bottom of the task page, like a messenger chat. Collapsed, only its top bar shows (the hobai mark, "Task assistant", an unread dot); hovering lifts it slightly to peek at the latest line; clicking slides it up to full height, clicking the bar again slides it down. Where it sits beside the side panel is settled on the canvas.
- **Greeting and hints** show on the bar: once, "Hi, I'm your task assistant…"; then at moments worth asking about: a check failed ("Want me to explain why?"), no changes, the PR opened ("Want a walkthrough?"), a run was cancelled. Clicking one opens the window with that question asked.
- **Ask about this** on a diff line or file, a command or a check opens it with that piece in context.
- **Send as a follow-up:** when the chat lands on a change, it drafts the instruction into the task's composer; you review it and send.
