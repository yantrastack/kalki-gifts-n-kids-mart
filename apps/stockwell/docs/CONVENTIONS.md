# Conventions & Rules

## Code organization
- **Pages** (`src/app/<m>/page.tsx`) are `"use client"`, fetch via
  `@/lib/api`, never import `@/db/*`.
- **API** (`src/app/api/<m>/route.ts`) is the only place that touches `db`.
- **Shared logic** goes in `src/lib/`; **shared UI** in `src/components/`.
- Path alias `@/*` → `src/*`.

## Data access (Drizzle)
- Import: `import { db, schema } from "@/db/client";`
- Read: `await db.select().from(schema.x).where(eq(...)).all()` (list) or
  `.get()` (single). Filters with `and/or/like/eq/inArray`, order `desc/asc`.
- Write: `db.insert(schema.x).values(row)`, `db.update(schema.x).set(patch).where(...)`,
  `db.delete(schema.x).where(...)`.
- Multi-step writes that must be atomic: `await db.transaction(async (tx) => { … })`
  (see `api/pos/checkout`).

### ⚠️ The `as any` insert/update quirk
`tsconfig` runs with `strict:false`. In that mode Drizzle's inferred
insert/update type for an **inline literal** sometimes collapses to just the
primary key, producing a false build error like
`Object literal may only specify known properties, and 'x' does not exist…`.
Two accepted fixes:
1. Build the object as a typed `const row = {...}` / `const patch:any = {}`
   first, then pass it. (Preferred for full rows.)
2. Append `as any` to the literal: `.set({ status } as any)`.
Runtime is unaffected — the seed script inserts the same shapes successfully.
Don't "fix" it by changing the schema.

## Domain rules
- **Stock status** is derived, never set by hand:
  `deriveStatus(stock)` → `out` (≤0), `low` (≤10), else `active`. Recompute it
  on every stock change.
- **Every stock change writes a `stock_moves` row** (type `add|remove|sale|
  transfer|return`, signed `qty`, `meta`). Use `POST /api/stock-moves` or do it
  inside the same transaction (POS).
- **Server-side money/stock math.** Never trust prices/totals from the client;
  recompute from the DB (`api/pos/checkout` is the reference).
- **Tax rate** default `0.08`; persisted override in `settings.taxRate`.

## Auth & roles
- Protected by `middleware.ts`. Public: `/login`, `/api/auth/*`.
- `DELETE` on any `/api/*` is **admin-only** (middleware → 403 for staff).
- Other admin-only writes guard in-handler:
  `const s = await getSession(req); if (s?.role !== "admin") return 403;`
  (used by `/api/users`, `/api/settings`).
- UI gating: `const { isAdmin } = useUser();` then `{isAdmin && <DeleteButton/>}`.
  Always pair UI gating with a server check — never rely on UI alone.

## IDs & formats
- Prefixes: products `p*`, suppliers `s*`, customers `c*`, users `u*`,
  sales orders `SO-*`, purchase orders `PO-*`, invoices `INV-*`, returns `RMA-*`,
  warehouses `WH-XXX`.
- Generated IDs use `Date.now().toString(36)` / sliced timestamps.
- Money columns are `real` (float). Dates are stored as display strings
  (e.g. `"Mar 26"`) in seed/legacy tables; `created_at`/`updated_at` are ISO.

## Schema changes (always in this order)
1. Edit `src/db/schema.ts`.
2. `npm run db:generate` → creates `drizzle/NNNN_*.sql`.
3. `npm run db:migrate` (and update `seed.ts` if new tables/columns need data).
4. Commit the generated `drizzle/*.sql` + `drizzle/meta/*`.
Never edit generated SQL by hand; never skip the migration.

## API response conventions
- Success: `NextResponse.json(data)` (201 for creates).
- Error: `NextResponse.json({ error: "message" }, { status })` — `400` bad input,
  `401` no session, `403` wrong role, `404` not found, `409` conflict/oversell.
- Client helpers throw on non-2xx with `error` as the message; pages catch and
  `toast({ type: "danger" })`.

## Styling
- Use design tokens + existing classes (see DESIGN_SYSTEM.md). Inline styles are
  fine for one-offs but reference `var(--...)`.
- Use `statusBadge()` and `fmt.*` rather than re-implementing.

## Gotchas
- Next 15 dynamic route params are async: `await params`.
- `useSearchParams()` must sit inside a `<Suspense>` boundary (see `login/page`).
- Don't import `auth.ts` (Node `crypto`) from middleware or any Edge context —
  use `session.ts` there.
- libSQL writes lock the local file; don't run two `npm start`/`dev` servers
  against the same `local.db` simultaneously.
