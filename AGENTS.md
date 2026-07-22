# AGENTS.md — Stockwell monorepo

Entry point for AI agents and developers. Read this first, then the app-specific
docs it links. Keep it current when you add features.

> Sister file: [`apps/stockwell/CLAUDE.md`](apps/stockwell/CLAUDE.md) holds the
> backend's deeper rules and links `apps/stockwell/docs/*`. This file is the
> whole-repo map.

## What this is

A shop-in-a-box for a local Indian retailer, as a pnpm workspace:

| Package | Stack | Role |
| --- | --- | --- |
| [`apps/stockwell`](apps/stockwell) | Next.js 15 (App Router), React 19, Drizzle ORM, libSQL/SQLite, `jose` JWT | Admin **and** backend. Inventory, POS, orders, staff. Serves the public shop API + uploaded media. |
| [`apps/storefront`](apps/storefront) | Expo (React Native + web), TypeScript | Customer app. Browse, cart, order via WhatsApp/phone. **No online payment.** |
| [`packages/shared`](packages/shared) | Plain TS | `@stockwell/shared` — the API contract + shared helpers. **Single source of truth for cross-app types.** |

The storefront talks to stockwell's public endpoints (`/api/brand`,
`/api/shop/products`, `/api/shop/gift-finder`, `/uploads/*`). No other backend.

**Deploy shape:** one Next app serves everything — storefront at `/` (Expo web
export embedded into `apps/stockwell/public/` via `pnpm build:full`), admin at
`/admin/*`, API at `/api/*` (same origin). One Vercel project. See
[`DEPLOY.md`](DEPLOY.md).

## Commands (run from repo root)

```bash
pnpm install
pnpm db:setup          # generate + migrate + seed SQLite (once / after schema change)
pnpm dev               # stockwell admin + API → http://localhost:3050
pnpm dev:storefront    # expo storefront (separate terminal; web on :8081)
pnpm build             # production build of stockwell (also the typecheck gate)
pnpm typecheck         # tsc --noEmit across all packages
pnpm db:generate       # new migration after editing apps/stockwell/src/db/schema.ts
pnpm db:migrate        # apply migrations
pnpm db:seed           # reseed demo data

pnpm check             # Biome: lint + format check (CI gate)
pnpm check:write       # Biome: apply safe lint fixes + format
pnpm format:write      # Biome: format only
pnpm lint              # Biome: lint only
```

Demo logins (password `stockwell123`): `admin@stockwell.app` (admin),
`mariana@ridgemont.co` (staff), or the on-screen `owen@ridgemont.co`.

> ⚠️ Never run `pnpm build` (writes `.next/`) while the stockwell **dev server**
> is running — it corrupts Turbopack's dev cache. Stop the dev server first, or
> `rm -rf apps/stockwell/.next` and restart if you see "missing required error
> components".

`.npmrc` pins `node-linker=hoisted` because Metro (React Native) needs a flat
`node_modules`. Don't remove it.

## Golden rules

1. **Cross-app types live in `@stockwell/shared`.** `ShopProduct`, `ShopBrand`,
   `ShopMedia`, `GiftQuery`, `GiftMatch`, `GiftReason` — never redeclare these in
   an app. The backend shapes its JSON to them; the storefront consumes them.
2. **FE/BE split in stockwell.** Admin pages (`src/app/admin/<m>/page.tsx`, served
   at `/admin/*`) are client components that fetch from route handlers
   (`src/app/api/<m>/route.ts`). Pages never import `@/db/*`. The customer
   storefront (Expo web) is embedded and served at `/` — see the deploy note below.
3. **User-facing text is translated, never hardcoded.** Add strings to the i18n
   dictionaries (see below). This includes API-generated match reasons, which are
   returned as **structured codes**, not English sentences.
4. **Currency is the rupee, formatted for India.** Use the shared `money()` /
   stockwell `fmt.money()` helpers — they use `en-IN` grouping (lakh/crore).
   Never hardcode `$` or `en-US`.
5. **One tool for lint + format: [Biome](https://biomejs.dev)** (`biome.json` at
   the root). Style is **single quotes** (JS), double for JSX attributes, 2-space
   indent, 100-col, trailing commas, semicolons. Run `pnpm check:write` before
   committing; `pnpm check` is the gate. `noExplicitAny` and a few CSS/admin
   rules are intentionally off; `useExhaustiveDependencies` is advisory (warn) —
   don't blindly auto-fix it (it can introduce refetch loops on the `load()`
   effects).

## Features & where they live

### Product media (images + videos)
- Table `product_media` (`apps/stockwell/src/db/schema.ts`); many per product,
  ordered, first = cover.
