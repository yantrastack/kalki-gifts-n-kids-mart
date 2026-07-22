import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { eq, asc } from 'drizzle-orm';
import path from 'path';
import crypto from 'crypto';
import { MIME_TO_EXT, EXT_TO_MIME } from '@/lib/uploads';
import { storeMedia, removeMedia } from '@/lib/storage';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

// Some clients send octet-stream for videos — fall back to the file extension.
function resolveMime(f: File): string | null {
  if (MIME_TO_EXT[f.type]) return f.type;
  return EXT_TO_MIME[path.extname(f.name).toLowerCase()] ?? null;
}

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

// Upload one or more image/video files (multipart form, field name "files").
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const product = await db.select().from(schema.products).where(eq(schema.products.id, id)).get();
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const form = await req.formData();
  const files = form.getAll('files').filter((f): f is File => f instanceof File);
  if (!files.length) return NextResponse.json({ error: 'No files provided' }, { status: 400 });

  for (const f of files) {
    if (!resolveMime(f))
      return NextResponse.json(
        { error: `Unsupported file type: ${f.type || f.name}` },
        { status: 400 },
      );
    if (f.size > MAX_FILE_SIZE)
      return NextResponse.json({ error: `${f.name} is larger than 50 MB` }, { status: 400 });
  }

  const existing = await db
    .select()
    .from(schema.productMedia)
    .where(eq(schema.productMedia.productId, id));
  let order = existing.length ? Math.max(...existing.map((m) => m.sortOrder)) + 1 : 0;

  const created = [];
  for (const f of files) {
    const mime = resolveMime(f)!;
    const stored = await storeMedia(f, mime, id); // Cloudinary if configured, else local disk
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
