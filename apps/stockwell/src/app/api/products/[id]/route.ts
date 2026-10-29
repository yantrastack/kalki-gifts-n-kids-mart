import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { deriveStatus } from '@/lib/status';
import { CatalogError, assertSkuUnique, missingForActivation } from '@/lib/catalog';
import { eq, sql } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.select().from(schema.products).where(eq(schema.products.id, id)).get();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  if ('lifecycle' in body) {
    return NextResponse.json(
      { error: 'Use POST /api/products/[id]/lifecycle to change lifecycle' },
      { status: 400 },
    );
  }

  const existing = await db.select().from(schema.products).where(eq(schema.products.id, id)).get();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if ('sku' in body && body.sku) {
    try {
      await assertSkuUnique(body.sku, id, async (normalised) => {
        const conflict = await db
          .select({ id: schema.products.id })
          .from(schema.products)
          .where(sql`UPPER(TRIM(${schema.products.sku})) = ${normalised}`)
          .get();
        return conflict;
      });
    } catch (e) {
      if (e instanceof CatalogError)
        return NextResponse.json({ error: e.message }, { status: 409 });
      throw e;
    }
  }

  const patch: any = { updatedAt: new Date().toISOString() };
  for (const k of [
    'name',
    'sku',
    'barcode',
    'category',
    'brand',
    'price',
    'cost',
    'stock',
    'reserved',
    'incoming',
    'damaged',
    'warehouse',
    'supplier',
    'tag',
    'hsnCode',
    'gstRate',
    'giftOccasions',
    'giftRecipients',
    'giftAgeMin',
    'giftAgeMax',
    'giftTypes',
    'giftInterests',
  ]) {
    if (k in body) {
      if (k === 'gstRate') {
        patch[k] = body[k] == null ? null : Number(body[k]);
      } else {
        patch[k] = body[k];
      }
    }
  }
  if ('stock' in patch) patch.status = deriveStatus(Number(patch.stock));

  if (existing.lifecycle === 'active') {
    const merged = { ...existing, ...patch };
    const missing = missingForActivation(merged);
    if (missing.length) {
      return NextResponse.json(
        { error: 'This change would make the active product incomplete', missing },
        { status: 409 },
      );
    }
  }

  await db.update(schema.products).set(patch).where(eq(schema.products.id, id));
  const row = await db.select().from(schema.products).where(eq(schema.products.id, id)).get();
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.id, id))
    .get();
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  // A hard delete. Stock moves, purchase-order lines and invoice lines keep their own
  // copy of the name/SKU/price and have their product link set to null (ON DELETE SET
  // NULL), so history stays readable; media and engagement events cascade.
  try {
    await db.delete(schema.products).where(eq(schema.products.id, id));
  } catch (e) {
    console.error(`DELETE /api/products/${id} failed`, e);
    return NextResponse.json({ error: 'Could not delete the product' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