- Admin: Products → open a product → **Media** tab (upload multiple, delete).
- Upload/list/delete: `apps/stockwell/src/app/api/products/[id]/media/route.ts`.
- Files stored in `apps/stockwell/uploads/` (gitignored) and streamed with HTTP
  Range support by `apps/stockwell/src/app/uploads/[...file]/route.ts` — so phone
  video players can seek. `src/lib/uploads.ts` holds the shared dir + MIME maps.
- Storefront renders them via `expo-image` / `expo-video`
  (`src/components/MediaCarousel.tsx`, `ProductCard.tsx`). Relative URLs are made
  absolute by `mediaUrl()` in `src/api.ts`; absolute (Cloudinary) URLs pass through.
- **Storage is pluggable** (`src/lib/storage.ts`): local disk by default, or
  **Cloudinary** (free tier, images + video) when its env vars are set. Committed
  demo media lives in `public/seed/` and is served statically. See
  [docs/MEDIA.md](apps/stockwell/docs/MEDIA.md).

### Gift Finder
- Admin tags a product on the **Gifting** tab (occasions, recipients, age range,
  gift types, interests) → stored as CSV columns on `products`.
- Storefront **Find a gift** screen (`src/screens/GiftFinderScreen.tsx`) posts a
  `GiftQuery` to `GET /api/shop/gift-finder`.
- Ranking is **rule-based scoring on admin tags** (predictable, no API key):
  occasion +30, gift type +25, recipient +20 (`anyone` +8), age overlap +15,
  each interest/keyword hit +10 (capped), budget is a hard filter. See the route
  handler's header comment. An LLM/embedding reranker can layer on the same
  `GiftQuery` later.
- **Match reasons are translatable**: the API returns `GiftReason[]` (structured
  codes like `{ code: "occasion", value: "birthday" }`); the storefront renders
  each via `giftReason()` in `src/i18n`. Never emit English reason sentences.

### Discover reels + engagement analytics
- Storefront **Discover** screen (`src/screens/ReelsScreen.tsx`): full-screen,
  vertically-paged product feed (Instagram-style). Per item: horizontal media
  carousel (images + autoplay-in-view muted video via `expo-video`), like /
  share (Web Share API → WhatsApp fallback) / buy, "More like this" related
  strip, category filter, cursor-paginated infinite scroll. Mobile-web optimized
  (measured viewport height, muted autoplay, `keepalive` event beacons).
- Feed: `GET /api/shop/feed?cursor=&category=&limit=` → `FeedResponse`
  (products + live like/share counts + related).
- Events: `POST /api/shop/events` records `view|like|unlike|share|buy|open`
  with an anonymous `sessionId` (localStorage) into `product_events`.
- Admin **Engagement** page (`/engagement`) + `GET /api/analytics/engagement`:
  reach/views/likes/shares/buys KPIs and a per-product engagement table. Seed
  ships synthetic events so it looks alive.

### Internationalization (English + Telugu)
- Both apps ship their own dictionaries; strings live **only** in these files:
  - Storefront: `apps/storefront/src/i18n/{en,te}.ts` + `index.tsx`
    (`I18nProvider`, `useI18n` → `{ t, lang, setLang, giftReason }`).
  - Stockwell: `apps/stockwell/src/i18n/{en,te}.ts` + `index.tsx`
    (`LanguageProvider`, `useI18n` → `{ t, lang, setLang }`).
- `en.ts` is the source of truth; `te.ts` is typed `: Dict`, so a missing/extra
  key is a compile error. `t("a.b.c", { name })` does dot-path lookup +
  `{name}` interpolation; a `count` param selects `key_one` / `key_other`.
- Language choice persists in `localStorage` (web); a segmented **EN / తె**
  toggle sits in each app's header/top bar.
- **Coverage:** the storefront is fully translated. In stockwell the chrome
  (navigation, top bar, login) is translated; individual admin pages can adopt
  `useI18n()` incrementally — add a namespace to `en.ts`/`te.ts` and swap literals
  for `t(...)`. See [`apps/stockwell/docs/I18N.md`](apps/stockwell/docs/I18N.md).

## Adding things — quick pointers

- **A cross-app field** → edit `packages/shared/src/index.ts` first, then the
  backend mapper and the storefront consumer (both typecheck against it).
- **A new admin module** → follow `apps/stockwell/docs/ADD_A_MODULE.md`.
- **A new user-facing string** → add to both `en.ts` and `te.ts`; use `t(...)`.
- **A new language** → add a `xx.ts` typed `: Dict`, register it in the app's
  `i18n/index.*` (`DICTS`, `LANGS`).

## Gotchas

- Drizzle with `strict:false`: inline `.values({...})`/`.set({...})` can throw a
  false "property does not exist" build error. Build a typed `const row`/`patch`
  first, or append `as any`.
- After any `schema.ts` change: `pnpm db:generate && pnpm db:migrate`, update
  `seed.ts`, commit the new `drizzle/*.sql`.
- React versions are pinned identically across apps (Expo SDK 56 → React 19.2.3);
  a mismatch breaks the Next build.
