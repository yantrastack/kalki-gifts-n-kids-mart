import { Platform } from 'react-native';
import {
  DEFAULT_BRAND,
  type FeedResponse,
  type GiftMatch,
  type GiftQuery,
  type ProductEventType,
  type ShopBrand,
  type ShopProduct,
} from '@stockwell/shared';

/**
 * Where the backend lives. Set `EXPO_PUBLIC_API_BASE` at build/run time:
 *  - unset (dev)            → localhost:3050 (or 10.0.2.2 on Android emulator)
 *  - "" (empty)             → same-origin, i.e. relative `/api/...` — used when the
 *                             web build is embedded in the Next app (served at `/`)
 *  - "https://admin…"       → a standalone deploy pointing at a separate backend
 *  - physical phone (Expo Go): your computer's LAN IP, e.g. http://192.168.1.20:3050
 */
const FALLBACK = Platform.select({
  android: 'http://10.0.2.2:3050',
  default: 'http://localhost:3050',
})!;
const RAW = process.env.EXPO_PUBLIC_API_BASE;
// Note: `== null` (not `||`) so an intentional empty string means same-origin.
export const API_BASE = RAW == null ? FALLBACK : RAW;

export type Product = ShopProduct;
export type Brand = ShopBrand;

/** Media URLs from the API are relative (e.g. /uploads/x.jpg) — make them absolute. */
export const mediaUrl = (url: string) => (url.startsWith('http') ? url : API_BASE + url);

export async function getBrand(): Promise<Brand> {
  try {
    const r = await fetch(`${API_BASE}/api/brand`);
    return { ...DEFAULT_BRAND, ...(await r.json()) };
  } catch {
    return DEFAULT_BRAND;
  }
}

export async function getProducts(): Promise<Product[]> {
  const r = await fetch(`${API_BASE}/api/shop/products`);
  if (!r.ok) throw new Error('Failed to load products');
  return r.json();
}

export async function findGifts(query: GiftQuery): Promise<GiftMatch[]> {
  const params = new URLSearchParams();
  if (query.occasion) params.set('occasion', query.occasion);
  if (query.recipient) params.set('recipient', query.recipient);
  if (query.age !== undefined) params.set('age', String(query.age));
  if (query.types?.length) params.set('types', query.types.join(','));
  if (query.likes) params.set('likes', query.likes);
  if (query.minPrice !== undefined) params.set('minPrice', String(query.minPrice));
  if (query.maxPrice !== undefined) params.set('maxPrice', String(query.maxPrice));
  const r = await fetch(`${API_BASE}/api/shop/gift-finder?${params}`);
  if (!r.ok) throw new Error('Gift search failed');
  return r.json();
}

/* ------------------------------------------------------- discover feed + events */

/** Anonymous per-device id, so engagement can measure reach without accounts. */
let _sessionId: string | null = null;
export function sessionId(): string {
  if (_sessionId) return _sessionId;
  try {
    const ls = (globalThis as any)?.localStorage;
    let v = ls?.getItem('sf-session');
    if (!v) {
      v = `sf-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      ls?.setItem('sf-session', v);
    }
    _sessionId = v;
  } catch {
    _sessionId = `sf-${Math.random().toString(36).slice(2, 10)}`;
  }
  return _sessionId!;
}

export async function getFeed(cursor?: string | null, category?: string): Promise<FeedResponse> {
  const params = new URLSearchParams({ limit: '5' });
  if (cursor) params.set('cursor', cursor);
  if (category && category !== 'All') params.set('category', category);
  const r = await fetch(`${API_BASE}/api/shop/feed?${params}`);
  if (!r.ok) throw new Error('Failed to load feed');
  return r.json();
}

/** Fire-and-forget engagement event (never throws — analytics must not break UX). */
export function recordEvent(productId: string, type: ProductEventType): void {
  fetch(`${API_BASE}/api/shop/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, type, sessionId: sessionId() }),
    keepalive: true,
  }).catch(() => {});
}
