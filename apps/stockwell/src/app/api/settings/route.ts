import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { getSession } from '@/lib/guard';
import { eq } from 'drizzle-orm';

export async function GET() {
  const rows = await db.select().from(schema.settings).all();
  const obj: Record<string, string> = {};
  for (const r of rows) obj[r.key] = r.value ?? '';
  return NextResponse.json(obj);
}

export async function PUT(req: NextRequest) {
  const session = await getSession(req);
  if (session?.role !== 'admin')
    return NextResponse.json({ error: 'Admin role required' }, { status: 403 });
  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    const existing = await db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.key, key))
      .get();
    if (existing)
      await db
        .update(schema.settings)
        .set({ value: String(value) } as any)
        .where(eq(schema.settings.key, key));
    else await db.insert(schema.settings).values({ key, value: String(value) } as any);
  }
  const rows = await db.select().from(schema.settings).all();
  const obj: Record<string, string> = {};
  for (const r of rows) obj[r.key] = r.value ?? '';
  return NextResponse.json(obj);
}
