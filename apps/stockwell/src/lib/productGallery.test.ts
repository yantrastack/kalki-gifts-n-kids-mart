import { describe, expect, it } from 'vitest';
import {
  hoverImage,
  pageAt,
  sizedImageUrl,
  stepIndex,
} from '../../../storefront/src/components/gallery';
import { en } from '../../../storefront/src/i18n/en';
import { te } from '../../../storefront/src/i18n/te';

// YAN-101: storefront product gallery (thumbnails, arrows, swipe, card hover photo).

describe('stepIndex (gallery arrows and ← / → keys)', () => {
  it('moves one photo and wraps at both ends', () => {
    expect(stepIndex(0, 1, 3)).toBe(1);
    expect(stepIndex(2, 1, 3)).toBe(0);
    expect(stepIndex(0, -1, 3)).toBe(2);
  });

  it('stays at 0 for a single photo or an empty gallery', () => {
    expect(stepIndex(0, 1, 1)).toBe(0);
    expect(stepIndex(0, -1, 0)).toBe(0);
  });
});

describe('pageAt (swipe position → selected thumbnail)', () => {
  it('rounds to the nearest page', () => {
    expect(pageAt(0, 400, 3)).toBe(0);
    expect(pageAt(210, 400, 3)).toBe(1);
    expect(pageAt(800, 400, 3)).toBe(2);
  });

  it('clamps overscroll and bad widths', () => {
    expect(pageAt(-50, 400, 3)).toBe(0);
    expect(pageAt(5000, 400, 3)).toBe(2);
    expect(pageAt(100, 0, 3)).toBe(0);
  });
});

describe('hoverImage (card photo shown on desktop hover)', () => {
  const img = (id: string) => ({ id, type: 'image' });
  const vid = (id: string) => ({ id, type: 'video' });

  it('is the second photo, skipping videos', () => {
    expect(hoverImage([img('a'), vid('v'), img('b')])?.id).toBe('b');
  });

  it('is nothing when there is only one photo', () => {
    expect(hoverImage([img('a')])).toBeUndefined();
    expect(hoverImage([img('a'), vid('v')])).toBeUndefined();
    expect(hoverImage([])).toBeUndefined();
  });
});

describe('gallery strings', () => {
  it('announce the position in both languages', () => {
    for (const d of [en, te]) {
      expect(d.product.imagePosition).toContain('{n}');
      expect(d.product.imagePosition).toContain('{total}');
      expect(d.product.goToImage).toContain('{n}');
      expect(d.product.goToImage).toContain('{total}');
    }
  });
});

// YAN-109: sharp but light photos — Cloudinary serves a right-sized, auto-format copy.
describe('sizedImageUrl', () => {
  const cdn = 'https://res.cloudinary.com/demo/image/upload/v1712/stockwell/p1.jpg';

  it('adds f_auto,q_auto and a width rounded up to a 200 px step', () => {
    expect(sizedImageUrl(cdn, 390, 2)).toBe(
      'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_800/v1712/stockwell/p1.jpg',
    );
    expect(sizedImageUrl(cdn, 480)).toContain(',w_600/');
  });

  it('caps the width at 2000 px', () => {
    expect(sizedImageUrl(cdn, 1600, 3)).toContain(',w_2000/');
  });

  it('leaves local, seed and already-transformed URLs alone', () => {
    expect(sizedImageUrl('http://localhost:3050/uploads/p1.jpg', 400)).toBe(
      'http://localhost:3050/uploads/p1.jpg',
    );
    const done = 'https://res.cloudinary.com/demo/image/upload/w_300/v1/p1.jpg';
    expect(sizedImageUrl(done, 400)).toBe(done);
  });
});
