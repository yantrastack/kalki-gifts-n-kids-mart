import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { desc, asc } from 'drizzle-orm';
import {
  csvToList,
  type GiftMatch,
  type GiftReason,
  type ShopMedia,
  type ShopProduct,
} from '@stockwell/shared';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

const tokenize = (s: string) =>
  s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2);

/**
 * Public gift finder: ranks sellable products against the user's filters.
 *
 * Scoring (rule-based on admin-curated tags — predictable and needs no API key;
 * an LLM/embedding reranker can be layered on top of the same GiftQuery later):
 *   occasion match +30 · recipient +20 ("anyone" tag +8) · gift type +25
 *   age overlap +15 · each interest/keyword hit +10 (capped) · budget is a hard filter.
 */
export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams;
  const occasion = q.get('occasion')?.toLowerCase() || '';
  const recipient = q.get('recipient')?.toLowerCase() || '';
  const age = q.get('age') ? Number(q.get('age')) : null;
  const types = csvToList(q.get('types'));
  const likes = tokenize(q.get('likes') || '');
  const minPrice = q.get('minPrice') ? Number(q.get('minPrice')) : null;
  const maxPrice = q.get('maxPrice') ? Number(q.get('maxPrice')) : null;
  const hasFilters = !!(occasion || recipient || age !== null || types.length || likes.length);

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

  const matches: GiftMatch[] = [];
  for (const p of rows) {
    if (p.status === 'out' || p.stock <= 0) continue;
    if (minPrice !== null && p.price < minPrice) continue;
    if (maxPrice !== null && p.price > maxPrice) continue;

    const gift = {
      occasions: csvToList(p.giftOccasions),
      recipients: csvToList(p.giftRecipients),
      ageMin: p.giftAgeMin ?? null,
      ageMax: p.giftAgeMax ?? null,
      types: csvToList(p.giftTypes),
      interests: csvToList(p.giftInterests),
    };

    let score = 0;
    const reasons: GiftReason[] = [];

    if (occasion && gift.occasions.includes(occasion)) {
      score += 30;
      reasons.push({ code: 'occasion', value: occasion });
    }
    if (recipient) {
      if (gift.recipients.includes(recipient)) {
        score += 20;
        reasons.push(
          recipient === 'kids'
            ? { code: 'recipient-kids' }
            : { code: 'recipient', value: recipient },
        );
      } else if (gift.recipients.includes('anyone')) {
        score += 8;
        reasons.push({ code: 'anyone' });
      }
    }
    if (age !== null && (gift.ageMin !== null || gift.ageMax !== null)) {
      const lo = gift.ageMin ?? 0,
        hi = gift.ageMax ?? 150;
      if (age >= lo && age <= hi) {
        score += 15;
        reasons.push({ code: 'age' });
      }
    }
    const typeHits = types.filter((t) => gift.types.includes(t));
    if (typeHits.length) {
      score += 25;
      reasons.push({ code: 'type', value: typeHits.join(',') });
    }
    if (likes.length) {
      const haystack = new Set([
        ...gift.interests,
        ...tokenize([p.name, p.category ?? '', p.brand ?? '', p.tag ?? ''].join(' ')),
      ]);
      const hits = likes.filter((t) => haystack.has(t));
      if (hits.length) {
        score += Math.min(hits.length * 10, 30);
        reasons.push({ code: 'interests', value: hits.join(', ') });
      }
    }

    // With no filters at all, surface everything tagged for gifting.
    if (!hasFilters && (gift.occasions.length || gift.types.length)) {
      score = 1;
      reasons.push({ code: 'idea' });
    }
    if (score <= 0) continue;

    const product: ShopProduct = {
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      category: p.category,
      brand: p.brand,
      inStock: p.stock,
      tag: p.tag,
      media: mediaByProduct.get(p.id) ?? [],
      gift,
    };
    matches.push({ product, score, reasons });
  }

  matches.sort((a, b) => b.score - a.score || a.product.price - b.product.price);
  return NextResponse.json(matches.slice(0, 30), { headers: CORS });
}
