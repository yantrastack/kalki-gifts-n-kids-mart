import { type NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { db, schema } from '@/db/client';
import { deriveStatus } from '@/lib/status';
import { isSellable } from '@/lib/catalog';
import { buildSaleLines, type SaleInputLine } from '@/lib/invoice';
import { inArray, eq, and } from 'drizzle-orm';

class StockConflict extends Error {
  constructor(productName: string) {
    super(`Stock changed while checking out ${productName}. Please try again.`);
  }
}

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase()}${randomUUID().slice(0, 4).toUpperCase()}`;

// One transaction: sales order header, linked invoice with snapshot lines,
// stock decrement (compare-and-swap on the stock that was read), and a stock
// move per line referencing the invoice. Any failure rolls everything back.
export async function POST(req: NextRequest) {
  const body = await req.json();
  const items: { productId: string; qty: number }[] = (body.items || []).filter(
    (i: any) => i.productId && i.qty > 0,
  );
  if (!items.length) return NextResponse.json({ error: 'Cart is empty' }, { status: 400 });

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

  const payment = body.payment || 'card';
  const paymentStatus = ['ach', 'invoice'].includes(payment) ? 'unpaid' : 'paid';
  const orderId = newId('SO');
  const invoiceId = newId('INV');
  const customer = body.customerName || 'Walk-in customer';
  const date = new Date().toLocaleDateString('en-IN', { month: 'short', day: '2-digit' });
  const now = new Date().toISOString();

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.salesOrders).values({
        id: orderId,
        customer,
        items: totalQty,
        total: sale.total,
        status: 'fulfilled',
        payment: paymentStatus,
        date,
      } as any);

      await tx.insert(schema.invoices).values({
        id: invoiceId,
        salesOrderId: orderId,
        customer,
        date,
        due: date,
        subtotal: sale.subtotal,
        tax: sale.tax,
        total: sale.total,
        paid: paymentStatus === 'paid' ? sale.total : 0,
        status: paymentStatus,
        method: payment,
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

      for (const l of sale.lines) {
        const p = byId.get(l.productId)!;
        const newStock = p.stock - l.qty;
        const res = await tx
          .update(schema.products)
          .set({
            stock: newStock,
            status: deriveStatus(newStock),
            updatedAt: now,
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

  return NextResponse.json(
    {
      order: { id: orderId, customer, items: totalQty, total: sale.total, payment: paymentStatus },
      invoice: { id: invoiceId, total: sale.total, status: paymentStatus },
      receipt: {
        id: orderId,
        invoiceId,
        customer,
        payment,
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
      },
    },
    { status: 201 },
  );
}
