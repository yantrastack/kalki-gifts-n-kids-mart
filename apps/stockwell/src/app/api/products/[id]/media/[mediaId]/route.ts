import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { eq } from 'drizzle-orm';
import { parseMediaRequest, problemResponse, storePending } from '@/lib/mediaApi';
import { removeMedia } from '@/lib/storage';
import { isAdmin } from '@/lib/guard';

type Params = { params: Promise<{ id: string; mediaId: string }> };

/**
 * Replace one media item in place. Body: multipart field "file" (+ optional "meta"), or
 * JSON `{ uploads: [one direct Cloudinary upload] }` (see lib/mediaApi.ts). The new file
 * keeps the item's position (sort_order), so a replaced cover stays the cover. The old
 * file is removed best-effort after the row is saved. Admin-only. YAN-108.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Admin only' }, { status: 403 });

  const { id, mediaId } = await params;
  const row = await db
    .select()
    .from(schema.productMedia)
    .where(eq(schema.productMedia.id, mediaId))
    .get();
  if (!row || row.productId !== id)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Same checks as POST /media, so a bad replacement is refused before anything changes.
  const parsed = await parseMediaRequest(req, 'file');
  if (!parsed.ok) return parsed.error;
  if (parsed.items.length !== 1)
    return NextResponse.json({ error: 'Send exactly one file' }, { status: 400 });
  const item = parsed.items[0];

  // Replacing must not turn a photo into a video or vice versa — the media type is part
  // of the item's identity (cover counts, feed slides and badges all key off it).
  const expected = row.type === 'video' ? 'video' : 'image';
  if (item.kind !== expected)
    return problemResponse({ code: 'typeMismatch', name: item.name, expected });

  const stored = await storePending(item, id);
  if (!stored.ok) return stored.error;
  const { type: _type, ...patch } = stored.media;
  await db
    .update(schema.productMedia)
    .set(patch as any)
    .where(eq(schema.productMedia.id, mediaId));

  // The row is the source of truth; old-file cleanup is best-effort.
  if (row.url !== stored.media.url) await removeMedia(row.url);
  const updated = await db
    .select()
    .from(schema.productMedia)
    .where(eq(schema.productMedia.id, mediaId))
    .get();
  return NextResponse.json(updated);
}
