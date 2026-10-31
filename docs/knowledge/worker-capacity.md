# Worker capacity

> Status: **Analysis, nothing built** · Last updated: 2026-10-31 · Code: `apps/worker`, `packages/agent` · Related: [architecture.md](./architecture.md) §10 "Capacity", [agent.md](./agent.md)

The goal: **1,000 runs at once on one 2 vCPU / 8 GB VPS.** Everything heavy happens in the sandbox or at OpenAI; the worker only waits on them, so nothing it does should need much CPU or memory. This page lists what stops it today, found by reading the code. Sandbox quota, OpenAI rate limits and spend caps are outside the worker and left out.

All numbers are estimates until the load harness (§4) measures them.

## 1. Where we are

- **About 20–40 runs per worker today.** Memory runs out first (bottleneck 1).
- **Node uses one core.** JavaScript runs on a single event loop; one process can't use the second vCPU.
- **The heap stops at ~2.2 GB.** V8 sets its limit from the machine's RAM (`v8.getHeapStatistics().heap_size_limit` is 2,240 MB on an 8 GB machine). The Dockerfile doesn't set `--max-old-space-size`, so the worker crashes with "JavaScript heap out of memory" while ~5 GB of RAM is unused.

## 2. Bottlenecks

In the order they're hit as concurrency goes up.

| # | Bottleneck | Kind | Cause | Fix |
|---|---|---|---|---|
| 1 | Step request bodies pile up | memory, quadratic | The SDK keeps every step's full request | Don't keep them |
| 2 | `text_delta` handled per token | CPU | The sink does full work for every text token | Batch deltas |
| 3 | One INSERT per stored event | Postgres pool | 20 connections, a round trip each | One multi-row INSERT for all runs |
| 4 | Old tool results kept in full | memory, linear | Compaction shrinks only what's sent | Store the compacted form |
| 5 | Compactor check every step | CPU | Stringify and rebuild the whole conversation each step | Use reported usage; keep the view |

### 2.1 Bottleneck 1: step request bodies pile up (memory)

**What happens.** Each step, the SDK serializes the whole conversation into a request body and sends it. `streamText` keeps every step's result, including `request.body`, in `recordedSteps` until the call ends (`ai/dist/index.mjs`, `DefaultStepResult`; `@ai-sdk/openai` returns `request: { body }`). One call in `runSegment` can take up to `maxSteps` (150) steps.

**Why it's quadratic.** Every step adds one more full copy, slightly bigger than the last. With ~10 KB added per step:

| Step | That step's request | Total kept |
|---|---|---|
| 1 | 10 KB | 10 KB |
| 2 | 20 KB | 30 KB |
| 3 | 30 KB | 60 KB |
| 100 | 1,000 KB | **≈ 50 MB** |

The conversation itself is 1 MB; the copies are ~50× that. Nothing reads them.

**Fix.** A model middleware (`wrapLanguageModel`) that drops `request.body` from each step's result.

### 2.2 Bottleneck 2: `text_delta` handled per token (CPU)

**What `text_delta` is.** One piece of the agent's text as it streams in, usually a token (`" file"`). It exists for one UI element: the live line of the agent's latest text under "Working" on the run page (`use-run-events.ts`, `run-activity.tsx`), cleared on every `tool_start`. It's live only: published, never stored, gone on reload. The CLI doesn't use it.

**How events reach the browser.** The agent loop emits events → the sink (`apps/worker/src/events/sink.ts`) → stored events are inserted into `run_events` with a `seq` → every event is published on Redis `run:<id>` → the API, subscribed to it, sends it to the browser over SSE.

**What the sink does for each `text_delta`:**

1. `toRunEvent` builds the event, with `new Date().toISOString()`.
2. A new promise joins the run's serial queue.
3. `redactGithubTokensIn`: `JSON.stringify`, regex, `JSON.parse`, to check a few characters.
4. `JSON.stringify` again for Redis.
5. One Redis PUBLISH, with a promise waiting for the reply.

**Why only this event.** Every event gets the same work, but `text_delta` happens once per token (~70 a second while the model writes); all other events together are ~1 a second per run (once per tool call, per step, or per run).

**The math.** Including the SDK's own parsing, ~50 µs per token. One core does ~20k tokens a second at 100%, ~10k with headroom for everything else on the loop. At ~70 tokens a second, that's ~140 runs writing at once; with 30–50% of runs writing at any moment, **~300–500 runs per process**. Past that, event-loop lag grows, BullMQ lock renewals fall behind (with `maxStalledCount: 0` a stalled lock ends a healthy run), and the sink's queue backs up.

**Fix.** The sink buffers a run's deltas and sends one `text_delta` every ~100 ms, before any other event (keeps order), and on `flush()`. The event shape doesn't change. Redact the joined string with `redactGithubTokens`, which also catches a token split across two deltas. ~10 sends a second per run instead of ~70.

