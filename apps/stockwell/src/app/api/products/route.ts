import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { deriveStatus } from '@/lib/status';
import { like, or, eq, and, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  const warehouse = searchParams.get('warehouse');

  const conditions = [];
  if (q)
    conditions.push(
      or(
        like(schema.products.name, `%${q}%`),
        like(schema.products.sku, `%${q}%`),
        like(schema.products.barcode, `%${q}%`),
      ),
    );
  if (category && category !== 'all') conditions.push(eq(schema.products.category, category));
  if (status && status !== 'all') conditions.push(eq(schema.products.status, status));
  if (warehouse && warehouse !== 'all') conditions.push(eq(schema.products.warehouse, warehouse));

  const rows = await db
    .select()
    .from(schema.products)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.products.updatedAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !body.sku)
    return NextResponse.json({ error: 'name and sku are required' }, { status: 400 });
  const id = body.id || `p${Date.now().toString(36)}`;
  const stock = Number(body.stock) || 0;
  const now = new Date().toISOString();
  const row = {
    id,
    name: body.name,
    sku: body.sku,
    barcode: body.barcode || null,
    category: body.category || 'Uncategorized',
    brand: body.brand || null,
    price: Number(body.price) || 0,
    cost: Number(body.cost) || 0,
    stock,
    reserved: Number(body.reserved) || 0,
    incoming: Number(body.incoming) || 0,
    damaged: Number(body.damaged) || 0,
    warehouse: body.warehouse || null,
    supplier: body.supplier || null,
    status: deriveStatus(stock),
    tag: body.tag || null,
    hsnCode: body.hsnCode || null,
    gstRate: Number(body.gstRate) || 0,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.products).values(row);
  return NextResponse.json(row, { status: 201 });
}
