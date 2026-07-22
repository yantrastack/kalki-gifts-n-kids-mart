# Architecture

## Overview
Single Next.js app providing both the UI and the JSON API, backed by a
libSQL/SQLite database through Drizzle ORM.

```
Browser (client components)
   │  fetch() via src/lib/api.ts  (jget / jsend)
   ▼
Next.js Route Handlers  src/app/api/**/route.ts        ← the "backend"
   │  Drizzle ORM (src/db/client.ts → schema.ts)
   ▼
libSQL client  →  local file (local.db)  OR  Turso cloud
```

`src/middleware.ts` runs on the **Edge runtime** in front of everything: it
verifies the session cookie (JWT) and applies the admin-only `DELETE` rule.

## Layers

### 1. Database (`src/db/`)
- `schema.ts` — all tables as Drizzle `sqliteTable` definitions + inferred types.
- `client.ts` — creates the libSQL client from `DATABASE_URL` /
  `DATABASE_AUTH_TOKEN` and exports `db` and `schema`. Import `db` only in API
  route handlers, `migrate.ts`, and `seed.ts` — never in a page/component.
- `migrate.ts` — programmatic migrator (used by `npm run db:migrate`).
- `seed.ts` — wipes and reseeds demo data; also seeds users (hashed) + settings.

Local dev uses `file:local.db`. Switching to Turso is **config only** — set the
two env vars; no code changes.

### 2. API (`src/app/api/**/route.ts`)
Standard Next.js Route Handlers. Conventions:
- `export async function GET/POST/PUT/DELETE`.
- Read/write through `db` + `schema`; return `NextResponse.json(...)`.
- Dynamic params are a Promise in Next 15: `{ params }: { params: Promise<{ id: string }> }` → `const { id } = await params;`.
- Validate required fields, return `4xx` with `{ error }`.
- Pricing/stock math is done **server-side** (never trust client values) — see
  `api/pos/checkout`.

### 3. Auth (`src/lib/` + `src/middleware.ts`)
- `auth.ts` — `hashPassword`/`verifyPassword` using Node `scrypt`. **Node-only**
  (imports `crypto`), so it must NOT be imported by middleware.
- `session.ts` — `createSession`/`verifySession` using `jose`. **Edge-safe**, so
  middleware and route handlers both use it. Exports `SESSION_COOKIE`.
- `guard.ts` — `getSession(req)` / `isAdmin(req)` helpers for route handlers.
- `middleware.ts` — verifies the cookie on every request:
  - `/api/auth/*` → always allowed.
  - other `/api/*` → 401 if no session; 403 if `DELETE` and role ≠ admin.
  - pages → redirect to `/login` if unauthenticated; redirect away from `/login`
    if authenticated.

### 4. UI (`src/components/` + `src/app/`)
- `layout.tsx` wraps the tree in `ToastProvider` → `UserProvider` → `AppShell`.
- `AppShell.tsx` renders sidebar + topbar + theme handling, and returns bare
  `children` on `/login` (no chrome).
- `UserContext.tsx` fetches `/api/auth/me` once and exposes `useUser()` →
  `{ user, isAdmin }`. Pages use it to gate admin-only controls.
- Pages are `"use client"`, fetch on mount, hold data in `useState`.

## Request lifecycle (example: deleting a product as admin)
1. UI calls `jsend('/api/products/p5', 'DELETE')`.
2. `middleware.ts` verifies the JWT cookie, sees role `admin`, allows it.
3. `api/products/[id]/route.ts` `DELETE` runs `db.delete(...)`.
4. Response returns; the page reloads its list.
(If the user were `staff`, middleware returns 403 before step 3, and the UI also
never rendered the delete control because `isAdmin` was false.)

## Why these choices
- **Drizzle + libSQL**: best-fit typed ORM for Turso; same client works on a
  local file and the cloud.
- **jose for sessions**: works in both the Edge middleware and Node handlers.
- **scrypt over bcrypt**: built into Node, no native build step.
- **Client pages + API routes** (instead of Server Components reading the DB):
  keeps a clean, documented HTTP API surface and an explicit FE/BE boundary.
