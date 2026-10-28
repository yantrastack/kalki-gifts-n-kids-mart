import { type NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db/client';

const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });

const hasRefund = async (returnId: string) =>
  !!(await db
    .select({ id: schema.payments.id })
    .from(schema.payments)
    .where(eq(schema.payments.returnId, returnId))
    .get());

// Approve or reject a return. 'refunded' can't be set here: it follows from
// recording a refund (POST /api/returns/[id]/refund), so the status can never
// say refunded while no money moved.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b?.status) return bad('status required');
  if (b.status === 'refunded')
    return bad('Record a refund with POST /api/returns/[id]/refund instead');
  if (!['pending', 'approved', 'rejected'].includes(b.status))
    return bad('status must be pending, approved or rejected');

  const current = await db.select().from(schema.returns).where(eq(schema.returns.id, id)).get();
  if (!current) return bad('Not found', 404);
  if (current.status === 'refunded' || (await hasRefund(id)))
    return bad('This return has refunds recorded and its status can no longer change.', 409);

  await db
    .update(schema.returns)
    .set({ status: b.status } as any)
    .where(eq(schema.returns.id, id));
  const row = await db.select().from(schema.returns).where(eq(schema.returns.id, id)).get();
  return NextResponse.json(row);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (await hasRefund(id))
    return bad('This return has refunds recorded and cannot be deleted.', 409);
  await db.delete(schema.returns).where(eq(schema.returns.id, id));
  return NextResponse.json({ ok: true });
}
