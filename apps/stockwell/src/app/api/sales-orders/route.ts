import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { desc } from 'drizzle-orm';

export async function GET() {
  const rows = await db.select().from(schema.salesOrders).orderBy(desc(schema.salesOrders.id));
  return NextResponse.json(rows);
}
export async function POST(req: NextRequest) {
  const b = await req.json();
  const row = {
    id: b.id || `SO-${Date.now().toString().slice(-4)}`,
    customer: b.customer || null,
    items: Number(b.items) || 0,
    total: Number(b.total) || 0,
    status: b.status || 'pending',
    payment: b.payment || 'unpaid',
    date: b.date || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
  };
  await db.insert(schema.salesOrders).values(row);
  return NextResponse.json(row, { status: 201 });
}
