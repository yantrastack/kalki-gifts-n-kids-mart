import { type NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { isVoid } from '@/lib/payments';

// Each return carries what has been refunded against it (from refund payment
// rows, not a flag) and how much can still be refunded: the unrefunded part of
// the return, capped by what the customer actually paid on the invoice.
export async function GET() {
  const [rows, pays] = await Promise.all([
    db.select().from(schema.returns).orderBy(desc(schema.returns.id)).all(),
    db.select().from(schema.payments).all(),
  ]);
  const netPaidByInvoice = new Map<string, number>();
  const refundedByReturn = new Map<string, number>();
  for (const p of pays) {
    const sign = p.direction === 'refund' ? -1 : 1;
    netPaidByInvoice.set(
      p.invoiceId,
      (netPaidByInvoice.get(p.invoiceId) ?? 0) + sign * p.amountPaise,
    );
    if (p.direction === 'refund' && p.returnId)
      refundedByReturn.set(p.returnId, (refundedByReturn.get(p.returnId) ?? 0) + p.amountPaise);
  }
  return NextResponse.json(
    rows.map((r) => {
      const refundedPaise = refundedByReturn.get(r.id) ?? 0;
      const remainingPaise = Math.max(0, Math.round((r.total ?? 0) * 100) - refundedPaise);
      const netPaid = r.invoiceId ? (netPaidByInvoice.get(r.invoiceId) ?? 0) : 0;
      return {
        ...r,
        invoiceRef: r.invoiceId ?? r.invoice,
        refundedAmount: refundedPaise / 100,
        refundableAmount: r.invoiceId ? Math.max(0, Math.min(remainingPaise, netPaid)) / 100 : 0,
      };
    }),
  );
}

// New returns are raised against a real invoice. Status always starts as
// 'pending': 'refunded' only follows from recording a refund.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object')
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  if (!b.invoiceId)
    return NextResponse.json({ error: 'A return must be linked to an invoice' }, { status: 400 });

  const inv = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, String(b.invoiceId)))
    .get();
  if (!inv) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
  if (isVoid(inv.status))
    return NextResponse.json({ error: 'Cannot raise a return on a void invoice' }, { status: 409 });

  const total = Number(b.total) || 0;
  if (!(total > 0) || total > (inv.total ?? 0))
    return NextResponse.json(
      { error: 'Return value must be more than zero and no more than the invoice total' },
      { status: 400 },
    );

  const suffix = Date.now().toString().slice(-4);
  const row = {
    id: b.id || `RMA-${suffix}`,
    customer: inv.customer || 'Walk-in customer',
    invoice: inv.id,
    invoiceId: inv.id,
    creditNoteNo: `CN-${suffix}`,
    items: Number(b.items) || 1,
    total,
    reason: b.reason || 'Other',
    status: 'pending',
    date: b.date || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
  };
  await db.insert(schema.returns).values(row);
  return NextResponse.json(row, { status: 201 });
}
