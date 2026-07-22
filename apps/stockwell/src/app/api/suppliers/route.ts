import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { desc } from 'drizzle-orm';

export async function GET() {
  const rows = await db.select().from(schema.suppliers).orderBy(desc(schema.suppliers.spend));
  return NextResponse.json(rows);
}
export async function POST(req: NextRequest) {
  const b = await req.json();
  if (!b.name) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const row = {
    id: b.id || `s${Date.now().toString(36)}`,
    name: b.name,
    contact: b.contact || null,
    email: b.email || null,
    phone: b.phone || null,
    onTime: Number(b.onTime) || 0,
    lastOrder: b.lastOrder || null,
    spend: Number(b.spend) || 0,
  };
  await db.insert(schema.suppliers).values(row);
  return NextResponse.json(row, { status: 201 });
}
