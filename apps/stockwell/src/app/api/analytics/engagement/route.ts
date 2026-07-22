import { NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { sql } from 'drizzle-orm';
import type { EngagementRow, EngagementSummary } from '@stockwell/shared';

// Admin/staff (protected by middleware). Rolls up product_events into per-product
// engagement + totals for the Engagement dashboard.
export async function GET() {
  const [products, grouped, sessionRow] = await Promise.all([
    db.select().from(schema.products).all(),
    db
      .select({
        productId: schema.productEvents.productId,
        views: sql<number>`sum(case when ${schema.productEvents.type} = 'view' then 1 else 0 end)`,
        likes: sql<number>`sum(case when ${schema.productEvents.type} = 'like' then 1 when ${schema.productEvents.type} = 'unlike' then -1 else 0 end)`,
        shares: sql<number>`sum(case when ${schema.productEvents.type} = 'share' then 1 else 0 end)`,
        buys: sql<number>`sum(case when ${schema.productEvents.type} = 'buy' then 1 else 0 end)`,
      })
      .from(schema.productEvents)
      .groupBy(schema.productEvents.productId)
      .all(),
    db
      .select({ n: sql<number>`count(distinct ${schema.productEvents.sessionId})` })
      .from(schema.productEvents)
      .get(),
  ]);

  const nameById = new Map(
    products.map((p) => [p.id, { name: p.name, category: p.category ?? '' }]),
  );
  const n = (v: number) => Math.max(Number(v) || 0, 0);

  const rows: EngagementRow[] = grouped.map((g) => {
    const meta = nameById.get(g.productId);
    const views = n(g.views);
    const likes = n(g.likes);
    const shares = n(g.shares);
    const buys = n(g.buys);
    return {
      id: g.productId,
      name: meta?.name ?? g.productId,
      category: meta?.category ?? '',
      views,
      likes,
      shares,
      buys,
      score: views + likes * 3 + shares * 4 + buys * 6,
    };
  });
  rows.sort((a, b) => b.score - a.score);

  const totals = rows.reduce(
    (t, r) => ({
      views: t.views + r.views,
      likes: t.likes + r.likes,
      shares: t.shares + r.shares,
      buys: t.buys + r.buys,
      sessions: t.sessions,
    }),
    { views: 0, likes: 0, shares: 0, buys: 0, sessions: n(sessionRow?.n ?? 0) },
  );

  const summary: EngagementSummary = { totals, products: rows };
  return NextResponse.json(summary);
}
