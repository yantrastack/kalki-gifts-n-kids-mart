import { SEED_MEDIA, seedMediaRows } from '../db/seedMedia';

/**
 * Product-media audit (YAN-112). Pure: the caller loads the rows and the list of seed files,
 * so the same logic runs against local.db, production Turso and the unit tests.
 *
 * Why it exists: `product_media` rows are written only by `db:seed` and admin uploads. A
 * database seeded before YAN-101 still points at seed files that were deleted
 * (`/seed/p1-a.jpg`, …), which 404 and show the placeholder. The repair plan deletes only
 * those dead seed rows and adds the current seed photos to seed products left without any
 * media. It never touches `products`, uploads, or remote (Cloudinary) URLs.
 */

export type AuditProduct = { id: string; name: string; stock: number; lifecycle: string };
export type AuditMedia = {
  id: string;
  productId: string;
  url: string;
  type: string;
  sortOrder: number;
};
export type MediaRow = ReturnType<typeof seedMediaRows>[number];

export type MediaAudit = {
  /** Rows whose product no longer exists (the FK cascade should prevent these). */
  orphans: AuditMedia[];
  /** `/seed/<file>` rows whose file is not in public/seed. */
  deadSeed: AuditMedia[];
  /** Products the storefront shows (active, in stock) with no working media today. */
  visibleWithoutMedia: AuditProduct[];
  /** The same, once the repair plan is applied: these need a photo or a MEDIA.md exception. */
  stillWithoutMedia: AuditProduct[];
  /** Rows to delete: orphans + dead seed rows. */
  toDelete: AuditMedia[];
  /** Current seed photos for seed products that would otherwise be left without media. */
  toInsert: MediaRow[];
};

const SEED_PREFIX = '/seed/';

/** The seed file a `/seed/<file>` URL points at, or null for any other URL. */
export function seedFileOf(url: string): string | null {
  if (!url.startsWith(SEED_PREFIX)) return null;
  const file = decodeURIComponent(url.slice(SEED_PREFIX.length).split(/[?#]/)[0]);
  return file && !file.includes('/') ? file : null;
}

/** Same rule as GET /api/shop/products: active and in stock. */
export const isVisible = (p: AuditProduct) => p.lifecycle === 'active' && p.stock > 0;

export function auditMedia(
  products: AuditProduct[],
  media: AuditMedia[],
  seedFiles: Iterable<string>,
): MediaAudit {
  const files = new Set(seedFiles);
  const productIds = new Set(products.map((p) => p.id));

  const orphans = media.filter((m) => !productIds.has(m.productId));
  const deadSeed = media.filter((m) => {
    const file = seedFileOf(m.url);
    return file !== null && !files.has(file) && productIds.has(m.productId);
  });
  const toDelete = [...orphans, ...deadSeed];
  const deleted = new Set(toDelete.map((m) => m.id));

  // Media each product keeps once the dead rows are gone.
  const kept = new Map<string, number>();
  for (const m of media) {
    if (!deleted.has(m.id)) kept.set(m.productId, (kept.get(m.productId) ?? 0) + 1);
  }

  // Only fill products that end up empty: a product with any live media (e.g. an admin
  // upload) keeps its own gallery and cover untouched. Seed rows reuse stable IDs, so a
  // second run inserts nothing.
  const liveIds = new Set(media.filter((m) => !deleted.has(m.id)).map((m) => m.id));
  const emptySeedProducts = Object.keys(SEED_MEDIA).filter(
    (id) => productIds.has(id) && !kept.get(id),
  );
  const toInsert = seedMediaRows(emptySeedProducts).filter(
    (r) => files.has(seedFileOf(r.url) ?? '') && !liveIds.has(r.id),
  );

  const filled = new Set(toInsert.map((r) => r.productId));
  const visible = products.filter(isVisible);
  const visibleWithoutMedia = visible.filter((p) => !kept.get(p.id));
  const stillWithoutMedia = visibleWithoutMedia.filter((p) => !filled.has(p.id));

  return { orphans, deadSeed, visibleWithoutMedia, stillWithoutMedia, toDelete, toInsert };
}
