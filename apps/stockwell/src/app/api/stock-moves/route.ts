import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { deriveStatus } from '@/lib/status';
import { desc, eq } from 'drizzle-orm';

export async function GET() {
  const rows = await db
    .select()
    .from(schema.stockMoves)
    .orderBy(desc(schema.stockMoves.id))
    .limit(100);
  return NextResponse.json(rows);
}

// Record a stock movement and adjust the product's stock atomically.
export async function POST(req: NextRequest) {
  const b = await req.json();
  const qty = Number(b.qty);
  if (!b.type || Number.isNaN(qty))
    return NextResponse.json({ error: 'type and numeric qty required' }, { status: 400 });

  let product = null as any;
  if (b.productId) {
    product = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, b.productId))
      .get();
    if (!product) return NextResponse.json({ error: 'product not found' }, { status: 404 });
    const newStock = Math.max(0, product.stock + qty);
    await db
      .update(schema.products)
      .set({
        stock: newStock,
        status: deriveStatus(newStock),
        updatedAt: new Date().toISOString(),
      } as any)
      .where(eq(schema.products.id, b.productId));
  }

  const move = {
    type: b.type,
    productId: b.productId || null,
    product: b.product || product?.name || '—',
    qty,
    who: b.who || 'You',
    warehouse: b.warehouse || product?.warehouse || null,
    meta: b.meta || null,
  };
  const inserted = await db.insert(schema.stockMoves).values(move).returning();
  return NextResponse.json(inserted[0], { status: 201 });
}
