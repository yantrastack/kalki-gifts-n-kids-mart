import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { eq } from 'drizzle-orm';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json();
  const patch: any = {};
  for (const k of [
    'name',
    'type',
    'email',
    'phone',
    'address',
    'orders',
    'spend',
    'lastOrder',
    'balance',
    'color',
  ])
    if (k in b) patch[k] = b[k];
  await db.update(schema.customers).set(patch).where(eq(schema.customers.id, id));
  const row = await db.select().from(schema.customers).where(eq(schema.customers.id, id)).get();
  return NextResponse.json(row);
}
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.delete(schema.customers).where(eq(schema.customers.id, id));
  return NextResponse.json({ ok: true });
}
