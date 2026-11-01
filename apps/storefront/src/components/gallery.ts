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

/** The photo a card reveals on hover: the second image, if the product has one. */
export function hoverImage<T extends { type: string }>(media: T[]): T | undefined {
  return media.filter((m) => m.type === 'image')[1];
}
