import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { eq } from 'drizzle-orm';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json();
  const patch: any = {};
  for (const k of ['name', 'contact', 'email', 'phone', 'onTime', 'lastOrder', 'spend'])
    if (k in b) patch[k] = b[k];
  await db.update(schema.suppliers).set(patch).where(eq(schema.suppliers.id, id));
  const row = await db.select().from(schema.suppliers).where(eq(schema.suppliers.id, id)).get();
  return NextResponse.json(row);
}
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(schema.suppliers).where(eq(schema.suppliers.id, id));
  return NextResponse.json({ ok: true });
}
