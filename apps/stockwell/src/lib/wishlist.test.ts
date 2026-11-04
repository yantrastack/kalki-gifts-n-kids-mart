import type { ShopProduct } from '@stockwell/shared';
import { describe, expect, it } from 'vitest';
import { en } from '../../../storefront/src/i18n/en';
import { te } from '../../../storefront/src/i18n/te';
import { RAIL_BUTTONS, reelRail } from '../../../storefront/src/reels';
import {
  loadWishlist,
  parseWishlist,
  removeFromWishlist,
  resolveWishlist,
  saveWishlist,
  toggleWishlist,
  WISHLIST_KEY,
  WISHLIST_MAX,
  type WishlistEntry,
  type WishlistStorage,
} from '../../../storefront/src/wishlist';

// Storefront wishlist (YAN-111): pure helpers behind the shared store.

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  const s: WishlistStorage & { data: Record<string, string> } = {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
  return s;
};

const product = (id: string, inStock: number): ShopProduct => ({
  id,
  name: `Product ${id}`,
  sku: id.toUpperCase(),
  price: 499,
  category: 'Toys',
  brand: null,
  inStock,
  tag: null,
  media: [],
  gift: { occasions: [], recipients: [], ageMin: null, ageMax: null, types: [], interests: [] },
});

describe('toggleWishlist', () => {
  it('saves, then removes on the second tap', () => {
    const a = toggleWishlist([], { id: 'p1', name: 'Teddy' }, 1);
    expect(a.on).toBe(true);
    expect(a.next).toEqual([{ id: 'p1', savedAt: 1, name: 'Teddy' }]);
    const b = toggleWishlist(a.next, { id: 'p1' }, 2);
    expect(b.on).toBe(false);
    expect(b.next).toEqual([]);
  });

  it('puts the newest save first and never duplicates', () => {
    let list: WishlistEntry[] = [];
    list = toggleWishlist(list, { id: 'p1' }, 1).next;
    list = toggleWishlist(list, { id: 'p2' }, 2).next;
    expect(list.map((e) => e.id)).toEqual(['p2', 'p1']);
    expect(new Set(list.map((e) => e.id)).size).toBe(list.length);
  });

  it('ends in the right state after ten rapid taps', () => {
    let list: WishlistEntry[] = [{ id: 'other', savedAt: 0 }];
    for (let i = 0; i < 10; i++) list = toggleWishlist(list, { id: 'p1' }, i).next;
    expect(list.map((e) => e.id)).toEqual(['other']); // even number of taps: not saved
    list = toggleWishlist(list, { id: 'p1' }, 11).next;
    expect(list.filter((e) => e.id === 'p1')).toHaveLength(1);
    expect(list).toHaveLength(2);
  });

  it('does not add past WISHLIST_MAX, but still removes', () => {
    const full = Array.from({ length: WISHLIST_MAX }, (_, i) => ({ id: `p${i}`, savedAt: i }));
    const add = toggleWishlist(full, { id: 'new' }, 999);
    expect(add).toMatchObject({ on: false, full: true });
    expect(add.next).toHaveLength(WISHLIST_MAX);
    const rm = toggleWishlist(full, { id: 'p3' }, 999);
    expect(rm).toMatchObject({ on: false, full: false });
    expect(rm.next).toHaveLength(WISHLIST_MAX - 1);
  });
});

describe('removeFromWishlist', () => {
  it('removes only that product and ignores unknown ids', () => {
    const list = [
      { id: 'a', savedAt: 2 },
      { id: 'b', savedAt: 1 },
    ];
    expect(removeFromWishlist(list, 'a')).toEqual([{ id: 'b', savedAt: 1 }]);
    expect(removeFromWishlist(list, 'zzz')).toEqual(list);
  });
});

