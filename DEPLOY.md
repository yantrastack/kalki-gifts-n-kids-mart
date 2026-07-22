# Deploying to Vercel (one project, free tier)

The customer storefront and the admin are served by **one Next.js app**, so it's
**one Vercel project, one URL, one deploy**:

| Path | What |
| --- | --- |
| `/` | customer storefront (Expo web build, embedded) |
| `/admin/*` | admin app (login, dashboard, products, engagement, …) |
| `/api/*` | shared API (same-origin — no CORS) |

The build exports the storefront to static files and drops them into the Next
app's `public/` (see `pnpm build:full` → `scripts/embed-storefront.mjs`), and a
`next.config` rewrite serves that SPA at `/`.

---

## ⚠️ First: Vercel has no persistent disk

Vercel is serverless — the filesystem is ephemeral. The local-dev defaults don't
work in production, so before deploying:

1. **Database → Turso** (not `file:local.db`). Same libSQL, free hosted.
2. **Media uploads → Cloudinary** (not the local `uploads/` dir). Already wired —
   see [apps/stockwell/docs/MEDIA.md](apps/stockwell/docs/MEDIA.md). Committed
   demo media under `/seed/*` ships inside the build and is fine.

### Set up Turso (once, ~5 min)

```bash
turso auth signup
turso db create kanuka
turso db show kanuka --url          # → DATABASE_URL
turso db tokens create kanuka       # → DATABASE_AUTH_TOKEN
```

Push schema + demo data to it once from your machine:

```bash
cd apps/stockwell
DATABASE_URL="libsql://…" DATABASE_AUTH_TOKEN="…" pnpm db:migrate
DATABASE_URL="libsql://…" DATABASE_AUTH_TOKEN="…" pnpm db:seed
```

---

## The Vercel project

New Vercel project → import this repo →

- **Root Directory:** `apps/stockwell`
- **Framework preset:** Next.js (auto-detected).
- **Build Command (override):** `pnpm build:full`
  (exports the storefront with same-origin API base → embeds into `public/` →
  `next build`).
- **Environment variables:**
  | Key | Value |
  | --- | --- |
  | `DATABASE_URL` | `libsql://kanuka-….turso.io` |
  | `DATABASE_AUTH_TOKEN` | your Turso token |
  | `SESSION_SECRET` | a long random string |
  | `CLOUDINARY_CLOUD_NAME` | your Cloudinary cloud name |
  | `CLOUDINARY_API_KEY` | your Cloudinary key |
  | `CLOUDINARY_API_SECRET` | your Cloudinary secret |

Deploy → your whole app is at `https://your-app.vercel.app`
(storefront at `/`, admin at `/admin`).

> If Vercel's install step doesn't pick up the storefront workspace, set **Root
> Directory** to the repo root instead and use Build Command
> `pnpm --filter stockwell build:full` with Output Directory `apps/stockwell/.next`.

---

## Local development

Same-app split matters only in production. In dev:

- `pnpm dev` → admin + API at `http://localhost:3050/admin` (the `/` SPA only
  exists after an embed build; admin devs just use `/admin`).
- `pnpm dev:storefront` → Expo dev server with hot reload (press `w` for web on
  `:8081`); it points at `localhost:3050` for data.
- To preview the **merged** app locally: `pnpm build:full` then
  `pnpm --filter stockwell start` → `/` and `/admin` on `:3050`.

## Native apps (later)

The storefront is still a real Expo app — build iOS/Android with EAS from
`apps/storefront`, setting `EXPO_PUBLIC_API_BASE=https://your-app.vercel.app`.
The web embed doesn't preclude shipping to the app stores.

## Notes

- `EXPO_PUBLIC_API_BASE` is baked in at build time. `pnpm build:full` sets it to
  empty (same-origin) for the embed; a standalone/native build sets it to the
  full backend URL.
- Re-seeding Turso wipes and refills it — only do that intentionally in prod.
- Auth cookies are same-origin and scoped fine under `/admin`.
