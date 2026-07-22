import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { eq } from 'drizzle-orm';
import { hashPassword } from '@/lib/auth';
import { createSession, SESSION_COOKIE } from '@/lib/session';

export async function POST(req: NextRequest) {
  const { email, password, name } = await req.json();
  if (!email || !password || !name)
    return NextResponse.json({ error: 'Name, email and password required' }, { status: 400 });
  if (String(password).length < 6)
    return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
  const e = String(email).toLowerCase().trim();
  const existing = await db.select().from(schema.users).where(eq(schema.users.email, e)).get();
  if (existing)
    return NextResponse.json(
      { error: 'An account with that email already exists' },
      { status: 409 },
    );
  const id = `u${Date.now().toString(36)}`;
  await db
    .insert(schema.users)
    .values({ id, email: e, name, role: 'staff', passwordHash: hashPassword(password) } as any);
  const token = await createSession({ sub: id, email: e, name, role: 'staff' });
  const res = NextResponse.json({ user: { id, email: e, name, role: 'staff' } }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
