import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { asc, desc, sql } from 'drizzle-orm';
import { csvToList, type FeedProduct, type FeedResponse, type ShopMedia } from '@stockwell/shared';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

/**
 * Public Discover feed for the storefront reels: sellable products with media,
 * live like/share counts, and a few related items each. Cursor pagination — the
 * cursor is an opaque offset; `nextCursor` is null at the end.
 */
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  const category = q.get('category');
  const limit = Math.min(Math.max(Number(q.get('limit')) || 5, 1), 20);
  const offset = Math.max(Number(q.get('cursor')) || 0, 0);

  const [rows, media, likeCounts, shareCounts] = await Promise.all([
    db
      .select()
      .from(schema.products)
      .orderBy(desc(schema.products.updatedAt), asc(schema.products.id))
      .all(),
    db.select().from(schema.productMedia).orderBy(asc(schema.productMedia.sortOrder)).all(),
    db
      .select({
        productId: schema.productEvents.productId,
        // net likes = likes minus unlikes
        n: sql<number>`sum(case when ${schema.productEvents.type} = 'like' then 1 when ${schema.productEvents.type} = 'unlike' then -1 else 0 end)`,
      })
      .from(schema.productEvents)
      .groupBy(schema.productEvents.productId)
      .all(),
    db
      .select({
        productId: schema.productEvents.productId,
        n: sql<number>`sum(case when ${schema.productEvents.type} = 'share' then 1 else 0 end)`,
      })
      .from(schema.productEvents)
      .groupBy(schema.productEvents.productId)
      .all(),
  ]);

  const mediaByProduct = new Map<string, ShopMedia[]>();
  for (const m of media) {
    const list = mediaByProduct.get(m.productId) ?? [];
    list.push({ id: m.id, url: m.url, type: m.type === 'video' ? 'video' : 'image' });
    mediaByProduct.set(m.productId, list);
  }
  const likeBy = new Map(likeCounts.map((r) => [r.productId, Math.max(Number(r.n) || 0, 0)]));
  const shareBy = new Map(shareCounts.map((r) => [r.productId, Math.max(Number(r.n) || 0, 0)]));

  // Sellable set, in feed order.
  const sellable = rows.filter((p) => p.status !== 'out' && p.stock > 0);
  const cover = (id: string) =>
    mediaByProduct.get(id)?.find((m) => m.type === 'image')?.url ?? null;

  const filtered =
    category && category !== 'all' ? sellable.filter((p) => p.category === category) : sellable;

  const page = filtered.slice(offset, offset + limit);
  const items: FeedProduct[] = page.map((p) => {
    // Related: same category or overlapping gift types, excluding self.
    const myTypes = new Set(csvToList(p.giftTypes));
    const related = sellable
      .filter((o) => o.id !== p.id)
      .map((o) => {
        let rel = o.category === p.category ? 2 : 0;
        for (const t of csvToList(o.giftTypes)) if (myTypes.has(t)) rel += 1;
        return { o, rel };
      })
      .filter((x) => x.rel > 0)
      .sort((a, b) => b.rel - a.rel)
      .slice(0, 6)
      .map((x) => ({ id: x.o.id, name: x.o.name, price: x.o.price, thumb: cover(x.o.id) }));

    return {
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
      likes: likeBy.get(p.id) ?? 0,
      shares: shareBy.get(p.id) ?? 0,
      related,
    };
  });

  const nextOffset = offset + limit;
  const res: FeedResponse = {
    items,
    nextCursor: nextOffset < filtered.length ? String(nextOffset) : null,
  };
  return NextResponse.json(res, { headers: CORS });
}
