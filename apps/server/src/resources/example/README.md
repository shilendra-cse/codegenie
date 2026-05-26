# Example resource (template)

Copy this folder when adding a new API resource. It shows the conventions used across `apps/server`.

## Layout

| File | Role |
|------|------|
| `example.types.ts` | Zod request schemas + domain types |
| `example.service.ts` | Business logic (DB, external APIs, errors) |
| `example.controller.ts` | HTTP handlers: parse input, call service, return envelope |
| `example.routes.ts` | Register paths on the shared `ApiRouter` (side-effect import) |

## Wiring routes

`src/routes.ts` imports route modules for side effects only:

```ts
import "./resources/example/example.routes";
```

`app.ts` already imports `./routes`, so new resources only need one line in `routes.ts`.

## Sync vs async controllers

`PublicController` and `AuthenticatedController` accept either `ApiResponse` or
`Promise<ApiResponse>`. The router wraps both with `Promise.resolve`.

- **Sync** (this demo): in-memory logic, return `ok(...)` directly.
- **Async** (real resources): `async function` + `await` when the service uses DB, GitHub, Redis, etc.

Do not mark handlers `async` unless they `await` something — ESLint will flag it, and it
misleadingly suggests I/O when there is none.

## Response envelope

Success (from controller):

```json
{
  "status": 200,
  "message": "OK",
  "type": "success",
  "data": { "items": [] }
}
```

Use `ok(status, message, data)` from `@/lib/api-response`.

Errors: throw `HttpError` in the service (or let Zod throw in the controller). The global `errorHandler` serializes them.

## Auth

- `api.get("/path").noAuth(handler)` — public
- `api.get("/path").authSecure(handler)` — session cookie via Better Auth; `protect` sets `req.user` before the controller runs

## Endpoints (this demo)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/example/health` | No | Liveness check |
| GET | `/api/example/items` | Yes | List in-memory items for user |
| POST | `/api/example/items` | Yes | Create item `{ "name": "..." }` |
| GET | `/api/example/items/:itemId` | Yes | Get one item |

## Checklist for a real resource

1. Add paths/schemas to `docs/api/openapi.yaml`
2. Add shared types in `packages/shared/src/types/api.ts` if needed
3. Create `*.types.ts`, `*.service.ts`, `*.controller.ts`, `*.routes.ts`
4. Import the routes file from `src/routes.ts`
5. Entry in `docs/api/changelog.md`