describe('parseWishlist / loadWishlist / saveWishlist', () => {
  it('falls back to an empty list for missing or corrupt storage', () => {
    for (const raw of [null, undefined, '', '{', 'null', '42', '"x"', '{"id":"p1"}']) {
      expect(parseWishlist(raw)).toEqual([]);
    }
    expect(loadWishlist(memory({ [WISHLIST_KEY]: '[not json' }))).toEqual([]);
    expect(loadWishlist(null)).toEqual([]);
    const throwing: WishlistStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {},
    };
    expect(loadWishlist(throwing)).toEqual([]);
  });

  it('drops junk items and duplicates, accepts plain ids, sorts newest first', () => {
    const raw = JSON.stringify([
      { id: 'p1', savedAt: 1 },
      'p2',
      { id: 'p1', savedAt: 5 },
      { id: '' },
      { nope: true },
      null,
      7,
      { id: 'x'.repeat(65) },
      { id: 'p3', savedAt: 3, name: 'Kite' },
    ]);
    expect(parseWishlist(raw)).toEqual([
      { id: 'p3', savedAt: 3, name: 'Kite' },
      { id: 'p1', savedAt: 1 },
      { id: 'p2', savedAt: 0 },
    ]);
  });

  it('round-trips through storage', () => {
    const s = memory();
    const list = toggleWishlist([], { id: 'p1', name: 'Teddy' }, 10).next;
    expect(saveWishlist(s, list)).toBe(true);
    expect(loadWishlist(s)).toEqual(list);
  });

  it('reports a failed write, and treats no storage (native) as in-memory success', () => {
    const blocked: WishlistStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(saveWishlist(blocked, [{ id: 'p1', savedAt: 1 }])).toBe(false);
    expect(saveWishlist(null, [{ id: 'p1', savedAt: 1 }])).toBe(true);
  });
});

describe('resolveWishlist', () => {
  it('marks saved products available, unavailable (sold out) or missing (no longer listed)', () => {
    const entries: WishlistEntry[] = [
      { id: 'live', savedAt: 3, name: 'Old name' },
      { id: 'soldout', savedAt: 2 },
      { id: 'gone', savedAt: 1, name: 'Retired kite' },
      { id: 'nameless', savedAt: 0 },
    ];
    const rows = resolveWishlist(entries, [product('live', 4), product('soldout', 0)]);
    expect(rows.map((r) => [r.id, r.status, r.name])).toEqual([
      ['live', 'available', 'Product live'], // fresh name wins over the saved one
      ['soldout', 'unavailable', 'Product soldout'],
      ['gone', 'missing', 'Retired kite'],
      ['nameless', 'missing', ''],
    ]);
    expect(rows[0].product?.price).toBe(499); // price always from fresh data
    expect(rows[2].product).toBeUndefined();
  });
});

describe('reelRail (five buttons fit on every reel height)', () => {
  // Overlay space the rail can use: reel height minus the top band and bottom padding.
  const fits = (h: number) => {
    const r = reelRail(h);
    const per = r.size + (r.labels ? 18 : 0);
    return RAIL_BUTTONS * per + (RAIL_BUTTONS - 1) * r.gap <= h - 160;
  };

  it('fits from short landscape phones to tall screens', () => {
    for (const h of [360, 400, 459, 460, 500, 511, 512, 568, 640, 679, 680, 844, 1000]) {
      expect(fits(h), `height ${h}`).toBe(true);
    }
  });

  it('keeps captions where there is room, and drops them first when there is not', () => {
    expect(reelRail(844)).toEqual({ size: 46, gap: 20, labels: true });
    expect(reelRail(568).labels).toBe(true); // iPhone SE
    expect(reelRail(480).labels).toBe(false);
    expect(reelRail(360)).toEqual({ size: 36, gap: 4, labels: false });
  });
});

describe('wishlist strings', () => {
  it('exist in English and Telugu', () => {
    const keys = Object.keys(en.wishlist) as (keyof typeof en.wishlist)[];
    for (const k of keys) {
      expect(te.wishlist[k], k).toBeTruthy();
      expect(te.wishlist[k], k).not.toBe(en.wishlist[k]);
    }
    expect(te.header.wishlist).toBeTruthy();
    expect(te.header.openWishlist_one).toContain('{count}');
    expect(te.wishlist.save).toContain('{name}');
    expect(te.wishlist.remove).toContain('{name}');
  });
});
