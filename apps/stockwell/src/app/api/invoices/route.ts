import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { desc } from 'drizzle-orm';

export async function GET() {
  const rows = await db.select().from(schema.invoices).orderBy(desc(schema.invoices.id));
  return NextResponse.json(rows);
}
export async function POST(req: NextRequest) {
  const b = await req.json();
  const subtotal = Number(b.subtotal) || 0;
  const tax = b.tax != null ? Number(b.tax) : Math.round(subtotal * 0.08 * 100) / 100;
  const total = b.total != null ? Number(b.total) : subtotal + tax;
  const row = {
    id: b.id || `INV-${Date.now().toString().slice(-5)}`,
    customer: b.customer || 'Walk-in customer',
    date:
      b.date ||
      new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' }),
    due: b.due || '—',
    subtotal,
    tax,
    total,
    paid: Number(b.paid) || 0,
    status: b.status || 'unpaid',
    method: b.method || '—',
    channel: b.channel || 'wholesale',
    items: Number(b.items) || 0,
  };
  await db.insert(schema.invoices).values(row as any);
  return NextResponse.json(row, { status: 201 });
}
