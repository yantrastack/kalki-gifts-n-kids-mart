# White-Label / Branding

The app is white-label: every deployment's branding lives in the `settings`
table (DB), not in code. One codebase serves many customers.

## What's brandable (settings keys)
| Key | Used for |
|---|---|
| `appName` | App title (browser tab), sidebar name, login, org block |
| `brandInitial` | Logo "mark" (1–2 letters) in sidebar / login |
| `accentColor` | Primary theme color (hex). Drives `--accent` + derived hover/soft/on-accent and `--chart-1` |
| `tagline` | Subtitle on login & sidebar |
| `plan`, `seats` | Org block line |
| `companyName`, `email`, `address`, `currency`, `taxRate`, `lowStockThreshold` | Company/ops prefs |

## How it works
- `GET /api/brand` is a **public** endpoint (allowed through `middleware.ts`) so
  branding shows on the login screen before auth.
- `BrandProvider` (client) fetches it, sets `document.title`, and injects the
  accent into CSS variables on `<html>` via `applyAccent()`. It re-derives the
  accent for light vs dark mode and re-applies on theme change.
- `AppShell` and the login page read `useBrand()`.
- Admins edit branding in **Settings → Branding** (live accent preview); saving
  calls `refresh()` so the whole app updates without reload.

## Onboard a new customer
Option A (per-customer database — recommended for true isolation): create a new
Turso DB, run `npm run db:setup`, then set their branding in Settings (or seed
it). Point that deployment's `DATABASE_URL` at their DB.

Option B (quick demo): just change the values in `src/db/seed.ts` `SETTINGS`
(or edit them in Settings) and reseed.

Current default seed = **Kalki Kids Mart** (accent `#2f9e8f`).

> Note: branding is currently global per database (one brand per deployment/DB).
> For multiple brands in a *single* database you'd add a `tenants` table and scope
> every query by tenant — not implemented yet.
