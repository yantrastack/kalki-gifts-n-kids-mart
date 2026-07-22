import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { deriveStatus } from '@/lib/status';
import { eq } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const row = await db.select().from(schema.products).where(eq(schema.products.id, id)).get();
  if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(row);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
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
        patch[k] = Number(body[k]) || 0;
      } else {
        patch[k] = body[k];
      }
    }
  }
  if ('stock' in patch) patch.status = deriveStatus(Number(patch.stock));
  await db.update(schema.products).set(patch).where(eq(schema.products.id, id));
  const row = await db.select().from(schema.products).where(eq(schema.products.id, id)).get();
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(schema.products).where(eq(schema.products.id, id));
  return NextResponse.json({ ok: true });
}
