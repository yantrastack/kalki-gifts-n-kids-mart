import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { hashPassword } from '@/lib/auth';
import { getSession } from '@/lib/guard';
import { eq, desc } from 'drizzle-orm';

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const rows = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      active: schema.users.active,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt));
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (session?.role !== 'admin')
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  const b = await req.json();
  if (!b.email || !b.name || !b.password)
    return NextResponse.json({ error: 'Name, email and password required' }, { status: 400 });
  const e = String(b.email).toLowerCase().trim();
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, e)).get();
  if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 409 });
  const id = `u${Date.now().toString(36)}`;
  const row = {
    id,
    email: e,
    name: b.name,
    role: b.role === 'admin' ? 'admin' : 'staff',
    active: 1,
    passwordHash: hashPassword(b.password),
  };
  await db.insert(schema.users).values(row as any);
  return NextResponse.json(
    { id, email: e, name: b.name, role: row.role, active: 1 },
    { status: 201 },
  );
}
