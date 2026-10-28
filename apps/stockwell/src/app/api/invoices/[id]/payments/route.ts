import { type NextRequest, NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { getSession } from '@/lib/guard';
import { toInvoiceView } from '@/lib/invoiceQueries';
import {
  isPaymentMethod,
  isVoid,
  newPaymentId,
  rupeesToPaise,
  summarizeInvoice,
} from '@/lib/payments';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

class InvalidPayment extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const withRupees = (p: typeof schema.payments.$inferSelect) => ({
  ...p,
  amount: p.amountPaise / 100,
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const inv = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).get();
  if (!inv) return bad('Not found', 404);
  const rows = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.invoiceId, id))
    .orderBy(asc(schema.payments.receivedAt), asc(schema.payments.id))
    .all();
  return NextResponse.json(rows.map(withRupees));
}

// Record a payment against an invoice. Payments accumulate (each keeps its own
// method and reference), and the invoice's paid/partial/unpaid status is derived
// from them. An amount above the balance, zero, negative, or with more than two
// decimals is rejected rather than clamped.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object') return bad('Invalid JSON body');

  if (!isPaymentMethod(b.method))
    return bad('Unknown payment method. Use cash, UPI, card, bank transfer or cheque.');
  const amountPaise = rupeesToPaise(b.amount);
  if (amountPaise === null || amountPaise <= 0)
    return bad('Amount must be greater than zero, with at most two decimals.');
  const reference = typeof b.reference === 'string' ? b.reference.trim() : '';
  if (reference.length > 120) return bad('Payment reference must be 120 characters or fewer.');
  const note = typeof b.note === 'string' ? b.note.trim() : '';
  if (note.length > 240) return bad('Note must be 240 characters or fewer.');

  const session = await getSession(req);
  const paymentId = newPaymentId();

  try {
    await db.transaction(async (tx) => {
      const inv = await tx.select().from(schema.invoices).where(eq(schema.invoices.id, id)).get();
      if (!inv) throw new InvalidPayment('Not found', 404);
      if (isVoid(inv.status))
        throw new InvalidPayment('Cannot record a payment on a void invoice.', 409);

      const rows = await tx
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.invoiceId, id))
        .all();
      const { balancePaise } = summarizeInvoice(inv, rows);
      if (balancePaise <= 0) throw new InvalidPayment('This invoice has no balance due.', 409);
      if (amountPaise > balancePaise)
        throw new InvalidPayment(
          `Amount is more than the balance due (₹${(balancePaise / 100).toFixed(2)}).`,
          400,
        );

      await tx.insert(schema.payments).values({
        id: paymentId,
        invoiceId: id,
        direction: 'payment',
        method: b.method,
        amountPaise,
        reference: reference || null,
        receivedAt: new Date().toISOString(),
        recordedBy: session?.name ?? null,
        note: note || null,
      } as any);
    });
  } catch (e) {
    if (e instanceof InvalidPayment) return bad(e.message, e.status);
    throw e;
  }

  const inv = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).get();
  const rows = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.invoiceId, id))
    .all();
  const payment = rows.find((r) => r.id === paymentId)!;
  return NextResponse.json(
    { payment: withRupees(payment), invoice: toInvoiceView(inv!, rows) },
    { status: 201 },
  );
}
