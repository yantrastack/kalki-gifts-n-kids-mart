import { NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { desc } from 'drizzle-orm';

export async function GET() {
  const products = await db.select().from(schema.products).all();
  const sales = await db.select().from(schema.salesOrders).all();
  const moves = await db.select().from(schema.stockMoves).orderBy(desc(schema.stockMoves.id)).all();

  const retailValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const inventoryValue = products.reduce((s, p) => s + p.cost * p.stock, 0);
  const avgMargin = products.length
    ? products.reduce((s, p) => s + (p.price ? (p.price - p.cost) / p.price : 0), 0) /
      products.length
    : 0;
  const salesValue = sales.reduce((s, o) => s + o.total, 0);

  // category mix (retail value)
  const catMap: Record<string, number> = {};
  for (const p of products)
    catMap[p.category || 'Other'] = (catMap[p.category || 'Other'] || 0) + p.price * p.stock;
  const catTotal = Object.values(catMap).reduce((a, b) => a + b, 0) || 1;
  const palette = ['#9a3a3a', '#2c5e8a', '#a8761c', '#2a7d4f', '#6b4e8a'];
  const categories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, v], i) => ({ name, value: v / catTotal, color: palette[i % palette.length] }));

  // top products by retail value on hand
  const topProducts = [...products]
    .sort((a, b) => b.price * b.stock - a.price * a.stock)
    .slice(0, 6)
    .map((p) => ({ name: p.name, value: Math.round(p.price * p.stock), units: p.stock }));

  // movement volume by type
  const typeMap: Record<string, number> = {};
  for (const m of moves) typeMap[m.type] = (typeMap[m.type] || 0) + Math.abs(m.qty);
  const movementByType = Object.entries(typeMap).map(([label, value]) => ({ label, value }));

  // brand breakdown
  const brandMap: Record<string, number> = {};
  for (const p of products)
    if (p.brand) brandMap[p.brand] = (brandMap[p.brand] || 0) + p.price * p.stock;
  const topBrands = Object.entries(brandMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, v]) => ({ name, value: Math.round(v) }));

  return NextResponse.json({
    kpis: {
      retailValue: Math.round(retailValue),
      inventoryValue: Math.round(inventoryValue),
      avgMargin,
      salesValue: Math.round(salesValue),
      skuCount: products.length,
    },
    categories,
    topProducts,
    movementByType,
    topBrands,
  });
}
