import { NextResponse } from 'next/server';
import { db, schema } from '@/db/client';

export async function GET() {
  const products = await db.select().from(schema.products).all();
  const suppliers = await db.select().from(schema.suppliers).all();
  const sales = await db.select().from(schema.salesOrders).all();
  const invoices = await db.select().from(schema.invoices).all();

  // Inventory valuation by warehouse
  const whMap: Record<string, { units: number; cost: number; retail: number; lines: number }> = {};
  for (const p of products) {
    const w = p.warehouse || '—';
    whMap[w] = whMap[w] || { units: 0, cost: 0, retail: 0, lines: 0 };
    whMap[w].units += p.stock;
    whMap[w].cost += p.cost * p.stock;
    whMap[w].retail += p.price * p.stock;
    whMap[w].lines += 1;
  }
  const valuation = Object.entries(whMap).map(([warehouse, v]) => ({
    warehouse,
    lines: v.lines,
    units: v.units,
    cost: Math.round(v.cost),
    retail: Math.round(v.retail),
    potentialMargin: Math.round(v.retail - v.cost),
  }));

  // Low stock report
  const lowStock = products
    .filter((p) => p.status === 'low' || p.status === 'out')
    .map((p) => ({
      name: p.name,
      sku: p.sku,
      warehouse: p.warehouse,
      stock: p.stock,
      incoming: p.incoming,
      status: p.status,
    }))
    .sort((a, b) => a.stock - b.stock);

  // Sales by status
  const statusMap: Record<string, { count: number; value: number }> = {};
  for (const o of sales) {
    statusMap[o.status] = statusMap[o.status] || { count: 0, value: 0 };
    statusMap[o.status].count++;
    statusMap[o.status].value += o.total;
  }
  const salesByStatus = Object.entries(statusMap).map(([status, v]) => ({
    status,
    count: v.count,
    value: Math.round(v.value),
  }));

  // Supplier performance
  const supplierPerf = suppliers
    .map((s) => ({ name: s.name, onTime: s.onTime, spend: s.spend, lastOrder: s.lastOrder }))
    .sort((a, b) => b.spend - a.spend);

  // AR ageing (invoices)
  const ar = { paid: 0, partial: 0, unpaid: 0, overdue: 0 } as Record<string, number>;
  for (const i of invoices) ar[i.status] = (ar[i.status] || 0) + (i.total - (i.paid || 0));
  const receivables = Object.entries(ar).map(([status, outstanding]) => ({
    status,
    outstanding: Math.round(outstanding),
  }));

  return NextResponse.json({ valuation, lowStock, salesByStatus, supplierPerf, receivables });
}
