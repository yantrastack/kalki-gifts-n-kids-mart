import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { desc } from 'drizzle-orm';

export async function GET() {
  const rows = await db
    .select()
    .from(schema.purchaseOrders)
    .orderBy(desc(schema.purchaseOrders.id));
  return NextResponse.json(rows);
}
export async function POST(req: NextRequest) {
  const b = await req.json();
  const row = {
    id: b.id || `PO-${Date.now().toString().slice(-4)}`,
    supplier: b.supplier || null,
    items: Number(b.items) || 0,
    total: Number(b.total) || 0,
    status: b.status || 'draft',
    eta: b.eta || '—',
    created:
      b.created || new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit' }),
  };
  await db.insert(schema.purchaseOrders).values(row);
  return NextResponse.json(row, { status: 201 });
}
