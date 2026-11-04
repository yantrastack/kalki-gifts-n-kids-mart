/**
 * Wishlist helpers (YAN-111). Pure functions with no React Native imports, so they are
 * unit-tested from stockwell's vitest (`apps/stockwell/src/lib/wishlist.test.ts`).
 *
 * The shop has no customer accounts, so the wishlist lives on the device: an ordered list
 * of product ids in `localStorage['sf-wishlist']` (web; in memory on native, like
 * `sf-liked`). Price and stock are never stored: the Wishlist screen looks the ids up
 * again, so they are always current. The product name is kept only as a label for a
 * saved product the shop no longer lists, so it can still be named and removed.
 */
import { WISHLIST_MAX, type ShopProduct } from '@stockwell/shared';

export const WISHLIST_KEY = 'sf-wishlist';
export { WISHLIST_MAX };

export type WishlistEntry = { id: string; savedAt: number; name?: string };

/** Minimal storage shape (`localStorage` on web). */
export type WishlistStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const MAX_ID = 64;
const MAX_NAME = 200;

/**
 * Stored JSON → entries, newest first. Anything unreadable (bad JSON, wrong shape,
 * junk items) is dropped rather than thrown, so a corrupt value means an empty list.
 * A plain array of id strings is accepted too. Duplicates keep the first entry.
 */
export function parseWishlist(raw: string | null | undefined): WishlistEntry[] {
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(data)) return [];
  const seen = new Set<string>();
  const out: WishlistEntry[] = [];
  for (const item of data) {
    const e: any = typeof item === 'string' ? { id: item } : item;
    const id = typeof e?.id === 'string' ? e.id.trim() : '';
    if (!id || id.length > MAX_ID || seen.has(id)) continue;
    seen.add(id);
    const savedAt = Number.isFinite(e.savedAt) ? Number(e.savedAt) : 0;
    const name = typeof e.name === 'string' ? e.name.slice(0, MAX_NAME) : undefined;
    out.push(name ? { id, savedAt, name } : { id, savedAt });
    if (out.length >= WISHLIST_MAX) break;
  }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

/** Saved entries from storage; empty when there is no storage or it cannot be read. */
export function loadWishlist(storage: WishlistStorage | null | undefined): WishlistEntry[] {
  try {
    return parseWishlist(storage?.getItem(WISHLIST_KEY));
  } catch {
    return [];
  }
}

/**
 * Writes the entries. Returns false only when the write failed (storage full or
 * blocked); no storage at all (native) counts as success, the list is kept in memory.
 */
export function saveWishlist(
  storage: WishlistStorage | null | undefined,
  entries: readonly WishlistEntry[],
): boolean {
  if (!storage) return true;
  try {
    storage.setItem(WISHLIST_KEY, JSON.stringify(entries));
    return true;
  } catch {
    return false;
  }
}

export const isSaved = (entries: readonly WishlistEntry[], id: string) =>
  entries.some((e) => e.id === id);

/**
 * List after one tap on a product's heart / bookmark, and whether it is now saved.
 * `full` is true when the tap tried to save into a list that already holds WISHLIST_MAX
 * products (the list is then unchanged).
 */
export function toggleWishlist(
  entries: readonly WishlistEntry[],
  product: { id: string; name?: string },
  now: number,
): { next: WishlistEntry[]; on: boolean; full: boolean } {
  if (isSaved(entries, product.id)) {
    return { next: entries.filter((e) => e.id !== product.id), on: false, full: false };
  }
  if (entries.length >= WISHLIST_MAX) return { next: [...entries], on: false, full: true };
  const entry: WishlistEntry = { id: product.id, savedAt: now };
  if (product.name) entry.name = product.name.slice(0, MAX_NAME);
  return { next: [entry, ...entries], on: true, full: false };
}

export function removeFromWishlist(entries: readonly WishlistEntry[], id: string): WishlistEntry[] {
  return entries.filter((e) => e.id !== id);
}

/** How a saved product shows on the Wishlist screen. */
export type WishlistStatus = 'available' | 'unavailable' | 'missing';

export type WishlistRow = {
  id: string;
  savedAt: number;
  /** Fresh product data; undefined when the shop no longer lists it. */
  product?: ShopProduct;
  /** Fresh name, else the name saved with the entry, else ''. */
  name: string;
  status: WishlistStatus;
};

/**
 * Saved entries joined with fresh product data (from `GET /api/shop/products?ids=`).
 * In stock → available; listed but out of stock → unavailable; not returned (draft,
 * discontinued, deleted, unknown) → missing. Order follows the entries (newest first).
 */
export function resolveWishlist(
  entries: readonly WishlistEntry[],
  products: readonly ShopProduct[],
): WishlistRow[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  return entries.map((e) => {
    const product = byId.get(e.id);
    const status: WishlistStatus = !product
      ? 'missing'
      : product.inStock > 0
        ? 'available'
        : 'unavailable';
    return { id: e.id, savedAt: e.savedAt, product, name: product?.name ?? e.name ?? '', status };
  });
}
