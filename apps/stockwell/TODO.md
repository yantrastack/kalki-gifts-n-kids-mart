# Stockwell — TODO / Pending Work

Status of the build. Core inventory + auth + POS are done; the items below are
what's left to make every screen fully functional.

## ✅ Done

- Next.js 15 app (frontend + API route handlers), Drizzle ORM, libSQL/Turso
- DB schema + migrations + seed (products, warehouses, suppliers, customers,
  purchase/sales orders, stock moves, users)
- Authentication: login + self-registration, JWT sessions, route-protecting
  middleware, scrypt password hashing, topbar sign-out
- Role-based permissions: admin vs staff; `DELETE` is admin-only (middleware +
  UI gating)
- Dashboard (computed KPIs, category mix, recent moves)
- Products (search/filter/sort, grid+table, add, stock adjust, admin delete)
- Inventory (stock levels + movement timeline)
- Orders (sales + purchase order lists)
- Suppliers, Warehouses (live counts + stock value), Customers
- POS register (`/pos`): catalog → cart → payment → receipt, transactional
  checkout that decrements stock and logs sale moves
- POS register, transactional checkout
- Invoices (list, record payment, statuses)
- Returns / RMA (approve / refund / reject)
- Staff & roles (list, add, change role, activate/deactivate, remove — admin only)
- Settings (company/tax/currency, admin-only, persisted)
- Reports (valuation, low-stock, sales, supplier perf, AR) + CSV export
- Analytics (computed KPIs + charts)
- Barcode generation + print (CODE128 / EAN-13)

## 🔜 Pending — scaffolded screens to wire up

_All scaffolded screens are now wired up._ ✅ Remaining ideas live below as
enhancements (return-to-stock, PDF invoices, sales-period reports, etc.).

## 🧩 Pending — enhancements to existing modules

- [ ] **Purchase orders**: create/edit PO, receive stock (increment + move),
      approval workflow
- [ ] **Sales orders**: create order outside POS, fulfilment/packing states,
      link to invoices
- [ ] **Inter-warehouse transfers**: the Orders → Transfers tab (move stock
      between warehouses as paired moves)
- [ ] **Products**: edit form (currently add + stock-adjust only), image upload,
      variants, CSV import/export
- [ ] **Suppliers / Customers**: edit + delete UI wired to existing PUT/DELETE
      endpoints; supplier → product linkage
- [ ] **Notifications**: real low-stock / out-of-stock / PO alerts (currently
      static in the design)
- [ ] **Global search (⌘K)**: wire the command palette to real product/order
      lookups
- [ ] **Barcode scanner**: hook the POS/Products scan button to a scanner input

## 🔐 Pending — hardening / production

- [ ] Set a strong `SESSION_SECRET` and point `DATABASE_URL` at Turso cloud
- [ ] Server-side input validation (e.g. zod) on all write endpoints
- [ ] Per-field role checks beyond delete (e.g. who can edit prices)
- [ ] Pagination/limits on large list endpoints
- [ ] Password reset + email verification flow
- [ ] Rate limiting on `/api/auth/*`
- [ ] Audit log (who changed what) — partially covered by stock-moves
- [ ] Tests (API integration + a few E2E happy paths)
- [ ] Replace remaining `as any` casts on Drizzle inserts with typed helpers

## ⚙️ Pending — ops / DX

- [ ] CI: lint + typecheck + build on push
- [ ] Dockerfile / deployment config (Vercel or self-host)
- [ ] Seed flag to skip demo data in production
- [ ] `.env.local` example for Turso, and a one-command `db:reset`
