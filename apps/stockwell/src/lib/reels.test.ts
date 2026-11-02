import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  addCapped,
  categoryKey,
  clampReel,
  productIdFromSearch,
  productLink,
  reelDensity,
  reelStepForKey,
  scrimGradient,
  scrimSteps,
  toggleLiked,
  WHEEL_OPEN,
  wheelStep,
} from '../../../storefront/src/reels';
import { en } from '../../../storefront/src/i18n/en';
import { te } from '../../../storefront/src/i18n/te';

// YAN-110: Discover/Reels layout, paging and interactions.

const storefront = path.join(__dirname, '../../../storefront');
const read = (f: string) => readFileSync(path.join(storefront, f), 'utf8');

describe('toggleLiked (one tap = one change)', () => {
  it('likes, then unlikes, without touching the input set', () => {
    const start = new Set(['x']);
    const a = toggleLiked(start, 'p1');
    expect(a.on).toBe(true);
    expect([...a.next].sort()).toEqual(['p1', 'x']);
    const b = toggleLiked(a.next, 'p1');
    expect(b.on).toBe(false);
    expect([...b.next]).toEqual(['x']);
    expect([...start]).toEqual(['x']);
  });

  it('runs its side effects outside the state updater (StrictMode double-calls updaters)', () => {
    const src = read('src/screens/ReelsScreen.tsx');
    const body = src.slice(src.indexOf('const toggleLike'), src.indexOf('const share ='));
    expect(body).not.toMatch(/setLiked\(\(/);
    expect(body).toMatch(/recordEvent\(p\.id, on \? 'like' : 'unlike'\)/);
  });
});

describe('addCapped (Add to cart never exceeds stock)', () => {
  it('adds one up to the stock, then stops', () => {
    expect(addCapped(0, 3)).toBe(1);
    expect(addCapped(2, 3)).toBe(3);
    expect(addCapped(3, 3)).toBe(3);
  });

  it('treats no / negative stock as nothing to add', () => {
    expect(addCapped(0, 0)).toBe(0);
    expect(addCapped(0, -2)).toBe(0);
  });

  it('is used by the cart add and the cart + button', () => {
    const app = read('App.tsx');
    expect(app.match(/addCapped\(/g)?.length).toBeGreaterThanOrEqual(3);
  });
});

describe('product links (share opens the same product)', () => {
  it('builds a link to the product and reads it back', () => {
    const url = productLink('https://shop.example', '/', 'p 12');
    expect(url).toBe('https://shop.example/?product=p%2012');
    expect(productIdFromSearch(new URL(url).search)).toBe('p 12');
  });

  it('ignores missing or blank ids', () => {
    expect(productIdFromSearch('')).toBeNull();
    expect(productIdFromSearch('?product=')).toBeNull();
    expect(productIdFromSearch('?other=1')).toBeNull();
  });

  it('shares the product link, not the current page', () => {
    const app = read('App.tsx');
    expect(app).not.toMatch(/const url = g\?\.location\?\.href/);
    expect(app).toMatch(/productLink\(loc\.origin, loc\.pathname, p\.id\)/);
  });
});

describe('reelStepForKey (keyboard paging)', () => {
  it('maps ↓ / PageDown / Space to next and ↑ / PageUp to previous', () => {
    expect(reelStepForKey('ArrowDown')).toBe(1);
    expect(reelStepForKey('PageDown')).toBe(1);
    expect(reelStepForKey(' ')).toBe(1);
    expect(reelStepForKey('ArrowUp')).toBe(-1);
    expect(reelStepForKey('PageUp')).toBe(-1);
    expect(reelStepForKey('ArrowLeft')).toBe(0);
    expect(reelStepForKey('Enter')).toBe(0);
  });
});

describe('wheelStep (one reel per wheel / trackpad gesture)', () => {
  it('steps once for a flick and swallows its inertia tail', () => {
    let gate = WHEEL_OPEN;
    const steps: number[] = [];
    // A trackpad flick: 40 events, 16ms apart, decaying deltas.
    for (let i = 0; i < 40; i++) {
      const r = wheelStep(gate, 0, 120 - i * 3, 1000 + i * 16);
      gate = r.gate;
      if (r.step) steps.push(r.step);
    }
    expect(steps).toEqual([1]);
  });

  it('steps again after the wheel goes quiet', () => {
    let r = wheelStep(WHEEL_OPEN, 0, 100, 1000);
    expect(r.step).toBe(1);
    r = wheelStep(r.gate, 0, -100, 2000);
    expect(r.step).toBe(-1);
  });

  it('leaves sideways swipes to the photo gallery', () => {
    const r = wheelStep(WHEEL_OPEN, 80, 10, 1000);
    expect(r).toMatchObject({ step: 0, handled: false });
  });

  it('ignores tiny jitter', () => {
    expect(wheelStep(WHEEL_OPEN, 0, 3, 1000).step).toBe(0);
  });
});

describe('clampReel', () => {
  it('stays within the loaded reels', () => {
    expect(clampReel(0, -1, 5)).toBe(0);
    expect(clampReel(4, 1, 5)).toBe(4);
    expect(clampReel(2, 1, 5)).toBe(3);
    expect(clampReel(0, 1, 0)).toBe(0);
  });
});

describe('reelDensity (no overlaps on short screens)', () => {
  it('compacts the overlay as the reel gets shorter', () => {
    expect(reelDensity(844)).toBe('roomy');
    expect(reelDensity(568)).toBe('compact');
    expect(reelDensity(360)).toBe('tight'); // landscape phone
  });
});

describe('scrimSteps (gradient, not a hard-edged band)', () => {
  it('fades from the max at the edge towards clear in small steps', () => {
    const s = scrimSteps(16, 0.75);
    expect(s[0]).toBe(0.75);
    for (let i = 1; i < s.length; i++) {
      expect(s[i]).toBeLessThan(s[i - 1]);
      expect(s[i - 1] - s[i]).toBeLessThan(0.1);
    }
    expect(s[s.length - 1]).toBeLessThan(0.01);
  });

  it('replaces the flat scrims in the reel', () => {
    const src = read('src/screens/ReelsScreen.tsx');
    expect(src).not.toMatch(/height: 360,\s*backgroundColor: 'rgba\(0,0,0,0\.45\)'/);
    expect(src).toMatch(/<Scrim edge="top"/);
    expect(src).toMatch(/<Scrim edge="bottom"/);
  });

  it('draws each scrim as one smooth gradient, not stacked flat bands (they showed as stripes)', () => {
    const src = read('src/screens/ReelsScreen.tsx');
    const scrim = src.slice(src.indexOf('function Scrim('), src.indexOf('function ReelVideo('));
    expect(scrim).toMatch(/backgroundImage: gradient/);
    expect(scrim).toMatch(/experimental_backgroundImage: gradient/);
    expect(scrim).not.toMatch(/\.map\(/);
  });
});

describe('scrimGradient', () => {
  it('is darkest at the edge and fully clear at the far end', () => {
    const top = scrimGradient('top', 0.6);
    expect(top).toMatch(/^linear-gradient\(to bottom, rgba\(0,0,0,0\.6\) 0%, /);
    expect(top).toMatch(/rgba\(0,0,0,0\) 100%\)$/);
    expect(scrimGradient('bottom', 0.6)).toMatch(/^linear-gradient\(to top, /);
  });
});

describe('category labels (chips are translated where possible)', () => {
  it('maps a category name to its dictionary key', () => {
    expect(categoryKey('Home Decor')).toBe('home-decor');
    expect(categoryKey(' Toys ')).toBe('toys');
  });

  it('has every seeded category in English and Telugu', () => {
    const seed = readFileSync(path.join(__dirname, '../db/seed.ts'), 'utf8');
    const cats = [...new Set([...seed.matchAll(/category: '([^']+)'/g)].map((m) => m[1]))];
    expect(cats.length).toBeGreaterThan(0);
    for (const c of cats) {
      expect(en.category).toHaveProperty([categoryKey(c)]);
      expect(te.category).toHaveProperty([categoryKey(c)]);
    }
  });

  it('labels the chips and the reel meta line through categoryLabel', () => {
    const src = read('src/screens/ReelsScreen.tsx');
    expect(src).toMatch(/categoryLabel\(c\)/);
    expect(src).toMatch(/categoryLabel\(product\.category\)/);
  });
});

describe('Discover wiring', () => {
  const reels = read('src/screens/ReelsScreen.tsx');
  const app = read('App.tsx');

  it('builds category chips from the feed, not a hardcoded list', () => {
    expect(reels).not.toMatch(/const CATEGORIES = \[/);
    expect(reels).toMatch(/setCategories\(res\.categories\)/);
  });

  it('gives Buy its own flow (add + go to cart) and records opens', () => {
    expect(app).toMatch(/const buyNow = /);
    expect(app).toMatch(/onBuy=\{buyNow\}/);
    expect(reels).toMatch(/recordEvent\(p\.id, 'open'\)/);
  });

  it('keeps Discover mounted under a product opened from it', () => {
    expect(app).toMatch(/\(inReels \|\| reelsOpen\) &&/);
    expect(app).not.toMatch(/if \(screen === 'reels'\) \{\s*return/);
  });

  it('wires the browser and Android back buttons', () => {
    expect(app).toMatch(/addEventListener\('popstate'/);
    expect(app).toMatch(/hardwareBackPress/);
  });

  it('labels the header back, Discover and cart buttons', () => {
    expect(app).toMatch(/accessibilityLabel=\{t\('header\.back'\)\}/);
    expect(app).toMatch(/accessibilityLabel=\{t\('header\.discover'\)\}/);
    expect(app).toMatch(/accessibilityLabel=\{t\('reels\.cart', \{ count \}\)\}/);
  });

  it('uses the dynamic viewport height on web', () => {
    expect(read('src/layout.tsx')).toMatch(/100dvh/);
  });
});

describe('reels strings', () => {
  it('has every Discover label in English and Telugu', () => {
    expect(Object.keys(te.reels).sort()).toEqual(Object.keys(en.reels).sort());
    for (const v of Object.values(te.reels)) expect(v).toBeTruthy();
  });
});
