import { asc } from 'drizzle-orm';
import { db, schema } from '@/db/client';

// Media per product for the admin, in media order (first photo = cover). The admin list/detail
// APIs attach these so every page can show a product's photo, and the Products grid can show
// its videos too.
export type PhotoMap = Map<string, string[]>;
export type GalleryItem = { type: 'image' | 'video'; url: string; poster: string | null };

async function loadMedia() {
  const rows = await db
    .select({
      productId: schema.productMedia.productId,
      url: schema.productMedia.url,
      type: schema.productMedia.type,
      poster: schema.productMedia.posterUrl,
    })
    .from(schema.productMedia)
    .orderBy(asc(schema.productMedia.sortOrder));
  const photos: PhotoMap = new Map();
  const gallery = new Map<string, GalleryItem[]>();
  for (const r of rows) {
    const type = r.type === 'video' ? 'video' : 'image';
    const items = gallery.get(r.productId) ?? [];
    items.push({ type, url: r.url, poster: r.poster ?? null });
    gallery.set(r.productId, items);
    if (type === 'image') {
      const list = photos.get(r.productId) ?? [];
      list.push(r.url);
      photos.set(r.productId, list);
    }
  }
  return { photos, gallery };
}

/** Photo URLs per product, in media order (the first one is the cover). Videos are skipped. */
export async function loadPhotos(): Promise<PhotoMap> {
  return (await loadMedia()).photos;
}

/** Photos and videos per product, in media order (what the Products grid carousel plays). */
export async function loadGallery(): Promise<{
  photos: PhotoMap;
  gallery: Map<string, GalleryItem[]>;
}> {
  return loadMedia();
}

/** The product's cover photo URL, or null when it has no photos (callers show the placeholder). */
export const coverOf = (photos: PhotoMap, productId: string | null | undefined): string | null =>
  (productId && photos.get(productId)?.[0]) || null;

/** Add `cover` to rows that carry a product id (`idKey`, default `productId`). */
export async function withCover<T extends Record<string, any>>(
  rows: T[],
  idKey: keyof T = 'productId',
): Promise<(T & { cover: string | null })[]> {
  const photos = await loadPhotos();
  return rows.map((r) => ({ ...r, cover: coverOf(photos, r[idKey] as string | null) }));
}
