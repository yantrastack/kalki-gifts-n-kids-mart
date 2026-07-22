import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { eq } from 'drizzle-orm';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json();
  if (!b.status) return NextResponse.json({ error: 'status required' }, { status: 400 });
  await db
    .update(schema.returns)
    .set({ status: b.status } as any)
    .where(eq(schema.returns.id, id));
  const row = await db.select().from(schema.returns).where(eq(schema.returns.id, id)).get();
  return NextResponse.json(row);
}
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(schema.returns).where(eq(schema.returns.id, id));
  return NextResponse.json({ ok: true });
}
