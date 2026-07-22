import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { desc } from 'drizzle-orm';

export async function GET() {
  const rows = await db.select().from(schema.returns).orderBy(desc(schema.returns.id));
  return NextResponse.json(rows);
}
export async function POST(req: NextRequest) {
  const b = await req.json();
  const row = {
    id: b.id || `RMA-${Date.now().toString().slice(-4)}`,
    customer: b.customer || 'Walk-in customer',
    invoice: b.invoice || '—',
    items: Number(b.items) || 1,
    total: Number(b.total) || 0,
    reason: b.reason || 'Other',
    status: b.status || 'pending',
    date: b.date || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
  };
  await db.insert(schema.returns).values(row);
  return NextResponse.json(row, { status: 201 });
}
