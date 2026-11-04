import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { and, eq, asc } from 'drizzle-orm';
import crypto from 'crypto';
import { checkMediaFile, checkReorder, declaredType, type MediaProblem } from '@/lib/mediaRules';
import { storeMedia, removeMedia } from '@/lib/storage';
import { isAdmin } from '@/lib/guard';

// English fallback for API clients; the admin shows its own translated text for `problem`.
const problemText = (p: MediaProblem): string => {
  switch (p.code) {
    case 'unsupported':
      return `${p.name}: unsupported file type (use JPG, PNG, WebP, MP4, MOV or WebM)`;
    case 'tooLarge':
      return `${p.name} is larger than ${p.limitMb} MB`;
    case 'notAnImage':
      return `${p.name} is not a valid JPG, PNG or WebP image`;
    case 'tooSmall':
      return `${p.name} is ${p.width}×${p.height} px; photos need at least ${p.min} px on the short side`;
  }
};

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

// Upload one or more image/video files (multipart form, field name "files"). Admin-only:
// the admin UI only offers upload/remove to admins, and the API enforces the same rule.
export async function POST(req: NextRequest, { params }: Params) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { id } = await params;
  const product = await db.select().from(schema.products).where(eq(schema.products.id, id)).get();
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 });

  // Check every file before storing any, so a bad file doesn't leave half an upload.
  const checked: { file: File; mime: string }[] = [];
  for (const f of files) {
    // Photos are read so their real format and size can be checked; videos are not.
    const isVideo = declaredType(f)?.startsWith('video/') ?? false;
    const bytes = isVideo ? null : new Uint8Array(await f.arrayBuffer());
    const res = checkMediaFile(f, bytes);
    if (!res.ok)
      return NextResponse.json(
        { error: problemText(res.problem), problem: res.problem },
        { status: 400 },
      );
    checked.push({ file: f, mime: res.mime });
  }

  const existing = await db
    .select()
    .from(schema.productMedia)
    .where(eq(schema.productMedia.productId, id));
  let order = existing.length ? Math.max(...existing.map((m) => m.sortOrder)) + 1 : 0;

  const created = [];
  for (const { file, mime } of checked) {
    const stored = await storeMedia(file, mime, id); // Cloudinary if configured, else local disk
    const row = {
      id: `m${crypto.randomBytes(5).toString('hex')}`,
      productId: id,
      url: stored.url,
      type: stored.type,
      sortOrder: order++,
      createdAt: new Date().toISOString(),
    };
    await db.insert(schema.productMedia).values(row);
    created.push(row);
  }
  return NextResponse.json(created, { status: 201 });
}

// Reorder a product's media: body `{ order: [mediaId, ...] }` listing every one of its
// media ids once. The first becomes the cover ("Set as cover" = move it to the front).
export async function PATCH(req: NextRequest, { params }: Params) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
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

// Remove one media item (admin-only via middleware): DELETE ?mediaId=...
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
