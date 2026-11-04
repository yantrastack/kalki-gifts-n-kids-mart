import { csvToList, type FeedRelated } from '@stockwell/shared';

/*
 * Pure helpers for the public Discover feed (GET /api/shop/feed), unit-tested in
 * feed.test.ts. YAN-110.
 */

type FeedCandidate = { id: string; category: string; giftTypes?: string | null };

/**
 * Products that can appear as reels: sellable ones with at least one photo or video.
 * A reel is a full-screen media post, so a product with no media would only be a
 * placeholder block. Order is kept.
 */
export function reelPool<T extends { id: string }>(
  sellable: T[],
  mediaCount: (id: string) => number,
): T[] {
  return sellable.filter((p) => mediaCount(p.id) > 0);
}

/**
 * The reels of one category tab (`null`, empty or "all" = every reel). Both the page the feed
 * returns and the `total` behind the "Found N" toast come from this one list, so the number
 * always matches what a customer can scroll through.
 */
export function reelsInCategory<T extends { category: string }>(
  pool: T[],
  category: string | null | undefined,
): T[] {
  return category && category !== 'all' ? pool.filter((p) => p.category === category) : pool;
}

/** Categories that have at least one reel, de-duplicated and sorted for the chips. */
export function reelCategories(pool: { category: string }[]): string[] {
  const set = new Set(pool.map((p) => p.category.trim()).filter(Boolean));
  return [...set].sort((a, b) => a.localeCompare(b));
}

/**
 * "More like this" for one product: other reels in the same category (+2) or sharing a
 * gift type (+1 each), best first. Picked from the reel pool so every suggestion has a
 * picture and can be reached in the feed.
 */
export function relatedReels<T extends FeedCandidate>(
  product: T,
  pool: T[],
  toRelated: (p: T) => FeedRelated,
  max = 6,
): FeedRelated[] {
  const myTypes = new Set(csvToList(product.giftTypes));
  return pool
    .filter((o) => o.id !== product.id)
    .map((o) => {
      let rel = o.category === product.category ? 2 : 0;
      for (const t of csvToList(o.giftTypes)) if (myTypes.has(t)) rel += 1;
      return { o, rel };
    })
    .filter((x) => x.rel > 0)
    .sort((a, b) => b.rel - a.rel)
    .slice(0, max)
    .map((x) => toRelated(x.o));
}
