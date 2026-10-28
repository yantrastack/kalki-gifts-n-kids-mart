import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db, schema } from '@/db/client';
import { getSession } from '@/lib/guard';
import { deriveStatus } from '@/lib/status';
import { isSellable } from '@/lib/catalog';
import { buildSaleLines, type SaleInputLine } from '@/lib/invoice';
import {
  isIsoDate,
  newPaymentId,
  paiseToRupees,
  planSalePayments,
  rupeesToPaise,
  todayIST,
  type SalePaymentInput,
  type SaleTerms,
} from '@/lib/payments';
import { inArray, eq, and } from 'drizzle-orm';

class StockConflict extends Error {
  constructor(productName: string) {
    super(`Stock changed while checking out ${productName}. Please try again.`);
  }
}

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

// One transaction: sales order header, linked invoice with snapshot lines, the
// payment rows, stock decrement (compare-and-swap on the stock that was read),
// and a stock move per line referencing the invoice. Any failure rolls
// everything back.
//
// Body: { items, customerId?, discountPct?, terms?: 'immediate' | 'credit',
//         dueDate? (YYYY-MM-DD, credit only),
//         payments?: [{ method, amount (rupees), reference? }], cashier? }
// Credit is a sale term, not a payment method: it needs a registered customer
// and a due date, and may carry zero or a partial down payment.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') return bad('Invalid JSON body');

  const items: { productId: string; qty: number }[] = (body.items || []).filter(
    (i: any) => i.productId && i.qty > 0,
  );
  if (!items.length) return bad('Cart is empty');

  const terms: SaleTerms = body.terms ?? 'immediate';
  if (terms !== 'immediate' && terms !== 'credit')
    return bad('terms must be "immediate" or "credit"');

  if (body.payments != null && !Array.isArray(body.payments)) return bad('payments must be a list');
  const paymentInput: SalePaymentInput[] = [];
  for (const p of body.payments ?? []) {
    const paise = rupeesToPaise(p?.amount);
    if (paise === null || paise <= 0)
      return bad('Each payment amount must be greater than zero, with at most two decimals.');
    paymentInput.push({ method: p?.method, amountPaise: paise, reference: p?.reference });
  }

  // A registered customer is required for credit; anyone else is a walk-in.
  let customerId: string | null = null;
  let customerName = 'Walk-in customer';
  if (body.customerId) {
    const c = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.id, String(body.customerId)))
      .get();
    if (!c) return bad('Customer not found', 404);
    if (c.name.trim().toLowerCase() !== 'walk-in customer') {
      customerId = c.id;
      customerName = c.name;
    }
  }
  let dueDate: string | null = null;
  if (terms === 'credit') {
    if (!customerId) return bad('Credit sales need a registered customer, not a walk-in.');
    if (!isIsoDate(body.dueDate) || body.dueDate < todayIST())
      return bad('Credit sales need a due date that is today or later.');
    dueDate = body.dueDate;
  }

  const ids = items.map((i) => i.productId);
  const products = await db
    .select()
    .from(schema.products)
    .where(inArray(schema.products.id, ids))
    .all();
  const byId = new Map(products.map((p) => [p.id, p]));

  for (const it of items) {
    const p = byId.get(it.productId);
    if (!p)
      return NextResponse.json({ error: `Product ${it.productId} not found` }, { status: 404 });
    if (!isSellable(p as any))
      return NextResponse.json({ error: `${p.name} is not available for sale` }, { status: 409 });
    if (p.stock < it.qty)
      return NextResponse.json(
        { error: `Insufficient stock for ${p.name} (have ${p.stock}, need ${it.qty})` },
        { status: 409 },
      );
  }

  const inputLines: SaleInputLine[] = items.map((it) => {
    const p = byId.get(it.productId)!;
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku,
      hsnCode: p.hsnCode,
      price: p.price,
      gstRate: p.gstRate,
      qty: it.qty,
    };
  });
  const discountPct = Math.max(0, Math.min(100, Number(body.discountPct) || 0));
  const sale = buildSaleLines(inputLines, discountPct);
  const totalQty = items.reduce((s, i) => s + i.qty, 0);
  const totalPaise = Math.round(sale.total * 100);

  const plan = planSalePayments(totalPaise, terms, paymentInput);
  if ('error' in plan) return bad(plan.error);
  const payStatus =
    plan.paidPaise >= totalPaise ? 'paid' : plan.paidPaise > 0 ? 'partial' : 'unpaid';

  const session = await getSession(req);
  const recordedBy = session?.name ?? body.cashier ?? null;
  const orderId = newId('SO');
  const invoiceId = newId('INV');
  const issueDate = todayIST();
  const date = new Date().toLocaleDateString('en-IN', { month: 'short', day: '2-digit' });
  const nowIso = new Date().toISOString();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.salesOrders).values({
        id: orderId,
        customer: customerName,
        items: totalQty,
        total: sale.total,
        status: 'fulfilled',
        payment: payStatus,
        date,
      } as any);

      await tx.insert(schema.invoices).values({
        id: invoiceId,
        salesOrderId: orderId,
        customerId,
        customer: customerName,
        issueDate,
        dueDate,
        terms,
        subtotal: sale.subtotal,
        tax: sale.tax,
        total: sale.total,
        status: 'issued',
        channel: 'pos',
        items: totalQty,
      } as any);

      await tx.insert(schema.invoiceItems).values(
        sale.lines.map((l) => ({
          invoiceId,
          productId: l.productId,
          name: l.name,
          sku: l.sku,
          hsnCode: l.hsnCode,
          qty: l.qty,
          unitPrice: l.unitPrice,
          discount: l.discount,
          gstRate: l.gstRate,
          gstAmount: l.gstAmount,
          lineTotal: l.lineTotal,
        })),
      );

      if (plan.payments.length)
        await tx.insert(schema.payments).values(
          plan.payments.map((p) => ({
            id: newPaymentId(),
            invoiceId,
            direction: 'payment',
            method: p.method,
            amountPaise: p.amountPaise,
            reference: p.reference,
            receivedAt: nowIso,
            recordedBy,
          })) as any,
        );

      for (const l of sale.lines) {
        const p = byId.get(l.productId)!;
        const newStock = p.stock - l.qty;
        const res = await tx
          .update(schema.products)
          .set({
            stock: newStock,
            status: deriveStatus(newStock),
            updatedAt: nowIso,
          } as any)
          .where(and(eq(schema.products.id, p.id), eq(schema.products.stock, p.stock)))
          .run();
        if (res.rowsAffected === 0) throw new StockConflict(p.name);

        await tx.insert(schema.stockMoves).values({
          type: 'sale',
          productId: p.id,
          product: p.name,
          qty: -l.qty,
          who: body.cashier || 'Register',
          warehouse: p.warehouse,
          meta: `${orderId} · ${invoiceId} · POS sale`,
          ref: invoiceId,
        } as any);
      }
    });
  } catch (e) {
    if (e instanceof StockConflict) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }

  const balance = paiseToRupees(totalPaise - plan.paidPaise);
  return NextResponse.json(
    {
      order: {
        id: orderId,
        customer: customerName,
        items: totalQty,
        total: sale.total,
        payment: payStatus,
      },
      invoice: { id: invoiceId, total: sale.total, payStatus, terms, dueDate },
      receipt: {
        id: orderId,
        invoiceId,
        customer: customerName,
        terms,
        dueDate,
        date: new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }),
        lines: sale.lines.map((l) => ({
          name: l.name,
          sku: l.sku,
          qty: l.qty,
          price: l.unitPrice,
          discount: l.discount,
          gstRate: l.gstRate,
          gstAmount: l.gstAmount,
          lineTotal: l.lineTotal,
        })),
        subtotal: sale.subtotal,
        discount: sale.discount,
        tax: sale.tax,
        total: sale.total,
        payments: plan.payments.map((p) => ({
          method: p.method,
          amount: paiseToRupees(p.amountPaise),
          reference: p.reference,
        })),
        paid: paiseToRupees(plan.paidPaise),
        change: paiseToRupees(plan.changePaise),
        balance,
      },
    },
    { status: 201 },
  );
}
