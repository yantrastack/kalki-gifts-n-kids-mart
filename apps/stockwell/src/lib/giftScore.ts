/**
 * Gift finder ranking: pure functions, no DB, so every rule is unit-tested
 * (giftScore.test.ts). The route (`/api/shop/gift-finder`) loads products and calls these.
 *
 * Filter semantics
 *   Hard filters (a product that fails one is never shown, not even as an alternative):
 *     - availability: in stock (the route also drops non-public products)
 *     - budget: minPrice <= price <= maxPrice (inclusive)
 *     - recipient: a product tagged for other recipients only (not the chosen one, not
 *       "anyone") is excluded. Untagged products are kept. "anyone" = no preference, and so
 *       is an unknown recipient value (recipients are a fixed list).
 *     - age: a product whose tagged age range excludes the age is excluded. Products with
 *       no age tags, or an impossible range (min above max), are kept.
 *   Scoring signals (rank the rest):
 *     occasion +30 · recipient exact +20 / "anyone"-tagged +8 · gift type +25 (any of the
 *     selected types; OR, flat, so tagging many types earns nothing extra) · age in range +15
 *     · each interest word found in the product's interests/name/category/brand/tag +10
 *     (capped at 30).
 *
 * Buckets
 *   matches: score > 0, and when gift types are selected, at least one of them.
 *   alternatives: only when there are fewer than FEW_MATCHES matches. Other products that
 *     pass every hard filter; `relaxed` lists the preference answers (types, occasion,
 *     interests) they may not satisfy.
 *   No answers at all: every product tagged for gifting is a match ("idea").
 *
 * Order: score, then number of reasons, then lower price, then newest (input order).
 */
import type {
  GiftFinderResponse,
  GiftMatch,
  GiftReason,
  GiftRelaxed,
  ShopProduct,
} from '@stockwell/shared';
import { GIFT_RECIPIENTS, csvToList, parseGiftAge } from '@stockwell/shared';

export const MAX_MATCHES = 30;
export const MAX_ALTERNATIVES = 10;
export const FEW_MATCHES = 4;

/** One interest word: what the user typed (shown back in reasons) and its match key. */
export type GiftLike = { raw: string; key: string };

/** A parsed, validated gift query. Empty string / null / [] = not answered. */
export type GiftCriteria = {
  occasion: string;
  recipient: string;
  age: number | null;
  types: string[];
  likes: GiftLike[];
  minPrice: number | null;
  maxPrice: number | null;
};

/** The query can't be answered as asked (e.g. min price above max price). */
export class GiftQueryError extends Error {}

const STOPWORDS = new Set([
  'an',
  'and',
  'or',
  'the',
  'of',
  'in',
  'on',
  'to',
  'for',
  'with',
  'is',
  'it',
  'my',
  'he',
  'she',
  'his',
  'her',
  'they',
  'like',
  'likes',
  'love',
  'loves',
]);

/** Naive English singular, so "books" matches "book". Non-Latin words are left as they are. */
export function singular(w: string): string {
  if (!/^[a-z]+$/.test(w) || w.length <= 3) return w;
  if (w.endsWith('ies') && w.length > 4) return `${w.slice(0, -3)}y`;
  if (/(xes|ches|shes|sses|zes)$/.test(w)) return w.slice(0, -2);
  if (/(ss|us|is)$/.test(w)) return w;
  return w.endsWith('s') ? w.slice(0, -1) : w;
}

/**
 * Split text into words in any script. Letters, combining marks (Telugu vowel signs are
 * marks) and digits form words; 2-letter words ("tv") are kept. Text is NFC-normalised so
 * the same Telugu word typed as composed or decomposed characters matches.
 */
export function words(s: string): string[] {
  return s
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{M}\p{N}]+/u)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
}

/** Interest text → unique words, each with its match key. */
export function parseLikes(s: string): GiftLike[] {
  const seen = new Set<string>();
  const out: GiftLike[] = [];
  for (const raw of words(s)) {
    const key = singular(raw);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ raw, key });
  }
  return out;
}

