import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { parseCreatedAt, sortOrdersNewestFirst } from '@/lib/salesOrders';

// Newest first by when the order was placed (`created_at`), so a new POS or API
// order is at the top. Ids aren't chronological (SO-5821 vs SO-MHX…), so they
// only break ties.
export async function GET() {
  const rows = await db.select().from(schema.salesOrders);
  return NextResponse.json(sortOrdersNewestFirst(rows, new Date()));
}
export async function POST(req: NextRequest) {
  const b = await req.json();
  const now = new Date();
  const row = {
    id: b.id || `SO-${Date.now().toString().slice(-4)}`,
    customer: b.customer || null,
    items: Number(b.items) || 0,
    total: Number(b.total) || 0,
    status: b.status || 'pending',
    payment: b.payment || 'unpaid',
    date: b.date || now.toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
    createdAt: parseCreatedAt(b.createdAt) ?? now.toISOString(),
  };
  await db.insert(schema.salesOrders).values(row);
  return NextResponse.json(row, { status: 201 });
}
