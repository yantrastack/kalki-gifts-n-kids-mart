import type { NextRequest } from 'next/server';
import { verifySession, SESSION_COOKIE, type SessionPayload } from '@/lib/session';

export async function getSession(req: NextRequest): Promise<SessionPayload | null> {
  return verifySession(req.cookies.get(SESSION_COOKIE)?.value);
}
export async function isAdmin(req: NextRequest): Promise<boolean> {
  const s = await getSession(req);
  return s?.role === 'admin';
}
// Any signed-in user (admin or staff).
export async function isSignedIn(req: NextRequest): Promise<boolean> {
  return (await getSession(req)) !== null;
}
