import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { getSession } from '@/lib/guard';
import { eq } from 'drizzle-orm';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  if (session?.role !== 'admin')
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  const { id } = await params;
  const b = await req.json();
  const patch: any = {};
  if (b.role) patch.role = b.role === 'admin' ? 'admin' : 'staff';
  if (b.active != null) patch.active = b.active ? 1 : 0;
  if (b.name) patch.name = b.name;
  await db.update(schema.users).set(patch).where(eq(schema.users.id, id));
  const row = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      active: schema.users.active,
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .get();
  return NextResponse.json(row);
}

// DELETE is already admin-gated by middleware; block deleting yourself.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession(req);
  const { id } = await params;
  if (session?.sub === id)
    return NextResponse.json({ error: "You can't delete your own account" }, { status: 400 });
  await db.delete(schema.users).where(eq(schema.users.id, id));
  return NextResponse.json({ ok: true });
}
