# Sandbox

> Status: **Accepted** · Last updated: 2026-10-14 · Code: `packages/sandbox` · Related: [architecture.md](./architecture.md)

The sandbox is the isolated environment where the agent's work happens: the repository is cloned into it, dependencies are installed, files are edited and checks are run. Nothing the agent does runs on our machines or servers.

## 1. How it fits

```
LLM ──tool call──► agent tools ──► Sandbox interface ──► DockerSandbox  ──► docker exec       ──► local container
                                                     └─► DaytonaSandbox ──► Daytona API (phase 2) ──► cloud sandbox
```

- The LLM only requests tool calls; our tool code decides what runs.
- Tools only know the `Sandbox` interface, never Docker or Daytona, so swapping providers changes no agent code.
- Local development uses `DockerSandbox`; production uses `DaytonaSandbox` (phase 2). Selected by `createSandbox({ provider })`.

## 2. Interface

```ts
interface Sandbox {
  readonly id: string;
  exec(command, { cwd?, timeoutMs?, env? }): Promise<{ exitCode, stdout, stderr, timedOut, truncated }>;
  readFile(path): Promise<string>;
  writeFile(path, content): Promise<void>;
  listFiles(path, { maxDepth? }): Promise<FileEntry[]>;
  destroy(): Promise<void>;
}
```

- The repository lives in `/workspace`; relative paths resolve against it.
- Keeping paths **inside** `/workspace` is the tools' responsibility; the sandbox is a plain executor.
- A failing command is a normal result (`exitCode ≠ 0`). Only infrastructure problems throw.
- Docker-only extras (e.g. `copyIn` for local folders) live on `DockerSandbox`, not the interface, because remote providers can't support them.

## 3. Decisions

| Area | Decision |
|---|---|
| Base image | `codegenie-base` from `node:24-bookworm` + ripgrep + fd + corepack (pnpm, yarn). Minimal: the base already has git, curl, python3, make/gcc. |
| Node version | Node 24 only (see TODO). |
| Environment | `CI=true` and `COREPACK_ENABLE_DOWNLOAD_PROMPT=0` for every command, so test runners and corepack never wait for input. |
| User | Non-root `agent` user; git identity `CodeGenie <bot@codegenie.dev>`. |
| Resources | 4 GB memory, 2 CPUs, 512 process limit per container (configurable via `resources`). |
| Network | Full internet access (needed for clone and package installs). |
| Host access | No volume mounts, no Docker socket, no secrets in phase 1. Local folders are **copied** in, never mounted. |
| Exec timeout | Default 2 min, max 10 min. Enforced **inside** the container with `timeout` (killing the host-side docker client would leave the process running). Host-side kill at timeout + 15 s as a backstop. |
| Output cap | 1 MB per stream; over the cap, the first and last 512 KB are kept and `truncated: true`. |
| readFile limit | 10 MB; larger files throw instead of returning truncated content (writing that back would corrupt the file). |
| writeFile | Content sent via stdin, never in the command line: no quoting or injection issues. |
| Lifecycle | One container per run. `destroy()` in `finally`. Containers labelled `codegenie=1`. Main process is `sleep 7200`, so a container exits by itself after 2 h even if cleanup never runs. |
| Errors | `SandboxUnavailableError` (Docker not running / image missing), `SandboxCreateError`, `SandboxGoneError`, `SandboxFileError`. |

## 4. Code layout

```
packages/sandbox/
├── images/base/Dockerfile          codegenie-base image
└── src/
    ├── index.ts                    public API (re-exports only)
    ├── create-sandbox.ts           createSandbox() — picks the provider
    ├── core/                       contract shared by every provider
    │   ├── types.ts                Sandbox interface and option/result types
    │   └── errors.ts               SandboxError and subclasses
    ├── lib/                        provider-agnostic helpers
    │   ├── capped-buffer.ts        head + tail output cap
    │   └── run-process.ts          spawn with stdin, timeout and output cap
    └── providers/
        ├── docker/
        │   ├── docker-sandbox.ts   DockerSandbox
        │   ├── docker-cli.ts       docker CLI wrapper, "container gone" detection
        │   └── constants.ts        image, label, resource defaults, timeouts, limits
        └── daytona/                phase 2
```

Tests sit next to the code: `*.test.ts` are fast unit tests, `*.integration.test.ts` need Docker.

## 5. Commands

| Command | What it does |
|---|---|
| `pnpm sandbox:build-image` | Build `codegenie-base` (needed once, and after Dockerfile changes) |
| `pnpm sandbox:clean` | Remove any leftover containers labelled `codegenie=1` |
| `docker exec -it <id> bash` | Inspect a running sandbox (e.g. one kept with `--keep`) |

## 6. Testing

Unit tests (`src/lib/*.test.ts`) need nothing. Integration tests (`src/providers/docker/docker-sandbox.integration.test.ts`) run against real Docker. Locally they skip (with a warning) if Docker isn't running or the image isn't built; in CI they fail instead. CI builds the image before running tests.

## 7. Mapping to Daytona (phase 2)

| Method | DockerSandbox | DaytonaSandbox |
|---|---|---|
| create | `docker run codegenie-base` | create from `codegenie-base` snapshot |
| exec | `docker exec … timeout … bash -lc` | process execute command |
| readFile / writeFile | `docker exec cat` / stdin | filesystem download / upload |
| listFiles | `docker exec find` | filesystem list / find |
| destroy | `docker rm -f` | delete sandbox |

## 8. TODO (post-MVP or when evals show the need)

- [ ] Support other Node versions (fnm/nvm in the image, picked from `.nvmrc` / `engines`).
- [ ] bun and other runtimes in the image.
- [ ] Optional image variant with browsers for Playwright.
- [ ] Network allowlist (GitHub, npm registry) for production.
- [ ] Streaming `exec` output (`onOutput` callback) for long commands.
- [ ] Background processes (dev servers) for live previews.
- [ ] Cache the image build in CI.
