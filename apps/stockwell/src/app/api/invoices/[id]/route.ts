import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { deriveStatus } from '@/lib/status';
import { and, eq } from 'drizzle-orm';

class StockConflict extends Error {
  constructor(productName: string) {
    super(`Stock changed while voiding the invoice for ${productName}. Please try again.`);
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).get();
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const lines = await db
    .select()
    .from(schema.invoiceItems)
    .where(eq(schema.invoiceItems.invoiceId, id))
    .all();
  return NextResponse.json({ ...inv, lines });
}

// Record a payment, or void the invoice. Client-set statuses other than
// `void` are rejected: paid/partial/unpaid follow from payments (YAN-74).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json();
  const inv = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).get();
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (b.status != null && b.status !== 'void')
    return NextResponse.json({ error: 'Only status "void" can be set directly' }, { status: 400 });

  if (b.status === 'void') {
    if (inv.status === 'void')
      return NextResponse.json({ error: 'Invoice is already void' }, { status: 409 });
    try {
      await db.transaction(async (tx) => {
        const lines = await tx
          .select()
          .from(schema.invoiceItems)
          .where(eq(schema.invoiceItems.invoiceId, id))
          .all();
        const now = new Date().toISOString();
        for (const l of lines) {
          if (!l.productId) continue;
          const p = await tx
            .select()
            .from(schema.products)
            .where(eq(schema.products.id, l.productId))
            .get();
          if (!p) continue;
          const newStock = p.stock + l.qty;
          const res = await tx
            .update(schema.products)
            .set({ stock: newStock, status: deriveStatus(newStock), updatedAt: now } as any)
            .where(and(eq(schema.products.id, p.id), eq(schema.products.stock, p.stock)))
            .run();
          if (res.rowsAffected === 0) throw new StockConflict(p.name);
          await tx.insert(schema.stockMoves).values({
            type: 'void',
            productId: p.id,
            product: p.name,
            qty: l.qty,
            who: b.who || 'Admin',
            warehouse: p.warehouse,
            meta: `${id} · voided`,
            ref: id,
          } as any);
        }
        await tx
          .update(schema.invoices)
          .set({ status: 'void' } as any)
          .where(eq(schema.invoices.id, id));
      });
    } catch (e) {
      if (e instanceof StockConflict)
        return NextResponse.json({ error: e.message }, { status: 409 });
      throw e;
    }
    const row = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).get();
    return NextResponse.json(row);
  }

  if (inv.status === 'void')
    return NextResponse.json(
      { error: 'Cannot record a payment on a void invoice' },
      { status: 409 },
    );

  const patch: any = {};
  if (b.pay != null) {
    const paid = Math.min(inv.total, (inv.paid || 0) + Number(b.pay));
    patch.paid = paid;
    patch.status = paid >= inv.total ? 'paid' : paid > 0 ? 'partial' : inv.status;
    if (b.method) patch.method = b.method;
  }
  await db.update(schema.invoices).set(patch).where(eq(schema.invoices.id, id));
  const row = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).get();
  return NextResponse.json(row);
}
