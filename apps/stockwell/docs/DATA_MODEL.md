# Data Model

Defined in `src/db/schema.ts` (Drizzle). SQLite via libSQL. Seed in `seed.ts`.

## Tables

### products  (id `p*`)
`id, name, sku, barcode, category, brand, price (real), cost (real),
stock (int), reserved (int), incoming (int), damaged (int),
warehouse → warehouses.id, supplier, status (active|low|out), tag,
hsn_code, gst_rate (real),
gift_occasions, gift_recipients, gift_age_min (int), gift_age_max (int),
gift_types, gift_interests,
created_at, updated_at`
- `status` is derived from `stock` via `deriveStatus()`.
- `gift_*` power the Gift Finder. The CSV columns (`gift_occasions`,
  `gift_recipients`, `gift_types`, `gift_interests`) hold comma-separated
  lowercase keys; empty = not tagged for gifting. Edited on the product's
  **Gifting** tab; scored by `GET /api/shop/gift-finder`.

### product_media  (id `m*`)
`id, product_id → products.id (cascade delete), url, type (image|video),
sort_order (int), created_at`
- Many rows per product; ordered by `sort_order`, first row is the cover.
- `url` is a relative path like `/uploads/<file>` served by
  `app/uploads/[...file]` (files live in `uploads/`, gitignored). Managed via
  `api/products/[id]/media`.

### product_events  (id autoincrement int)
`id, product_id → products.id (cascade delete), type (view|like|unlike|share|buy|open),
session_id, created_at`
- Engagement from the storefront **Discover** reels. `session_id` is an anonymous
  per-device id (reach/dedupe). Net likes = count(like) − count(unlike). Rolled up
  by `/api/shop/feed` (like/share counts) and `/api/analytics/engagement`.

### warehouses  (id `WH-XXX`)
`id, name, city, staff (int), capacity (real 0..1)`
- `products` count and stock `value` are **computed** in `GET /api/warehouses`,
  not stored.

### suppliers  (id `s*`)
`id, name, contact, email, phone, on_time (real 0..1), last_order, spend (real)`

### customers  (id `c*`)
`id, name, type (business|walk-in), email, phone, address, orders (int),
spend (real), last_order, balance (real), color`

### purchase_orders  (id `PO-*`)
`id, supplier, items (int), total (real), status (draft|approved|shipped|
received|cancelled), eta, created`

### sales_orders  (id `SO-*`)
`id, customer, items (int), total (real), status (pending|packing|shipped|
fulfilled|cancelled), payment (paid|unpaid|pending), date`
- POS checkout inserts a `fulfilled` order here.

### stock_moves  (id autoincrement int)
`id, type (add|remove|sale|transfer|return), product_id → products.id,
product (name snapshot), qty (signed int), who, warehouse, meta, created_at`
- The audit log of inventory changes. One row per stock change.

### users  (id `u*`)
`id, email (unique), name, password_hash, role (admin|staff),
active (int 0|1), created_at`
- `password_hash` = `scrypt` salted hash (`salt:hash`). Never returned by the API.

### invoices  (id `INV-*`)
`id, customer, date, due, subtotal, tax, total, paid, status (paid|partial|
unpaid|overdue), method, channel (wholesale|in-store), items (int)`
- `PUT` with `{ pay }` increments `paid` and recomputes `status`.

### returns  (id `RMA-*`)
`id, customer, invoice, items (int), total (real), reason,
status (pending|approved|refunded|rejected), date`

### settings  (key/value)
`key (pk), value` — e.g. `companyName, currency, taxRate, address, email,
lowStockThreshold`. `GET` returns an object; `PUT` upserts (admin-only).

## Relationships
- `products.warehouse` → `warehouses.id`
- `products.supplier` ↔ `suppliers.name` (by name, not FK)
- `stock_moves.product_id` → `products.id`
- `returns.invoice` ↔ `invoices.id` (by id string)
- `sales_orders` / `invoices` reference `customers` by **name** (denormalized).

> Several links are by display string rather than FK — matching the original
> design's denormalized mock data. Tighten to real FKs if/when normalizing.

## Seed contents
3 warehouses, 7 suppliers, 16 products, 8 customers, 8 purchase orders,
8 sales orders, 9 stock moves, 2 users (admin + staff), 9 invoices, 5 returns,
6 settings. `seed.ts` deletes all tables then inserts — safe to re-run.
