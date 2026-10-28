import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { deriveStatus } from '@/lib/status';
import { paymentsByInvoice, toInvoiceView } from '@/lib/invoiceQueries';
import { and, asc, eq } from 'drizzle-orm';

class StockConflict extends Error {
  constructor(productName: string) {
    super(`Stock changed while voiding the invoice for ${productName}. Please try again.`);
  }
}

// The invoice with its line items and every payment/refund against it, plus
// the derived fields (paidAmount, balance, payStatus, isOverdue, displayStatus).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).get();
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const [lines, pays] = await Promise.all([
    db.select().from(schema.invoiceItems).where(eq(schema.invoiceItems.invoiceId, id)).all(),
    db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.invoiceId, id))
      .orderBy(asc(schema.payments.receivedAt), asc(schema.payments.id))
      .all(),
  ]);
  return NextResponse.json({
    ...toInvoiceView(inv, pays),
    lines,
    payments: pays.map((p) => ({ ...p, amount: p.amountPaise / 100 })),
  });
}

// The only change a client can make here is voiding. Payment state is derived
// from payment rows, so it can't be set (or contradicted) by hand: record money
// with POST /api/invoices/[id]/payments instead.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object')
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const inv = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).get();
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if ('pay' in b || 'paid' in b || 'method' in b)
    return NextResponse.json(
      { error: 'Record a payment with POST /api/invoices/[id]/payments' },
      { status: 400 },
    );
  if (b.status !== 'void')
    return NextResponse.json({ error: 'Only status "void" can be set directly' }, { status: 400 });

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
    if (e instanceof StockConflict) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
  const row = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).get();
  const pays = (await paymentsByInvoice([id])).get(id) ?? [];
  return NextResponse.json(toInvoiceView(row!, pays));
}
