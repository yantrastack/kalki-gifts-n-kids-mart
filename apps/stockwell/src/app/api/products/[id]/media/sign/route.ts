import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { eq } from 'drizzle-orm';
import { checkTypeAndSize } from '@/lib/mediaRules';
import { problemResponse } from '@/lib/mediaApi';
import { cloudinaryEnabled, directUploadTicket, localDiskUsable } from '@/lib/storage';
import { isAdmin } from '@/lib/guard';

type Params = { params: Promise<{ id: string }> };

/**
 * Step 1 of a product media upload (YAN-108). Body: `{ name, type, size }` of the file the
 * admin picked. The format and size are checked first (same limits as the upload itself).
 *
 * - Cloudinary configured → `{ mode: 'direct', uploadUrl, fields }`: the browser uploads
 *   the file straight to Cloudinary (real progress, no 4.5 MB Vercel body limit), then
 *   registers it with POST /api/products/[id]/media (JSON).
 * - Otherwise → `{ mode: 'server' }`: post the file to /api/products/[id]/media (multipart).
 *
 * Admin-only, and only for an existing product, so uploads are always tied to a product.
 */
export async function POST(req: NextRequest, { params }: Params) {
  if (!(await isAdmin(req))) return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  const { id } = await params;
  const product = await db
    .select({ id: schema.products.id })
    .from(schema.products)
    .where(eq(schema.products.id, id))
    .get();
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const body = (await req.json().catch(() => null)) as any;
  const name = String(body?.name ?? 'file').slice(0, 200);
  const check = checkTypeAndSize({
    name,
    type: String(body?.type ?? ''),
    size: Number(body?.size),
  });
  if (!check.ok) return problemResponse(check.problem);

  const ticket = directUploadTicket(check.kind);
  if (ticket) return NextResponse.json({ mode: 'direct', kind: check.kind, ...ticket });
  if (!cloudinaryEnabled() && !localDiskUsable())
    return problemResponse({ code: 'storage', name }, 503);
  return NextResponse.json({ mode: 'server', kind: check.kind });
}
