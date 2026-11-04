import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { desc, asc, inArray } from 'drizzle-orm';
import {
  csvToList,
  toShopMedia,
  WISHLIST_MAX,
  type ShopMedia,
  type ShopProduct,
} from '@stockwell/shared';
import { isPublic } from '@/lib/catalog';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

/** Most ids one `?ids=` lookup accepts: a whole wishlist. Bounds the query. */
const MAX_LOOKUP_IDS = WISHLIST_MAX;
const MAX_ID_LENGTH = 64;

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

/**
 * `?ids=a,b,c` → the distinct, trimmed ids, or null when the list is invalid
 * (too many, or an id that is too long).
 */
function parseIds(raw: string): string[] | null {
  const ids = [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (ids.length > MAX_LOOKUP_IDS || ids.some((id) => id.length > MAX_ID_LENGTH)) return null;
  return ids;
}

type ProductRow = typeof schema.products.$inferSelect;

/** Public fields only: no cost, supplier or lifecycle data. */
function toShopProduct(p: ProductRow, media: ShopMedia[]): ShopProduct {
  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: p.price,
    category: p.category,
    brand: p.brand,
    inStock: p.stock,
    tag: p.tag,
    media,
    gift: {
      occasions: csvToList(p.giftOccasions),
      recipients: csvToList(p.giftRecipients),
      ageMin: p.giftAgeMin ?? null,
      ageMax: p.giftAgeMax ?? null,
      types: csvToList(p.giftTypes),
      interests: csvToList(p.giftInterests),
    },
  };
}

/**
 * Public storefront catalog: only sellable products, no cost/supplier data.
 *
 * `?ids=a,b,c` (the wishlist, YAN-111) instead returns those products that are live in
 * the shop, **including out of stock ones** (`inStock: 0`), so a saved product that sold
 * out can be shown as unavailable. Draft, discontinued, deleted and unknown ids are left
 * out; the caller treats an id that is not returned as no longer available.
 */
export async function GET(req: NextRequest) {
  const rawIds = req.nextUrl.searchParams.get('ids');
  const ids = rawIds == null ? null : parseIds(rawIds);
  if (rawIds != null && ids == null) {
    return NextResponse.json(
      { error: `ids must be at most ${MAX_LOOKUP_IDS} ids of up to ${MAX_ID_LENGTH} characters` },
      { status: 400, headers: CORS },
    );
  }
  if (ids && ids.length === 0) return NextResponse.json([], { headers: CORS });

  const [rows, media] = await Promise.all([
    ids
      ? db.select().from(schema.products).where(inArray(schema.products.id, ids)).all()
      : db.select().from(schema.products).orderBy(desc(schema.products.updatedAt)).all(),
    (ids
      ? db.select().from(schema.productMedia).where(inArray(schema.productMedia.productId, ids))
      : db.select().from(schema.productMedia)
    )
      .orderBy(asc(schema.productMedia.sortOrder))
      .all(),
  ]);
  const mediaByProduct = new Map<string, ShopMedia[]>();
  for (const m of media) {
    const list = mediaByProduct.get(m.productId) ?? [];
    list.push(toShopMedia(m));
    mediaByProduct.set(m.productId, list);
  }
  const items: ShopProduct[] = rows
    .filter((p) => isPublic(p as any) && (ids ? true : p.stock > 0))
    .map((p) => toShopProduct(p, mediaByProduct.get(p.id) ?? []));
  return NextResponse.json(items, { headers: CORS });
}
