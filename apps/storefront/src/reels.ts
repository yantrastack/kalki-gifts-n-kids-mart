/*
 * Pure Discover / cart helpers (no React Native imports), unit-tested from apps/stockwell
 * (see reels.test.ts). YAN-110.
 */

/** Liked set after one tap on a product's heart, and whether it is now liked. */
export function toggleLiked(liked: ReadonlySet<string>, id: string) {
  const next = new Set(liked);
  const on = !next.has(id);
  if (on) next.add(id);
  else next.delete(id);
  return { next, on };
}

/** Cart quantity after one "Add to cart": +1, but never more than the stock. */
export function addCapped(qty: number, inStock: number): number {
  return Math.min(qty + 1, Math.max(inStock, 0));
}

/** Search param that holds a shared product's id, e.g. `/?product=p12`. */
export const PRODUCT_PARAM = 'product';

/** Shareable link that opens one product: the storefront page plus `?product=<id>`. */
export function productLink(origin: string, pathname: string, id: string): string {
  return `${origin}${pathname || '/'}?${PRODUCT_PARAM}=${encodeURIComponent(id)}`;
}

/** Product id from a URL search string (`?product=p12`), or null. */
export function productIdFromSearch(search: string): string | null {
  const id = new URLSearchParams(search).get(PRODUCT_PARAM)?.trim();
  return id ? id : null;
}

/** Reel step for a key press: +1 next, -1 previous, 0 for any other key. */
export function reelStepForKey(key: string): -1 | 0 | 1 {
  if (key === 'ArrowDown' || key === 'PageDown' || key === ' ') return 1;
  if (key === 'ArrowUp' || key === 'PageUp') return -1;
  return 0;
}

/**
 * Mouse wheel / trackpad paging: one reel per gesture. A trackpad flick sends a long
 * stream of wheel events with inertia, so after a step the gate stays shut until the
 * stream has been quiet for `quietMs` (and at least `minGapMs` has passed).
 */
export type WheelGate = { lockedAt: number; lastAt: number };
export const WHEEL_OPEN: WheelGate = { lockedAt: -Infinity, lastAt: -Infinity };

export function wheelStep(
  gate: WheelGate,
  dx: number,
  dy: number,
  now: number,
  { quietMs = 220, minGapMs = 450, threshold = 8 } = {},
): { step: -1 | 0 | 1; gate: WheelGate; handled: boolean } {
  // Mostly sideways: leave it to the photo gallery.
  if (Math.abs(dx) > Math.abs(dy)) return { step: 0, gate, handled: false };
  const locked = now - gate.lastAt < quietMs || now - gate.lockedAt < minGapMs;
  if (locked || Math.abs(dy) < threshold) {
    return { step: 0, gate: { ...gate, lastAt: now }, handled: true };
  }
  return { step: dy > 0 ? 1 : -1, gate: { lockedAt: now, lastAt: now }, handled: true };
}

/** Index of the reel to show after stepping `delta`, clamped to the loaded reels. */
export function clampReel(index: number, delta: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, index + delta));
}

/**
 * How much room the reel overlay gets for a reel `height` px tall, so the action rail,
 * the info panel and the top bar never overlap on short screens.
 */
export function reelDensity(height: number): 'roomy' | 'compact' | 'tight' {
  if (height >= 680) return 'roomy';
  if (height >= 460) return 'compact';
  return 'tight';
}

/** Buttons on the reel action rail: like, share, save, buy, details. */
export const RAIL_BUTTONS = 5;
/** Caption under a rail button (gap 4 + one 14px line). */
const RAIL_CAPTION = 18;
/** Rail space above the reel bottom that the overlay keeps (top band + padding). */
const RAIL_RESERVED = 160;

/**
 * Size, spacing and captions of the reel action rail for a reel `height` px tall, so all
 * RAIL_BUTTONS fit beside the info panel without being clipped. Captions are dropped
 * first, then the buttons shrink (they keep a 6px hit slop, so taps stay ≥ 44px).
 */
export function reelRail(height: number): { size: number; gap: number; labels: boolean } {
  const density = reelDensity(height);
  if (density === 'tight') return { size: 36, gap: 4, labels: false };
  if (density === 'roomy') return { size: 46, gap: 20, labels: true };
  const gap = 8;
  const withLabels = RAIL_BUTTONS * (46 + RAIL_CAPTION) + (RAIL_BUTTONS - 1) * gap;
  return { size: 46, gap, labels: height - RAIL_RESERVED >= withLabels };
}

/**
 * Opacity at evenly spaced stops of a scrim, from `max` at the edge fading to 0, eased
 * (quadratic) so the fade has no visible line where it ends.
 */
export function scrimSteps(steps: number, max: number): number[] {
  return Array.from({ length: steps }, (_, i) => {
    const x = 1 - i / steps; // 1 at the edge → 0 at the far end
    return Math.round(max * x * x * 1000) / 1000;
  });
}

/**
 * The reel's edge scrims (YAN-118): light, short gradients that fade to clear, so the photo
 * or video shows edge to edge with no dark band. Overlay text gets its legibility from text
 * shadows and pills instead (`textOnMedia` in ReelsScreen), not from darkening the media.
 */
export const REEL_SCRIMS = {
  top: { height: 100, max: 0.25 },
  bottom: { height: 220, max: 0.35 },
} as const;

/**
 * CSS `linear-gradient` for a scrim: black at `max` opacity on the `edge` side, fading
 * smoothly to clear. One continuous gradient (web `backgroundImage`, native
 * `experimental_backgroundImage`), not stacked flat bands, so no band edges show.
 */
export function scrimGradient(edge: 'top' | 'bottom', max: number, stops = 8): string {
  const alphas = scrimSteps(stops, max);
  const parts = alphas.map((a, i) => `rgba(0,0,0,${a}) ${Math.round((i / stops) * 100)}%`);
  parts.push('rgba(0,0,0,0) 100%');
  return `linear-gradient(${edge === 'top' ? 'to bottom' : 'to top'}, ${parts.join(', ')})`;
}

/** i18n dictionary key for a category name: "Home Decor" → "home-decor". */
export function categoryKey(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
