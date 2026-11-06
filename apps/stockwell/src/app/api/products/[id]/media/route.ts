import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { and, eq, asc } from 'drizzle-orm';
import crypto from 'crypto';
import { checkReorder, limitMedia } from '@/lib/mediaRules';
import { parseMediaRequest, problemResponse, storePending } from '@/lib/mediaApi';
import { removeMedia } from '@/lib/storage';
import { isSignedIn } from '@/lib/guard';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const rows = await db
    .select()
    .from(schema.productMedia)
    .where(eq(schema.productMedia.productId, id))
    .orderBy(asc(schema.productMedia.sortOrder));
  return NextResponse.json(rows);
}

// Add media to a product. Any signed-in user (admin or staff);
// Two body shapes (see lib/mediaApi.ts):
//  - multipart, field "files" (+ optional "meta" JSON per file): stored here;
//  - JSON `{ uploads: [...] }`: files the browser uploaded straight to Cloudinary.
export async function POST(req: NextRequest, { params }: Params) {
  if (!(await isSignedIn(req)))
    return NextResponse.json({ error: 'Sign in required' }, { status: 403 });
  const { id } = await params;
  const product = await db.select().from(schema.products).where(eq(schema.products.id, id)).get();
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  // Check every file before storing any, so a bad file doesn't leave half an upload.
  const parsed = await parseMediaRequest(req, 'files');
  if (!parsed.ok) return parsed.error;

  const existing = await db
    .select()
    .from(schema.productMedia)
    .where(eq(schema.productMedia.productId, id));
  // At most maxFor(kind) photos / videos per product, checked before anything is stored.
  for (const kind of ['image', 'video'] as const) {
    const incoming = parsed.items.filter((i) => i.kind === kind);
    const { problems } = limitMedia(kind, existing.filter((m) => m.type === kind).length, incoming);
    if (problems.length) return problemResponse(problems[0]);
  }
  let order = existing.length ? Math.max(...existing.map((m) => m.sortOrder)) + 1 : 0;

  const created = [];
  for (const item of parsed.items) {
    const stored = await storePending(item, id); // Cloudinary if configured, else local disk
    if (!stored.ok) {
      if (!created.length) return stored.error;
      break; // keep what was saved; the browser sends one file per request anyway
    }
    const row = {
      id: `m${crypto.randomBytes(5).toString('hex')}`,
      productId: id,
      ...stored.media,
      sortOrder: order++,
      createdAt: new Date().toISOString(),
    };
    await db.insert(schema.productMedia).values(row as any);
    created.push(row);
  }
  return NextResponse.json(created, { status: 201 });
}

// Reorder a product's media: body `{ order: [mediaId, ...] }` listing every one of its
// media ids once. The first becomes the cover ("Set as cover" = move it to the front).
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isSignedIn(req)))
    return NextResponse.json({ error: 'Sign in required' }, { status: 403 });
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const existing = await db
    .select({ id: schema.productMedia.id })
    .from(schema.productMedia)
    .where(eq(schema.productMedia.productId, id));
  if (!existing.length) {
    const product = await db
      .select({ id: schema.products.id })
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .get();
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const check = checkReorder(
    existing.map((m) => m.id),
    body?.order,
  );
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  // One batch = one atomic write: the order is saved completely or not at all.
  const updates = check.order.map((mediaId, i) =>
    db
      .update(schema.productMedia)
      .set({ sortOrder: i } as any)
      .where(and(eq(schema.productMedia.id, mediaId), eq(schema.productMedia.productId, id))),
  );
  if (updates.length) await db.batch(updates as [any, ...any[]]);
  return GET(req, { params });
}

// Remove one media item (staff may delete media, see middleware): DELETE ?mediaId=...
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const mediaId = new URL(req.url).searchParams.get('mediaId');
  if (!mediaId) return NextResponse.json({ error: 'mediaId is required' }, { status: 400 });

  const row = await db
    .select()
    .from(schema.productMedia)
    .where(eq(schema.productMedia.id, mediaId))
    .get();
  if (!row || row.productId !== id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await db.delete(schema.productMedia).where(eq(schema.productMedia.id, mediaId));
  // best-effort file cleanup; the DB row is the source of truth
  await removeMedia(row.url);
  return NextResponse.json({ ok: true });
}
