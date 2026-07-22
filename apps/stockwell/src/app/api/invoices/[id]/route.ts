import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { eq } from 'drizzle-orm';

// Record a payment or update status.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json();
  const inv = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).get();
  if (!inv) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const patch: any = {};
  if (b.pay != null) {
    const paid = Math.min(inv.total, (inv.paid || 0) + Number(b.pay));
    patch.paid = paid;
    patch.status = paid >= inv.total ? 'paid' : paid > 0 ? 'partial' : inv.status;
    if (b.method) patch.method = b.method;
  }
  if (b.status) patch.status = b.status;
  await db.update(schema.invoices).set(patch).where(eq(schema.invoices.id, id));
  const row = await db.select().from(schema.invoices).where(eq(schema.invoices.id, id)).get();
  return NextResponse.json(row);
}
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(schema.invoices).where(eq(schema.invoices.id, id));
  return NextResponse.json({ ok: true });
}