**Product call, left open.** The SDK still parses every streamed chunk, text and tool arguments alike, which we can only avoid by not streaming. Sending `text_delta` only while someone watches the run is a possible follow-up; most runs have no viewer.

### 2.3 Bottleneck 3: one INSERT per stored event (Postgres pool)

**What happens.** Every stored event (`tool_start`, `tool_end`, `stage_changed`, …) is its own INSERT. The pool (`packages/db/src/client.ts`) has `max: 20`, shared by every run in the process; each INSERT holds a connection for a ~5–10 ms round trip to Neon.

**The math.** 20 × (1 s / ~7 ms) ≈ 3,000 inserts a second at best; 1,000 runs × ~1 stored event a second ≈ 1,000, more in bursts, plus other queries on the same pool.

**When it's full, events are lost.** A query waiting over `connectionTimeoutMillis: 2_000` throws; the event is neither stored nor published; the run goes on and `flush()` logs "Some run events weren't saved or published". The run's timeline has a hole.

**Fix.** One event writer per process: sinks hand it their stored events in order, and every ~50–100 ms it writes one multi-row INSERT for all runs (the sink already numbers `seq`), then publishes each in order. Batching per run doesn't help: one run has ~1 event a second.

### 2.4 Bottleneck 4: old tool results kept in full (memory)

**What's kept.** `state.messages` (`run-segment.ts`) holds the conversation: the task, each tool call, each tool result. Tool results are most of it: test output, file contents, logs, up to 1 MB each (`MAX_OUTPUT_BYTES`).

**What compaction does.** Before each model call, `Compactor.apply` (`compaction.ts`) checks the size; over 60% of the 272k-token window, it builds a compacted **copy** where old tool results become one line (`"[read src/date.ts, output removed]"`) and sends that. The copy is never written back: `state.messages` keeps every old result in full, though the model never gets them again.

**Why it matters after fix 1.** Memory per run still grows with every step, linearly: ~1–2 MB of text for a typical run, tens of MB with large logs or files; ~3–5 GB or more at 1,000 runs. A large live heap also lengthens GC pauses, which stop the single thread.

**Fix.** Once a step is compacted, replace its tool results in `state.messages` too. The tool calls stay; only the results compaction already removed go. The model sees exactly what it sees today, and each run's memory stays at about the compaction size however long it runs.

### 2.5 Bottleneck 5: compactor check every step (CPU)

**What happens.** `prepareStep` calls `Compactor.apply` before every model call. Each time, it:

1. `compactBefore`: rebuilds the compacted copy from scratch (free before the first compaction, a full walk after).
2. `estimateTokens`: `JSON.stringify` of the whole view, only to count characters.
3. Compacts only when over the trigger, a few times per long run; then the `keep = 10…3` loop stringifies up to ~8 more times.

The cost is the check, not the compaction.

**The math.** With conversations up to ~650 KB (60% of the window), ~1–3 ms per full pass; ~100–300 steps a second at 1,000 runs.

**Fix.** Count tokens from the input tokens OpenAI reported for the last step, plus an estimate for what was added since; keep the compacted view between steps and append to it, rebuilding only when compaction moves forward. Behaviour doesn't change.

## 3. What's left after the five

The SDK's own work, which we can't remove while we stream and re-send the conversation:

| SDK work | At 1,000 runs |
|---|---|
| Per token: parse and validate each streamed chunk (~28k a second × ~15 µs) | ≈ 0.4 core |
| Per step: validate, convert and stringify the whole conversation (~100–300 steps a second × ~3–5 ms) | ≈ 0.3–1.5 cores |
| **Total** | **≈ 0.7–2 cores** |

With two processes (2 cores), 1,000 runs fit when conversations are small and sit at the limit when many long runs are near the compaction ceiling. **How much is re-sent each step decides it.** Two options, both changing cost and what the model sees, to decide together:

- **A lower compaction target** (e.g. 30% instead of 60%): every pass is smaller, memory per run is smaller, and each step costs less at OpenAI.
- **Keep the conversation at OpenAI** (Responses API, `previous_response_id`): each step sends only what's new, and the per-step row drops to near zero. Compaction would have to work differently.

**Settings that go with the fixes:** two worker processes (one per core), `--max-old-space-size` per process (e.g. ~2.5 GB each), and `WORKER_CONCURRENCY` raised to what's measured.

**Not settled by reading the code:** whether each `new Daytona(...)` client (one per sandbox) reuses connections or opens a TLS connection per call; the cost of parsing tool results up to 1 MB; real GC pauses and event-loop lag under load.

## 4. Measuring

A local load harness, without Daytona or OpenAI: the fake sandbox with realistic delays and a scripted model that streams at real token speed (~70 a second), ramping 100, 250, 500 and 1,000 runs. Recorded per level: heap and RSS, event-loop lag, CPU, database pool waits, time to save events. Run before the fixes for a baseline and after each one, so every estimate on this page becomes a number.
