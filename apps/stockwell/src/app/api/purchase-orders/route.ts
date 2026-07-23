import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { deriveStatus } from '@/lib/status';
import { desc, eq, inArray } from 'drizzle-orm';

export async function GET() {
  const rows = await db
    .select()
    .from(schema.purchaseOrders)
    .orderBy(desc(schema.purchaseOrders.id));
  return NextResponse.json(rows);
}

type Line = {
  productId?: string;
  name?: string;
  sku?: string;
  category?: string;
  brand?: string;
  qty: number;
  cost: number;
  // Bill-entry extras (all optional)
  free?: number;
  scheme?: string;
  expiry?: string;
  price?: number; // selling price
  mrp?: number;
  batchNo?: string;
};

// Create a purchase order with line items. Lines without a productId create
// the product on the fly, so unlisted products can be added while entering
// the bill. With `receive: true` (the purchase-entry page) the delivered
// stock (qty + free) is added immediately and the product's cost/selling
// price/MRP/expiry are updated from the bill.
export async function POST(req: NextRequest) {
  const b = await req.json();
  const receiveNow = !!b.receive;
  const lines: Line[] = (b.lines || []).filter((l: any) => Number(l.qty) > 0);
  if (!b.supplier) return NextResponse.json({ error: 'Supplier is required' }, { status: 400 });
  if (!lines.length)
    return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
  for (const l of lines) {
    if (!l.productId && !(l.name?.trim() && l.sku?.trim()))
      return NextResponse.json({ error: 'New products need a name and SKU' }, { status: 400 });
  }

  const existingIds = lines.map((l) => l.productId).filter(Boolean) as string[];
  const existing = existingIds.length
    ? await db
        .select()
        .from(schema.products)
        .where(inArray(schema.products.id, existingIds))
        .all()
    : [];
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const id of existingIds) {
    if (!byId.has(id))
      return NextResponse.json({ error: `Product ${id} not found` }, { status: 404 });
  }

  const poId = b.id || `PO-${Date.now().toString().slice(-6)}`;
  const warehouse = b.warehouse || null;
  const now = new Date().toISOString();
  const today = new Date().toISOString().slice(0, 10);
  const totalQty = lines.reduce((s, l) => s + Number(l.qty), 0);
  const total = lines.reduce((s, l) => s + Number(l.qty) * (Number(l.cost) || 0), 0);
  const who = b.who || 'Purchase entry';

  await db.transaction(async (tx) => {
    const poRow = {
      id: poId,
      supplier: b.supplier,
      items: totalQty,
      total: Math.round(total * 100) / 100,
      status: receiveNow ? 'received' : 'approved',
      eta: b.eta || (receiveNow ? 'Delivered' : '—'),
      created: new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
      invoiceNo: b.invoiceNo?.trim() || null,
      invoiceDate: b.invoiceDate || null,
      enteredDate: b.enteredDate || today,
    };
    await tx.insert(schema.purchaseOrders).values(poRow as any);

    for (const l of lines) {
      const qty = Number(l.qty);
      const free = Math.max(0, Number(l.free) || 0);
      const cost = Number(l.cost) || 0;
      const sell = Number(l.price) || 0;
      const mrp = Number(l.mrp) || 0;
      const totalUnits = qty + free;
      let productId = l.productId;
      let productName: string;
      let sku: string;
      let isNew = 0;

      if (productId) {
        const p = byId.get(productId)!;
        productName = p.name;
        sku = p.sku;
        const patch: any = { updatedAt: now };
        if (receiveNow) {
          const newStock = p.stock + totalUnits;
          patch.stock = newStock;
          patch.status = deriveStatus(newStock);
          // Bill entry refreshes the product's commercials.
          patch.cost = cost || p.cost;
          if (sell) patch.price = sell;
          if (mrp) patch.mrp = mrp;
          if (l.expiry) patch.expiry = l.expiry;
        } else {
          patch.incoming = (p.incoming || 0) + totalUnits;
        }
        await tx.update(schema.products).set(patch).where(eq(schema.products.id, productId));
      } else {
        // Unlisted product — create it from the bill.
        productId = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
        productName = l.name!.trim();
        sku = l.sku!.trim();
        isNew = 1;
        const stock = receiveNow ? totalUnits : 0;
        const row = {
          id: productId,
          name: productName,
          sku,
          category: l.category?.trim() || 'Uncategorized',
          brand: l.brand?.trim() || null,
          price: sell || Math.round(cost * 1.25 * 100) / 100,
          cost,
          mrp: mrp || null,
          expiry: l.expiry || null,
          stock,
          incoming: receiveNow ? 0 : totalUnits,
          warehouse,
          supplier: b.supplier,
          status: deriveStatus(stock),
          createdAt: now,
          updatedAt: now,
        };
        await tx.insert(schema.products).values(row as any);
      }

      if (receiveNow) {
        await tx.insert(schema.stockMoves).values({
          type: 'purchase',
          productId,
          product: productName,
          qty: totalUnits,
          who,
          warehouse,
          meta: `${poId}${poRow.invoiceNo ? ` · Inv ${poRow.invoiceNo}` : ''} · bill entry${free ? ` (${free} free)` : ''}`,
        } as any);
      }

      const item = {
        poId,
        productId,
        product: productName,
        sku,
        qty,
        received: receiveNow ? qty : 0,
        cost,
        isNew,
        free,
        scheme: l.scheme?.trim() || null,
        expiry: l.expiry || null,
        price: sell || null,
        mrp: mrp || null,
        batchNo: l.batchNo?.trim() || null,
      };
      await tx.insert(schema.purchaseOrderItems).values(item as any);
    }
  });

  const po = await db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, poId))
    .get();
  return NextResponse.json(po, { status: 201 });
}
