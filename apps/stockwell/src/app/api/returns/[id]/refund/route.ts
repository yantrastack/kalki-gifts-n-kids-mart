import { type NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
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

class InvalidRefund extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

const rupees = (paise: number) => `₹${(paise / 100).toFixed(2)}`;

// Record money paid back to the customer for an approved return. It is stored
// as a refund payment linked to both the return and its invoice. The amount
// can't be more than what is still unrefunded on the return, nor more than the
// customer has actually paid on the invoice. The return becomes 'refunded' once
// it has been refunded in full.
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
  if (reference.length > 120) return bad('Reference must be 120 characters or fewer.');

  const session = await getSession(req);
  const paymentId = newPaymentId();

  try {
    await db.transaction(async (tx) => {
      const ret = await tx.select().from(schema.returns).where(eq(schema.returns.id, id)).get();
      if (!ret) throw new InvalidRefund('Not found', 404);
      if (ret.status === 'refunded')
        throw new InvalidRefund('This return is already fully refunded.', 409);
      if (ret.status !== 'approved')
        throw new InvalidRefund('Approve the return before refunding it.', 409);
      if (!ret.invoiceId)
        throw new InvalidRefund(
          'This return is not linked to an invoice, so it cannot be refunded here.',
          409,
        );

      const inv = await tx
        .select()
        .from(schema.invoices)
        .where(eq(schema.invoices.id, ret.invoiceId))
        .get();
      if (!inv) throw new InvalidRefund('The invoice for this return was not found.', 409);
      if (isVoid(inv.status)) throw new InvalidRefund('The invoice for this return is void.', 409);

      const invoiceRows = await tx
        .select()
        .from(schema.payments)
        .where(eq(schema.payments.invoiceId, inv.id))
        .all();
      const refundedForReturn = invoiceRows
        .filter((p) => p.direction === 'refund' && p.returnId === id)
        .reduce((s, p) => s + p.amountPaise, 0);
      const remaining = Math.round((ret.total ?? 0) * 100) - refundedForReturn;
      if (amountPaise > remaining)
        throw new InvalidRefund(
          `Amount is more than what is left to refund on this return (${rupees(remaining)}).`,
          400,
        );

      const { netPaidPaise } = summarizeInvoice(inv, invoiceRows);
      if (amountPaise > netPaidPaise)
        throw new InvalidRefund(
          `Amount is more than the customer has paid on the invoice (${rupees(netPaidPaise)}).`,
          400,
        );

      await tx.insert(schema.payments).values({
        id: paymentId,
        invoiceId: inv.id,
        direction: 'refund',
        method: b.method,
        amountPaise,
        reference: reference || null,
        returnId: id,
        receivedAt: new Date().toISOString(),
        recordedBy: session?.name ?? null,
      } as any);

      if (refundedForReturn + amountPaise >= Math.round((ret.total ?? 0) * 100))
        await tx
          .update(schema.returns)
          .set({ status: 'refunded' } as any)
          .where(eq(schema.returns.id, id));
    });
  } catch (e) {
    if (e instanceof InvalidRefund) return bad(e.message, e.status);
    throw e;
  }

  const ret = await db.select().from(schema.returns).where(eq(schema.returns.id, id)).get();
  const inv = await db
    .select()
    .from(schema.invoices)
    .where(eq(schema.invoices.id, ret!.invoiceId!))
    .get();
  const rows = await db
    .select()
    .from(schema.payments)
    .where(eq(schema.payments.invoiceId, ret!.invoiceId!))
    .all();
  const refund = rows.find((r) => r.id === paymentId)!;
  return NextResponse.json(
    {
      refund: { ...refund, amount: refund.amountPaise / 100 },
      return: ret,
      invoice: toInvoiceView(inv!, rows),
    },
    { status: 201 },
  );
}
