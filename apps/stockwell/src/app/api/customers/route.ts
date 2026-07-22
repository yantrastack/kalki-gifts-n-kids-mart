import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { desc } from 'drizzle-orm';

export async function GET() {
  const rows = await db.select().from(schema.customers).orderBy(desc(schema.customers.spend));
  return NextResponse.json(rows);
}
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const row = {
    id: b.id || `c${Date.now().toString(36)}`,
    name: b.name,
    type: b.type || 'business',
    email: b.email || null,
    phone: b.phone || null,
    address: b.address || null,
    orders: Number(b.orders) || 0,
    spend: Number(b.spend) || 0,
    lastOrder: b.lastOrder || null,
    balance: Number(b.balance) || 0,
    color: b.color || null,
  };
  await db.insert(schema.customers).values(row);
  return NextResponse.json(row, { status: 201 });
}
