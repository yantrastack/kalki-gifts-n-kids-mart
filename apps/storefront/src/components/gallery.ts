/*
 * Pure gallery helpers (no React Native imports), shared by the product gallery and the
 * product card, and unit-tested from apps/stockwell (see productGallery.test.ts).
 */

/** Next index when stepping through `count` items; wraps at both ends. */
export function stepIndex(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return (((index + delta) % count) + count) % count;
}

/** Page shown by a horizontal pager scrolled to `offset`, clamped to the item range. */
export function pageAt(offset: number, pageWidth: number, count: number): number {
  if (count <= 0 || pageWidth <= 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(offset / pageWidth)));
}

/**
 * A photo URL sized for a `cssWidth`-wide frame. Cloudinary photos get a delivery
 * transformation (`f_auto,q_auto,w_…`: best format, automatic quality, width rounded up to
 * a 200 px step for cache hits, capped at 2000) so they stay sharp without being heavy.
 * Other URLs (local uploads, seed photos) are returned unchanged, and so is a Cloudinary
 * URL that already has a transformation.
 */
export function sizedImageUrl(url: string, cssWidth: number, pixelRatio = 1): string {
  const m = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
  if (!m || /^[a-z]{1,3}_[^/]*\//.test(m[2])) return url;
  const px = Math.min(2000, Math.ceil((cssWidth * Math.max(1, pixelRatio)) / 200) * 200);
  return `${m[1]}f_auto,q_auto,w_${px}/${m[2]}`;
}

/** The photo a card reveals on hover: the second image, if the product has one. */
export function hoverImage<T extends { type: string }>(media: T[]): T | undefined {
  return media.filter((m) => m.type === 'image')[1];
}
