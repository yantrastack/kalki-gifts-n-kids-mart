import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { eq } from 'drizzle-orm';
import { checkMediaFile, declaredType } from '@/lib/mediaRules';
import { storeMedia, removeMedia } from '@/lib/storage';
import { isAdmin } from '@/lib/guard';

// English fallback for API clients; the admin shows its own translated text for `problem`.
const problemText = (p: { code: string; name: string } & Record<string, any>): string => {
  switch (p.code) {
    case 'unsupported':
      return `${p.name}: unsupported file type (use JPG, PNG, WebP, MP4, MOV or WebM)`;
    case 'tooLarge':
      return `${p.name} is larger than ${p.limitMb} MB`;
    case 'notAnImage':
      return `${p.name} is not a valid JPG, PNG or WebP image`;
    case 'tooSmall':
      return `${p.name} is ${p.width}×${p.height} px; photos need at least ${p.min} px on the short side`;
    default:
      return `${p.name}: invalid file`;
  }
};

type Params = { params: Promise<{ id: string; mediaId: string }> };

/**
 * Replace one media item in place (multipart form, field name "file"). The new file keeps
 * the item's position (sort_order), so a replaced cover stays the cover. The old file is
 * removed best-effort after the new row is saved. Admin-only.
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

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File))
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  // Same checks as POST /media, so a bad replacement is refused before anything changes.
  const isVideo = declaredType(file)?.startsWith('video/') ?? false;
  const bytes = isVideo ? null : new Uint8Array(await file.arrayBuffer());
  const res = checkMediaFile(file, bytes);
  if (!res.ok)
    return NextResponse.json(
      { error: problemText(res.problem as any), problem: res.problem },
      { status: 400 },
    );

  // Replacing must not turn a photo into a video or vice versa — the media type is part
  // of the item's identity (cover counts, feed slides and badges all key off it).
  const kind = res.kind ?? (res.mime?.startsWith('video/') ? 'video' : 'image');
  if (kind !== row.type)
    return NextResponse.json(
      {
        error: `This is a ${row.type}; choose another ${row.type} to replace it`,
        problem: { code: 'typeMismatch', name: file.name, expected: row.type },
      },
      { status: 400 },
    );

  const stored = await storeMedia(file, res.mime, id);
  const patch = { url: stored.url };
  await db.update(schema.productMedia).set(patch).where(eq(schema.productMedia.id, mediaId));

  // The row is the source of truth; old-file cleanup is best-effort.
  await removeMedia(row.url);
  const updated = await db
    .select()
    .from(schema.productMedia)
    .where(eq(schema.productMedia.id, mediaId))
    .get();
  return NextResponse.json(updated);
}
