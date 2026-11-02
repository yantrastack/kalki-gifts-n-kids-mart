import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { reelCategories, reelPool, relatedReels } from './feed';

// YAN-110: the Discover feed showed products with no media as placeholder blocks, the
// chips were a hardcoded English list missing real categories, and "More like this"
// could point at products the feed never shows.

type P = { id: string; name: string; price: number; category: string; giftTypes: string | null };
const p = (id: string, category: string, giftTypes: string | null = null): P => ({
  id,
  name: id.toUpperCase(),
  price: 100,
  category,
  giftTypes,
});

const media: Record<string, number> = { a: 2, b: 1, d: 3, e: 1 };
const count = (id: string) => media[id] ?? 0;

describe('reelPool', () => {
  it('keeps only products with at least one photo or video, in feed order', () => {
    const sellable = [p('a', 'Toys'), p('b', 'Candles'), p('c', 'Toys'), p('d', 'Plants')];
    expect(reelPool(sellable, count).map((x) => x.id)).toEqual(['a', 'b', 'd']);
  });

  it('is empty when nothing has media', () => {
    expect(reelPool([p('x', 'Toys')], count)).toEqual([]);
  });
});

describe('reelCategories', () => {
  it('lists every category that has a reel, once, sorted', () => {
    const pool = [p('a', 'Toys'), p('b', 'Candles'), p('d', 'Plants'), p('e', 'Toys')];
    expect(reelCategories(pool)).toEqual(['Candles', 'Plants', 'Toys']);
  });

  it('includes categories the old hardcoded chips missed and skips blanks', () => {
    const pool = [p('a', 'Stationery'), p('b', 'Gourmet'), p('d', ' '), p('e', 'Accessories')];
    expect(reelCategories(pool)).toEqual(['Accessories', 'Gourmet', 'Stationery']);
  });
});

describe('relatedReels', () => {
  const pool = [
    p('a', 'Toys', 'toys,stationery'),
    p('b', 'Toys'),
    p('d', 'Stationery', 'stationery'),
    p('e', 'Candles', 'home-decor'),
  ];
  const toRel = (x: P) => ({ id: x.id, name: x.name, price: x.price, thumb: null });

  it('ranks same category first, then shared gift types, never itself', () => {
    expect(relatedReels(pool[0], pool, toRel).map((r) => r.id)).toEqual(['b', 'd']);
  });

  it('only suggests products from the pool (so every suggestion is a reel)', () => {
    const outside = p('zzz', 'Toys');
    const ids = relatedReels(outside, pool, toRel).map((r) => r.id);
    expect(ids.every((id) => pool.some((x) => x.id === id))).toBe(true);
  });

  it('caps the strip', () => {
    const many = Array.from({ length: 10 }, (_, i) => p(`t${i}`, 'Toys'));
    expect(relatedReels(many[0], many, toRel, 6)).toHaveLength(6);
  });
});

describe('feed route', () => {
  const src = readFileSync(path.join(__dirname, '../app/api/shop/feed/route.ts'), 'utf8');

  it('pages and filters the reel pool, not every sellable product', () => {
    expect(src).toMatch(/reelPool\(sellable/);
    expect(src).toMatch(/pool\.filter\(\(p\) => p\.category === category\)/);
  });

  it('returns the categories for the chips', () => {
    expect(src).toMatch(/categories: reelCategories\(pool\)/);
  });
});
