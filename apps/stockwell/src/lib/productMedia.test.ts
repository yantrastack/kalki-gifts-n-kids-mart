import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PRODUCT_BADGES, productBadgeKey } from '@stockwell/shared';
import { describe, expect, it } from 'vitest';
import { en } from '../../../storefront/src/i18n/en';
import { te } from '../../../storefront/src/i18n/te';

// YAN-101: seed photos were unrelated, non-commercial, watermarked; badges were raw English.

describe('productBadgeKey', () => {
  it('turns typed or legacy labels into stored codes', () => {
    expect(productBadgeKey('Bestseller')).toBe('bestseller');
    expect(productBadgeKey('Kids favourite')).toBe('kids-favourite');
    expect(productBadgeKey('  Festive   pick ')).toBe('festive-pick');
    expect(productBadgeKey('kids-favourite')).toBe('kids-favourite');
  });

  it('treats empty values as no badge', () => {
    expect(productBadgeKey('')).toBeNull();
    expect(productBadgeKey('   ')).toBeNull();
    expect(productBadgeKey(null)).toBeNull();
    expect(productBadgeKey(undefined)).toBeNull();
  });
});

describe('badge translations', () => {
  it.each(PRODUCT_BADGES)('"%s" has an English and a Telugu label', (code) => {
    expect(en.badge[code]).toBeTruthy();
    expect(te.badge[code]).toBeTruthy();
    expect(te.badge[code]).not.toBe(en.badge[code]);
  });
});

describe('seed media licensing', () => {
  const root = process.cwd(); // apps/stockwell
  const files = readdirSync(path.join(root, 'public/seed')).filter((f) => !f.startsWith('.'));
  const mediaDoc = readFileSync(path.join(root, 'docs/MEDIA.md'), 'utf8');

  it('ships no seed file without a licence row in docs/MEDIA.md', () => {
    const unrecorded = files.filter((f) => !mediaDoc.includes(`| ${f} |`));
    expect(unrecorded).toEqual([]);
  });
});
