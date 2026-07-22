# Stockwell — Inventory Management

A working full-stack inventory app built from the Stockwell design.

- **Frontend:** Next.js 15 (App Router, React) — the ported design UI
- **Backend:** Next.js Route Handlers (`/src/app/api/*`)
- **Database:** Turso / libSQL (SQLite) via **Drizzle ORM**

## Documentation

For development and LLM context, see [`CLAUDE.md`](CLAUDE.md) and the
[`docs/`](docs/README.md) folder (architecture, design system, conventions,
data model, API reference, and a "add a module" playbook).

## Quick start

```bash
cd stockwell
npm install
npm run db:setup     # generate migration, apply it, seed demo data
npm run dev          # http://localhost:3050
```

`db:setup` runs three steps you can also run individually:
`npm run db:generate` · `npm run db:migrate` · `npm run db:seed`

## Database config (`.env`)

Local development uses a SQLite file — no account needed:

```
DATABASE_URL="file:local.db"
DATABASE_AUTH_TOKEN=""
```

To switch to **Turso cloud**, create a database (`turso db create stockwell`),
then set:

```
DATABASE_URL="libsql://<your-db>.turso.io"
DATABASE_AUTH_TOKEN="<your-token>"
```

Re-run `npm run db:migrate && npm run db:seed`. Nothing else changes — the same
Drizzle client (`src/db/client.ts`) talks to both.

## What's wired to the database (full CRUD / live data)

| Module | Page | API |
|---|---|---|
| Dashboard | `/` | `GET /api/dashboard` (computed KPIs, category mix, recent moves) |
| Products | `/products` | `GET/POST /api/products`, `GET/PUT/DELETE /api/products/[id]` |
| Inventory | `/inventory` | `GET /api/products`, `GET/POST /api/stock-moves` |
| Orders | `/orders` | `GET/POST /api/sales-orders`, `/api/purchase-orders` |
| Suppliers | `/suppliers` | `GET/POST /api/suppliers`, `PUT/DELETE /api/suppliers/[id]` |
| Warehouses | `/warehouses` | `GET /api/warehouses` (live product counts + stock value) |
| Customers | `/customers` | `GET/POST /api/customers`, `PUT/DELETE /api/customers/[id]` |
| Register (POS) | `/pos` | `POST /api/pos/checkout` (transactional sale + stock decrement) |
| Invoices | `/invoices` | `GET/POST /api/invoices`, `PUT/DELETE /api/invoices/[id]` (record payment) |
| Returns / RMA | `/returns` | `GET/POST /api/returns`, `PUT/DELETE /api/returns/[id]` (approve/refund/reject) |
| Staff & roles | `/staff` | `GET/POST /api/users`, `PUT/DELETE /api/users/[id]` (admin-only writes) |
| Settings | `/settings` | `GET/PUT /api/settings` (admin-only writes) |
| Reports | `/reports` | `GET /api/reports` (valuation, low-stock, sales, suppliers, AR) + CSV export |
| Analytics | `/analytics` | `GET /api/analytics` (computed KPIs, charts) |
| Barcode | `/barcode` | client-side CODE128/EAN-13 label generation + print |

Stock moves are transactional: posting a move adjusts the product's `stock` and
recomputes its status (`out` ≤ 0, `low` ≤ 10, else `active`). Try it from a
product's detail panel → **Adjust stock**.

All design screens are now wired to the database / APIs.

## Authentication

The app is access-controlled. Visiting any page while signed out redirects to
`/login`; protected API routes return `401`.

- **Sessions:** signed JWT (`jose`) in an httpOnly cookie, verified in
  `src/middleware.ts` (Edge runtime).
- **Passwords:** hashed with Node `scrypt` (no native dependencies) in
  `src/lib/auth.ts`. Session helpers live in `src/lib/session.ts`.
- **Endpoints:** `POST /api/auth/login`, `POST /api/auth/logout`,
  `GET /api/auth/me`, `POST /api/auth/register`.

Seeded demo accounts (password `stockwell123`):

| Email | Role |
|---|---|
| `admin@stockwell.app` | admin |
| `mariana@ridgemont.co` | staff |

New users can self-register from the login screen (created as `staff`). Set a
strong `SESSION_SECRET` in `.env` for production.

## Point of Sale (POS checkout)

The Register screen (`/pos`) is a working two-pane checkout:

- Left: searchable product catalog (out-of-stock items hidden), tap to add.
- Right: live cart with quantity steppers, customer selector, discount, 8% tax,
  payment method, and a printable receipt on completion.

Checkout calls `POST /api/pos/checkout`, which **prices everything server-side**
(never trusts client prices), validates available stock, then in a single
transaction: creates a fulfilled sales order, decrements each product's stock,
recomputes its status, and records a `sale` stock-move per line. Overselling is
rejected with `409`.

## Roles & permissions

Two roles: **admin** and **staff** (stored on the user, carried in the session).

- **Destructive actions (HTTP `DELETE`) are admin-only**, enforced centrally in
  `src/middleware.ts` (`403` for staff) — so the rule holds even for direct API
  calls, not just the UI.
- The UI also hides delete controls for non-admins via `useUser()`
  (`src/components/UserContext.tsx`).
- Staff retain full operational access: browse, create/adjust stock, and run POS
  sales.

## Structure

```
src/
  db/        schema.ts · client.ts · migrate.ts · seed.ts
  app/api/   route handlers (the backend)
  app/*/     pages (the frontend)
  components/ Icon, ui primitives, AppShell (sidebar + topbar + theme)
```

Seed data is the original Stockwell mock catalog (16 products, 7 suppliers,
3 warehouses, 8 customers, sales/purchase orders, stock moves).
