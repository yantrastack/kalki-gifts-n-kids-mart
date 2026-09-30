import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { deriveStatus } from '@/lib/status';
import { eq, inArray } from 'drizzle-orm';

// Receive a delivery against a PO: adds the delivered quantities to product
// stock (recording a stock move per line, per the stock rule), clears the
// corresponding `incoming`, and marks the PO received (or partial).
// Body: { lines?: [{ itemId, qty }], who? } — omit lines to receive in full.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => ({}));

  const po = await db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, id))
    .get();
  if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
  if (po.status === 'received' || po.status === 'cancelled')
    return NextResponse.json({ error: `PO is already ${po.status}` }, { status: 409 });

  const items = await db
    .select()
    .from(schema.purchaseOrderItems)
    .where(eq(schema.purchaseOrderItems.poId, id))
    .all();
  if (!items.length)
    return NextResponse.json({ error: 'PO has no line items to receive' }, { status: 409 });

  // Delivered qty per item: from the request, else everything still due.
  const wanted = new Map<number, number>(
    (b.lines || []).map((l: any) => [Number(l.itemId), Number(l.qty)]),
  );
  const toReceive = items
    .map((it) => {
      const due = it.qty - it.received;
      const qty = wanted.size ? Math.min(due, Math.max(0, wanted.get(it.id) ?? 0)) : due;
      return { item: it, qty };
    })
    .filter((r) => r.qty > 0);
  if (!toReceive.length)
    return NextResponse.json({ error: 'Nothing to receive' }, { status: 400 });

  const productIds = toReceive.map((r) => r.item.productId).filter(Boolean) as string[];
  const products = productIds.length
    ? await db.select().from(schema.products).where(inArray(schema.products.id, productIds)).all()
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const now = new Date().toISOString();
  const who = b.who || 'Receiving';

  await db.transaction(async (tx) => {
    for (const { item, qty } of toReceive) {
      const p = item.productId ? byId.get(item.productId) : undefined;
      if (p) {
        const newStock = p.stock + qty;
        const patch = {
          stock: newStock,
          incoming: Math.max(0, (p.incoming || 0) - qty),
          status: deriveStatus(newStock),
          updatedAt: now,
        };
        await tx.update(schema.products).set(patch as any).where(eq(schema.products.id, p.id));
        await tx.insert(schema.stockMoves).values({
          type: 'purchase',
          productId: p.id,
          product: p.name,
          qty,
          who,
          warehouse: p.warehouse,
          meta: `${id} · PO received`,
        } as any);
      }
      const itemPatch = { received: item.received + qty };
      await tx
        .update(schema.purchaseOrderItems)
        .set(itemPatch as any)
        .where(eq(schema.purchaseOrderItems.id, item.id));
    }

    const fullyReceived = items.every((it) => {
      const got = toReceive.find((r) => r.item.id === it.id)?.qty || 0;
      return it.received + got >= it.qty;
    });
    const poPatch = { status: fullyReceived ? 'received' : 'partial' };
    await tx
      .update(schema.purchaseOrders)
      .set(poPatch as any)
      .where(eq(schema.purchaseOrders.id, id));
  });

  const updated = await db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, id))
    .get();
  return NextResponse.json(updated);
}
