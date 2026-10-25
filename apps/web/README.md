# web

The CodeGenie web app: Next.js (App Router), React 19, Tailwind, TanStack Query. Sign in with GitHub, add repositories, set up their environments, start tasks, watch them run and get the pull request. How it's built: [docs/knowledge/web.md](../../docs/knowledge/web.md). What each screen shows: [docs/knowledge/ui.md](../../docs/knowledge/ui.md).

## Running it

```bash
pnpm dev:web   # http://localhost:3000
```

It needs the API running (`pnpm dev:server`), and the worker (`pnpm dev:worker`) for setup and tasks.

The browser only calls `/api/*` on the web app's own address; `next.config.ts` forwards it to `API_URL` (default `http://localhost:3001`, set in `apps/web/.env`). So the session cookie works and there's no CORS.

| Variable | Default | |
|---|---|---|
| `API_URL` | `http://localhost:3001` | where `/api/*` is forwarded; read on the server only |
| `NEXT_DIST_DIR` | `.next` | the build folder; the end-to-end test uses `.next-e2e` so a running `next dev` is left alone |

## Tests

`pnpm --filter web test` (Vitest + Testing Library). The whole journey in a browser: `pnpm e2e` ([web.md](../../docs/knowledge/web.md) §19).
