# Playbook: Add a Module

Worked example: a "Brands" module with CRUD. Adjust names as needed.

## 1. Schema (`src/db/schema.ts`)
```ts
export const brands = sqliteTable("brands", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  active: integer("active").notNull().default(1),
});
export type Brand = typeof brands.$inferSelect;
```

## 2. Migrate
```bash
npm run db:generate     # writes drizzle/NNNN_*.sql
npm run db:migrate
```
Add seed rows in `seed.ts` (delete + insert) if needed, then `npm run db:seed`.

## 3. API (`src/app/api/brands/route.ts` and `[id]/route.ts`)
```ts
import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db/client";
import { desc, eq } from "drizzle-orm";

export async function GET() {
  return NextResponse.json(await db.select().from(schema.brands).orderBy(desc(schema.brands.id)));
}
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  const row = { id: "b" + Date.now().toString(36), name: b.name, active: 1 };
  await db.insert(schema.brands).values(row as any);   // see CONVENTIONS "as any" quirk
  return NextResponse.json(row, { status: 201 });
}
```
`[id]/route.ts`: `PUT` (build `patch:any`), `DELETE` (auto admin-gated by middleware).
For admin-only **writes other than DELETE**, guard in-handler with
`getSession(req)` (see `api/settings`).

## 4. Page (`src/app/brands/page.tsx`)
Copy the skeleton in DESIGN_SYSTEM.md. `"use client"`, fetch with `jget` on mount,
mutate with `jsend`, show `useToast` on success/error, gate admin controls with
`useUser().isAdmin`.

## 5. Navigation (`src/components/AppShell.tsx`)
Add to the right section of `NAV_SECTIONS`:
```ts
{ href: "/brands", icon: "tag", label: "Brands" },
```

## 6. Verify
```bash
npm run build      # typecheck + build (fix any 'as any' insert errors)
npm run dev        # click through; check the API in the network tab
```
Update `docs/API.md` and `docs/DATA_MODEL.md` with the new endpoints/table.

## Checklist
- [ ] schema + migration committed (`drizzle/*.sql`)
- [ ] seed updated if the screen needs data
- [ ] API: validation, correct status codes, role guards
- [ ] stock changes (if any) recompute status + write a `stock_moves` row
- [ ] page uses tokens/classes + `statusBadge`/`fmt`
- [ ] nav entry added
- [ ] `npm run build` is green
- [ ] docs updated
