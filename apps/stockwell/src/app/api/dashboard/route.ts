import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { desc, gte } from 'drizzle-orm';
import { withCover } from '@/lib/productPhotos';
import { dailySeries, parseRange, rangeDays, rangeStartSql } from '@/lib/dashboardRange';
import { RECENT_ORDERS_LIMIT, latestOrders, orderPlacedAt } from '@/lib/salesOrders';

// `?range=7d|30d|90d` (default 30d) bounds the date-based data: the daily
// revenue series and recent stock moves. Recent sales orders are the latest
// orders whatever the range (YAN-115). Stock/catalog KPIs and the category mix
// are current snapshots and ignore the range.
export async function GET(req: NextRequest) {
  const range = parseRange(req.nextUrl.searchParams.get('range'));
  const days = rangeDays(range);
  const today = new Date();

  const products = await db.select().from(schema.products).all();
  const suppliers = await db.select().from(schema.suppliers).all();
  const warehouses = await db.select().from(schema.warehouses).all();
  const salesOrders = await db.select().from(schema.salesOrders).all();
  const moves = await db
    .select()
    .from(schema.stockMoves)
    .where(gte(schema.stockMoves.createdAt, rangeStartSql(days, today)))
    .orderBy(desc(schema.stockMoves.id))
    .limit(8);

  const inventoryValue = products.reduce((s, p) => s + p.cost * p.stock, 0);
  const retailValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const totalUnits = products.reduce((s, p) => s + p.stock, 0);
  const lowStock = products.filter((p) => p.status === 'low').length;
  const outOfStock = products.filter((p) => p.status === 'out').length;
  const openSalesValue = salesOrders
    .filter((o) => o.status !== 'fulfilled' && o.status !== 'cancelled')
    .reduce((s, o) => s + o.total, 0);

  // category breakdown by retail value
  const catMap: Record<string, number> = {};
  for (const p of products)
    catMap[p.category || 'Other'] = (catMap[p.category || 'Other'] || 0) + p.price * p.stock;
  const catTotal = Object.values(catMap).reduce((a, b) => a + b, 0) || 1;
  const palette = ['#9a3a3a', '#2c5e8a', '#a8761c', '#2a7d4f', '#6b4e8a'];
  const categories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .map(([name, v], i) => ({ name, value: v / catTotal, color: palette[i % palette.length] }));

  const topProducts = [...products]
    .sort((a, b) => b.price * b.stock - a.price * a.stock)
    .slice(0, 5)
    .map((p) => ({ name: p.name, sold: p.stock, revenue: Math.round(p.price * p.stock) }));

  // Revenue excludes cancelled orders.
  const revenue = dailySeries(
    salesOrders
      .filter((o) => o.status !== 'cancelled')
      .map((o) => ({ date: orderPlacedAt(o, today), amount: o.total ?? 0 })),
    days,
    today,
  );
  const recentOrders = latestOrders(salesOrders, RECENT_ORDERS_LIMIT, today);

  return NextResponse.json({
    range,
    days,
    kpis: {
      inventoryValue: Math.round(inventoryValue),
      retailValue: Math.round(retailValue),
      totalUnits,
      lowStock,
      outOfStock,
      productCount: products.length,
      supplierCount: suppliers.length,
      warehouseCount: warehouses.length,
      openSalesValue: Math.round(openSalesValue),
    },
    categories,
    topProducts,
    revenue: {
      series: revenue.series,
      total: Math.round(revenue.total),
      prevTotal: Math.round(revenue.prevTotal),
    },
    recentOrders,
    recentMoves: await withCover(moves, 'productId'),
  });
}
