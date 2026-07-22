import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { deriveStatus } from '@/lib/status';
import { inArray, eq } from 'drizzle-orm';

const TAX_RATE = 0.08;

// Create a point-of-sale order: validates stock, prices server-side,
// decrements inventory and records a sale stock-move per line. Atomic.
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

  // validate
  const lines = [] as { product: any; qty: number; lineTotal: number }[];
  for (const it of items) {
    const p = byId.get(it.productId);
    if (!p)
      return NextResponse.json({ error: `Product ${it.productId} not found` }, { status: 404 });
    if (p.stock < it.qty)
      return NextResponse.json(
        { error: `Insufficient stock for ${p.name} (have ${p.stock}, need ${it.qty})` },
        { status: 409 },
      );
    lines.push({ product: p, qty: it.qty, lineTotal: p.price * it.qty });
  }

  const discountPct = Math.max(0, Math.min(100, Number(body.discountPct) || 0));
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const discount = subtotal * (discountPct / 100);
  const afterDiscount = subtotal - discount;
  const tax = afterDiscount * TAX_RATE;
  const total = afterDiscount + tax;
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  const payment = body.payment || 'card';
  const paymentStatus = ['ach', 'invoice'].includes(payment) ? 'unpaid' : 'paid';
  const orderId = `SO-${Date.now().toString().slice(-6)}`;
  const customer = body.customerName || 'Walk-in customer';
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const warehouse = lines[0].product.warehouse || 'WH-NYC';

  await db.transaction(async (tx) => {
    await tx.insert(schema.salesOrders).values({
      id: orderId,
      customer,
      items: totalQty,
      total: Math.round(total * 100) / 100,
      status: 'fulfilled',
      payment: paymentStatus,
      date,
    } as any);
    for (const l of lines) {
      const newStock = Math.max(0, l.product.stock - l.qty);
      await tx
        .update(schema.products)
        .set({
          stock: newStock,
          status: deriveStatus(newStock),
          updatedAt: new Date().toISOString(),
        } as any)
        .where(eq(schema.products.id, l.product.id));
      await tx.insert(schema.stockMoves).values({
        type: 'sale',
        productId: l.product.id,
        product: l.product.name,
        qty: -l.qty,
        who: body.cashier || 'Register',
        warehouse,
        meta: `${orderId} · POS sale`,
      } as any);
    }
  });

  return NextResponse.json(
    {
      order: { id: orderId, customer, items: totalQty, total, payment: paymentStatus },
      receipt: {
        id: orderId,
        customer,
        payment,
        date: new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        lines: lines.map((l) => ({
          name: l.product.name,
          sku: l.product.sku,
          qty: l.qty,
          price: l.product.price,
          lineTotal: l.lineTotal,
        })),
        subtotal,
        discount,
        tax,
        total,
        taxRate: TAX_RATE,
      },
    },
    { status: 201 },
  );
}