const price = (v: string | null): number | null => {
  if (v === null || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Read query-string params. Invalid age/prices are ignored; min > max throws. */
export function parseGiftCriteria(q: URLSearchParams): GiftCriteria {
  const recipient = q.get('recipient')?.trim().toLowerCase() || '';
  const c: GiftCriteria = {
    occasion: q.get('occasion')?.trim().toLowerCase() || '',
    recipient:
      recipient !== 'anyone' && (GIFT_RECIPIENTS as readonly string[]).includes(recipient)
        ? recipient
        : '',
    age: parseGiftAge(q.get('age')),
    types: [...new Set(csvToList(q.get('types')))],
    likes: parseLikes(q.get('likes') || ''),
    minPrice: price(q.get('minPrice')),
    maxPrice: price(q.get('maxPrice')),
  };
  if (c.minPrice !== null && c.maxPrice !== null && c.minPrice > c.maxPrice) {
    throw new GiftQueryError('minPrice is greater than maxPrice');
  }
  return c;
}

/** In-stock product count per gift type. */
export function countGiftTypes(products: ShopProduct[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of products) {
    if (p.inStock <= 0) continue;
    for (const t of new Set(p.gift.types)) counts[t] = (counts[t] ?? 0) + 1;
  }
  return counts;
}

type Scored = GiftMatch & { order: number; typeHit: boolean };

const isGiftTagged = (p: ShopProduct) => p.gift.occasions.length > 0 || p.gift.types.length > 0;

/** Score one product, or null when it fails a hard filter. */
export function scoreGift(p: ShopProduct, c: GiftCriteria, order = 0): Scored | null {
  const g = p.gift;
  if (p.inStock <= 0) return null;
  if (c.minPrice !== null && p.price < c.minPrice) return null;
  if (c.maxPrice !== null && p.price > c.maxPrice) return null;

  const tagged = (list: string[]) => list.length > 0;
  if (
    c.recipient &&
    tagged(g.recipients) &&
    !g.recipients.includes(c.recipient) &&
    !g.recipients.includes('anyone')
  ) {
    return null;
  }
  // An impossible range (min above max) is bad data, not a reason to hide the product.
  const hasAgeRange =
    (g.ageMin !== null || g.ageMax !== null) &&
    !(g.ageMin !== null && g.ageMax !== null && g.ageMin > g.ageMax);
  const ageFits =
    c.age !== null && hasAgeRange && c.age >= (g.ageMin ?? 0) && c.age <= (g.ageMax ?? Infinity);
  if (c.age !== null && hasAgeRange && !ageFits) return null;

  let score = 0;
  const reasons: GiftReason[] = [];
  if (c.occasion && g.occasions.includes(c.occasion)) {
    score += 30;
    reasons.push({ code: 'occasion', value: c.occasion });
  }
  if (c.recipient) {
    if (g.recipients.includes(c.recipient)) {
      score += 20;
      reasons.push(
        c.recipient === 'kids'
          ? { code: 'recipient-kids' }
          : { code: 'recipient', value: c.recipient },
      );
    } else if (g.recipients.includes('anyone')) {
      score += 8;
      reasons.push({ code: 'anyone' });
    }
  }
  if (ageFits) {
    score += 15;
    reasons.push({ code: 'age' });
  }
  const typeHits = c.types.filter((t) => g.types.includes(t));
  if (typeHits.length) {
    score += 25;
    reasons.push({ code: 'type', value: typeHits.join(',') });
  }
  if (c.likes.length) {
    const haystack = new Set(
      [...g.interests, p.name, p.category ?? '', p.brand ?? '', p.tag ?? '']
        .flatMap(words)
        .map(singular),
    );
    const hits = c.likes.filter((l) => haystack.has(l.key));
    if (hits.length) {
      score += Math.min(hits.length * 10, 30);
      reasons.push({ code: 'interests', value: hits.map((h) => h.raw).join(', ') });
    }
  }
  return { product: p, score, reasons, order, typeHit: typeHits.length > 0 };
}

const byRank = (a: Scored, b: Scored) =>
  b.score - a.score ||
  b.reasons.length - a.reasons.length ||
  a.product.price - b.product.price ||
  a.order - b.order;

const strip = ({ product, score, reasons }: Scored): GiftMatch => ({
  product,
  score,
  reasons: reasons.length ? reasons : [{ code: 'idea' }],
});

/**
 * Rank sellable products for a query. `products` should already be limited to what the
 * storefront may show (public), newest first; stock is checked here.
 */
export function rankGifts(products: ShopProduct[], c: GiftCriteria): GiftFinderResponse {
  const facets = { types: countGiftTypes(products) };
  const pool = products.map((p, i) => scoreGift(p, c, i)).filter((s): s is Scored => s !== null);

  const answered = !!(
    c.occasion ||
    c.recipient ||
    c.age !== null ||
    c.types.length ||
    c.likes.length
  );
  if (!answered) {
    const ideas = pool.filter((s) => isGiftTagged(s.product)).map((s) => ({ ...s, score: 1 }));
    return {
      matches: ideas.sort(byRank).slice(0, MAX_MATCHES).map(strip),
      alternatives: [],
      relaxed: [],
      facets,
    };
  }

  const isMatch = (s: Scored) => s.score > 0 && (!c.types.length || s.typeHit);
  const matches = pool.filter(isMatch).sort(byRank).slice(0, MAX_MATCHES);

  let alternatives: Scored[] = [];
  const relaxed: GiftRelaxed[] = [];
  if (matches.length < FEW_MATCHES) {
    alternatives = pool
      .filter((s) => !isMatch(s) && (s.score > 0 || isGiftTagged(s.product)))
      .sort(byRank)
      .slice(0, MAX_ALTERNATIVES);
    // Name an answer as relaxed only if some alternative doesn't satisfy it.
    const misses = (code: GiftReason['code']) =>
      alternatives.some((s) => !s.reasons.some((r) => r.code === code));
    if (c.types.length && misses('type')) relaxed.push('types');
    if (c.occasion && misses('occasion')) relaxed.push('occasion');
    if (c.likes.length && misses('interests')) relaxed.push('interests');
  }
  return {
    matches: matches.map(strip),
    alternatives: alternatives.map(strip),
    relaxed,
    facets,
  };
}
