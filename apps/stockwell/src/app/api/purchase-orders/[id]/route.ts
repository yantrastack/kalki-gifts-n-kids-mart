import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { deriveStatus } from '@/lib/status';
import { eq, inArray } from 'drizzle-orm';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const po = await db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, id))
    .get();
  if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
  const items = await db
    .select()
    .from(schema.purchaseOrderItems)
    .where(eq(schema.purchaseOrderItems.poId, id))
    .all();
  return NextResponse.json({ ...po, lines: items });
}

type Line = {
  productId?: string;
  name?: string;
  sku?: string;
  category?: string;
  brand?: string;
  qty: number;
  cost: number;
  free?: number;
  scheme?: string;
  expiry?: string;
  price?: number;
  mrp?: number;
  batchNo?: string;
};

// Edit a purchase bill: the old lines' stock/incoming effect is reversed and
// the edited lines are applied fresh (same rules as creation), so inventory
// stays consistent with the corrected bill. A received PO stays received; an
// open PO stays approved with its `incoming` counts corrected.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json();
  const lines: Line[] = (b.lines || []).filter((l: any) => Number(l.qty) > 0);
  if (!b.supplier) return NextResponse.json({ error: 'Supplier is required' }, { status: 400 });
  if (!lines.length)
    return NextResponse.json({ error: 'At least one line item is required' }, { status: 400 });
  for (const l of lines) {
    if (!l.productId && !(l.name?.trim() && l.sku?.trim()))
      return NextResponse.json({ error: 'New products need a name and SKU' }, { status: 400 });
  }

  const po = await db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, id))
    .get();
  if (!po) return NextResponse.json({ error: 'Purchase order not found' }, { status: 404 });
  if (po.status === 'cancelled')
    return NextResponse.json({ error: 'Cannot edit a cancelled PO' }, { status: 409 });
  const received = po.status === 'received' || po.status === 'partial';

  const oldItems = await db
    .select()
    .from(schema.purchaseOrderItems)
    .where(eq(schema.purchaseOrderItems.poId, id))
    .all();

  // Load every product touched by the old or new lines.
  const ids = [
    ...new Set(
      [
        ...oldItems.map((i) => i.productId),
        ...lines.map((l) => l.productId),
      ].filter(Boolean) as string[],
    ),
  ];
  const products = ids.length
    ? await db.select().from(schema.products).where(inArray(schema.products.id, ids)).all()
    : [];
  const byId = new Map(products.map((p) => [p.id, p]));
  for (const l of lines) {
    if (l.productId && !byId.has(l.productId))
      return NextResponse.json({ error: `Product ${l.productId} not found` }, { status: 404 });
  }

  const now = new Date().toISOString();
  const who = b.who || 'Purchase entry';
  const totalQty = lines.reduce((s, l) => s + Number(l.qty), 0);
  const total = lines.reduce((s, l) => s + Number(l.qty) * (Number(l.cost) || 0), 0);
  const warehouse = b.warehouse || null;

  // Track net stock/incoming deltas per product so reversal + re-apply land
  // as a single update (and one net stock move) per product.
  const stockDelta = new Map<string, number>();
  const incomingDelta = new Map<string, number>();
  const bump = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) || 0) + v);

  // 1) Reverse old lines. Received units (+ their free units) came out of
  //    stock; still-pending units were sitting in `incoming`.
  for (const it of oldItems) {
    if (!it.productId || !byId.has(it.productId)) continue;
    const gotFree = it.received > 0 ? it.free : 0;
    if (it.received + gotFree > 0) bump(stockDelta, it.productId, -(it.received + gotFree));
    const pending = it.qty - it.received + (it.received > 0 ? 0 : it.free);
    if (pending > 0) bump(incomingDelta, it.productId, -pending);
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.purchaseOrderItems)
      .where(eq(schema.purchaseOrderItems.poId, id));

    // 2) Apply edited lines (creating brand-new products where needed).
    const newItems: any[] = [];
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
        if (received) {
          bump(stockDelta, productId, totalUnits);
          // Refresh the product's commercials from the corrected bill.
          const patch: any = { updatedAt: now, cost: cost || p.cost };
          if (sell) patch.price = sell;
          if (mrp) patch.mrp = mrp;
          if (l.expiry) patch.expiry = l.expiry;
          await tx.update(schema.products).set(patch).where(eq(schema.products.id, productId));
        } else {
          bump(incomingDelta, productId, totalUnits);
        }
      } else {
        productId = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
        productName = l.name!.trim();
        sku = l.sku!.trim();
        isNew = 1;
        const stock = received ? totalUnits : 0;
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
          incoming: received ? 0 : totalUnits,
          warehouse,
          supplier: b.supplier,
          status: deriveStatus(stock),
          createdAt: now,
          updatedAt: now,
        };
        await tx.insert(schema.products).values(row as any);
        if (received)
          await tx.insert(schema.stockMoves).values({
            type: 'purchase',
            productId,
            product: productName,
            qty: totalUnits,
            who,
            warehouse,
            meta: `${id} · bill edited`,
          } as any);
      }

      newItems.push({
        poId: id,
        productId,
        product: productName,
        sku,
        qty,
        received: received ? qty : 0,
        cost,
        isNew,
        free,
        scheme: l.scheme?.trim() || null,
        expiry: l.expiry || null,
        price: sell || null,
        mrp: mrp || null,
        batchNo: l.batchNo?.trim() || null,
      });
    }
    for (const item of newItems)
      await tx.insert(schema.purchaseOrderItems).values(item as any);

    // 3) Apply the net stock/incoming deltas for existing products.
    for (const [pid, p] of byId) {
      const ds = stockDelta.get(pid) || 0;
      const di = incomingDelta.get(pid) || 0;
      if (!ds && !di) continue;
      const newStock = Math.max(0, p.stock + ds);
      const patch: any = { updatedAt: now };
      if (ds) {
        patch.stock = newStock;
        patch.status = deriveStatus(newStock);
      }
      if (di) patch.incoming = Math.max(0, (p.incoming || 0) + di);
      await tx.update(schema.products).set(patch).where(eq(schema.products.id, pid));
      if (ds)
        await tx.insert(schema.stockMoves).values({
          type: ds > 0 ? 'purchase' : 'adjust',
          productId: pid,
          product: p.name,
          qty: ds,
          who,
          warehouse: p.warehouse,
          meta: `${id} · bill edited`,
        } as any);
    }

    // 4) Update the PO header. Partial POs collapse to fully received after
    //    an edit (the reversal cleared the partial state).
    const poPatch: any = {
      supplier: b.supplier,
      items: totalQty,
      total: Math.round(total * 100) / 100,
      status: received ? 'received' : 'approved',
      invoiceNo: b.invoiceNo?.trim() || null,
      invoiceDate: b.invoiceDate || null,
      enteredDate: b.enteredDate || po.enteredDate,
    };
    if (b.eta) poPatch.eta = b.eta;
    await tx.update(schema.purchaseOrders).set(poPatch).where(eq(schema.purchaseOrders.id, id));
  });

  const updated = await db
    .select()
    .from(schema.purchaseOrders)
    .where(eq(schema.purchaseOrders.id, id))
    .get();
  return NextResponse.json(updated);
}
