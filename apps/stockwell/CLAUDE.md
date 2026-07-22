# CLAUDE.md — Stockwell

LLM/agent entry point. Read this first, then the relevant file in `docs/`.

## What this is
A full-stack inventory + POS app. **Frontend and backend are both Next.js**
(App Router). **Database is libSQL/Turso (SQLite) via Drizzle ORM.**

- Stack: Next.js 15 (App Router, RSC off for pages — they're client components),
  React 19, TypeScript, Drizzle ORM, `@libsql/client`, `jose` (JWT auth),
  `jsbarcode`, Node `scrypt` (password hashing).
- Admin pages live under `src/app/admin/<module>/page.tsx` (served at `/admin/*`;
  the storefront SPA is served at `/`). They are **client components** that
  fetch from **API route handlers** in `src/app/api/<module>/route.ts`. Keep this
  FE/BE separation — pages never import `@/db/*` directly.

## Commands
This app lives in a pnpm workspace (repo root is two levels up). Run from the
repo root:
```bash
pnpm install
pnpm db:setup        # generate + migrate + seed   (run once / after schema change)
pnpm dev             # http://localhost:3050
pnpm build           # production build / typecheck gate
pnpm db:generate     # create a migration from schema.ts
pnpm db:migrate      # apply migrations
pnpm db:seed         # reseed demo data
```
Shared shop-facing types (`ShopProduct`, `ShopBrand`) come from
`@stockwell/shared` (`packages/shared`) — used by `/api/shop/products`,
`/api/brand`, and the Expo storefront. Don't redeclare them.
Demo logins (password `stockwell123`): `admin@stockwell.app` (admin), `mariana@ridgemont.co` (staff).

## Map
- `src/db/` — `schema.ts`, `client.ts` (the `db` instance), `migrate.ts`, `seed.ts`
- `src/lib/` — `api.ts` (`jget`/`jsend`), `auth.ts` (scrypt, Node-only),
  `session.ts` (jose JWT, **edge-safe**), `guard.ts` (`getSession`/`isAdmin`),
  `status.ts` (`deriveStatus`)
- `src/components/` — `Icon.tsx`, `ui.tsx` (primitives), `AppShell.tsx`
  (sidebar+topbar+theme), `UserContext.tsx` (`useUser()`)
- `src/middleware.ts` — auth on every request + admin-only `DELETE`
- `src/app/` — `layout.tsx`, `globals.css` (all tokens + styles), pages, `api/`

## Non-negotiable rules (see docs/CONVENTIONS.md for the rest)
1. **Auth:** every route is protected by `src/middleware.ts`. Public paths:
   `/login` and `/api/auth/*` only.
2. **Roles:** all HTTP `DELETE` is admin-only (middleware). Other admin-only
   writes (`/api/users`, `/api/settings`) are guarded in-handler with
   `getSession(req)`. UI hides admin controls via `useUser().isAdmin`.
3. **Stock:** never mutate `products.stock` without (a) recomputing status via
   `deriveStatus()` and (b) recording a row in `stock_moves`.
4. **Drizzle quirk:** with `strict:false`, inline `.values({...})`/`.set({...})`
   literals can throw a false "property does not exist" type error at build.
   Fix: build the object in a typed `const row`/`patch` first, or append
   `as any`. This is expected — see docs/CONVENTIONS.md.
5. After any `schema.ts` change: `pnpm db:generate && pnpm db:migrate`,
   update `seed.ts`, and commit the new `drizzle/*.sql`.
6. **I18n:** all user-facing text comes from `src/i18n/{en,te}.ts` via
   `useI18n().t(...)` — no hardcoded strings. Money uses `fmt.money()` (₹,
   `en-IN`), never a hardcoded `$`. See docs/I18N.md.

## Feature surfaces added since v1
- **Product media:** `product_media` table; Media tab in Products; upload route
  `api/products/[id]/media`; files in `uploads/` streamed (Range) by
  `app/uploads/[...file]`. Shared type `ShopMedia`.
- **Gift Finder:** Gifting tab tags products (CSV columns on `products`);
  `api/shop/gift-finder` ranks them and returns structured, translatable
  `GiftReason[]`. Shared types `GiftQuery`/`GiftMatch`/`GiftReason`.
- **I18n + ₹:** English/Telugu dictionaries + `LanguageProvider`; rupee currency
  everywhere. See docs/I18N.md.

## Docs index
- `docs/ARCHITECTURE.md` — system + request lifecycle + auth flow
- `docs/DESIGN_SYSTEM.md` — tokens, components, CSS classes, theming
- `docs/CONVENTIONS.md` — coding rules & gotchas
- `docs/DATA_MODEL.md` — tables, columns, IDs, relationships
- `docs/API.md` — endpoint reference
- `docs/ADD_A_MODULE.md` — step-by-step playbook for a new feature
- `docs/I18N.md` — internationalization (en/te) & rupee currency
- `../../AGENTS.md` — whole-monorepo map (start here)
