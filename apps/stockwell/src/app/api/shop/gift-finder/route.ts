import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { desc, asc } from 'drizzle-orm';
import { csvToList, type ShopMedia, type ShopProduct } from '@stockwell/shared';
import { isPublic } from '@/lib/catalog';
import { GiftQueryError, parseGiftCriteria, rankGifts } from '@/lib/giftScore';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

/**
 * Public gift finder → GiftFinderResponse.
 *
 * Rule-based ranking on admin-curated Gifting tags (predictable, no API key). The filter
 * semantics, scores and tie-breaks are documented and tested in `src/lib/giftScore.ts`:
 * recipient, age, budget and stock are hard filters ("anyone" = no preference); occasion,
 * gift type (OR) and interests rank the rest. Invalid age/prices are ignored; min > max
 * is a 400. An LLM/embedding reranker can layer on the same GiftQuery later.
 */
export async function GET(req: NextRequest) {
  let criteria: ReturnType<typeof parseGiftCriteria>;
  try {
    criteria = parseGiftCriteria(new URL(req.url).searchParams);
  } catch (e) {
    if (e instanceof GiftQueryError) {
      return NextResponse.json(
        { error: 'invalid-price-range', message: e.message },
        { status: 400, headers: CORS },
      );
    }
    throw e;
  }

  const [rows, media] = await Promise.all([
    db.select().from(schema.products).orderBy(desc(schema.products.updatedAt)).all(),
    db.select().from(schema.productMedia).orderBy(asc(schema.productMedia.sortOrder)).all(),
  ]);
  const mediaByProduct = new Map<string, ShopMedia[]>();
  for (const m of media) {
    const list = mediaByProduct.get(m.productId) ?? [];
    list.push({ id: m.id, url: m.url, type: m.type === 'video' ? 'video' : 'image' });
    mediaByProduct.set(m.productId, list);
  }

  const products: ShopProduct[] = rows
    .filter((p) => isPublic(p as any))
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      category: p.category,
      brand: p.brand,
      inStock: p.stock,
      tag: p.tag,
      media: mediaByProduct.get(p.id) ?? [],
      gift: {
        occasions: csvToList(p.giftOccasions),
        recipients: csvToList(p.giftRecipients),
        ageMin: p.giftAgeMin ?? null,
        ageMax: p.giftAgeMax ?? null,
        types: csvToList(p.giftTypes),
        interests: csvToList(p.giftInterests),
      },
    }));

  return NextResponse.json(rankGifts(products, criteria), { headers: CORS });
}
