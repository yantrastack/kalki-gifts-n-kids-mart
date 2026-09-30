import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { eq } from 'drizzle-orm';

export async function GET() {
  const whs = await db.select().from(schema.warehouses).all();
  const products = await db.select().from(schema.products).all();
  const enriched = whs.map((w) => {
    const ps = products.filter((p) => p.warehouse === w.id);
    const value = ps.reduce((s, p) => s + p.cost * p.stock, 0);
    return { ...w, products: ps.length, value: Math.round(value) };
  });
  return NextResponse.json(enriched);
}

export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.name?.trim())
    return NextResponse.json({ error: 'Warehouse name is required' }, { status: 400 });

  // Code defaults to "WH-" + first 3 letters of the name; suffix on collision.
  const base =
    (b.id || '').trim().toUpperCase() ||
    `WH-${b.name
      .trim()
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(0, 3)
      .toUpperCase() || 'NEW'}`;
  let id = base;
  for (let n = 2; ; n++) {
    const exists = await db
      .select({ id: schema.warehouses.id })
      .from(schema.warehouses)
      .where(eq(schema.warehouses.id, id))
      .get();
    if (!exists) break;
    if (b.id) return NextResponse.json({ error: `Code ${id} already exists` }, { status: 409 });
    id = `${base}${n}`;
  }

  const row = {
    id,
    name: b.name.trim(),
    city: b.city?.trim() || null,
    staff: Number(b.staff) || 0,
    capacity: Math.max(0, Math.min(1, Number(b.capacity) || 0)),
  };
  await db.insert(schema.warehouses).values(row);
  return NextResponse.json({ ...row, products: 0, value: 0 }, { status: 201 });
}
