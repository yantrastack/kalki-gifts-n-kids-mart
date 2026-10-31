import { describe, expect, it } from 'vitest';
import type { GiftAttributes, ShopProduct } from '@stockwell/shared';
import {
  GiftQueryError,
  countGiftTypes,
  parseGiftCriteria,
  parseLikes,
  rankGifts,
  singular,
  words,
} from './giftScore';

const prod = (
  id: string,
  gift: Partial<GiftAttributes> = {},
  extra: Partial<ShopProduct> = {},
): ShopProduct => ({
  id,
  name: id,
  sku: id,
  price: 500,
  category: 'Gifts',
  brand: null,
  inStock: 5,
  tag: null,
  media: [],
  gift: {
    occasions: [],
    recipients: [],
    ageMin: null,
    ageMax: null,
    types: [],
    interests: [],
    ...gift,
  },
  ...extra,
});

/** A small catalog shaped like the seed data that exposed the bugs in YAN-97. */
const CATALOG: ShopProduct[] = [
  prod('teddy', {
    occasions: ['birthday'],
    recipients: ['kids', 'women'],
    ageMin: 0,
    ageMax: 12,
    types: ['toys'],
  }),
  prod(
    'jewelry-box',
    { occasions: ['birthday', 'wedding'], recipients: ['women'], ageMin: 16, types: ['jewelry'] },
    { price: 1800 },
  ),
  prod(
    'necklace',
    { occasions: ['valentines'], recipients: ['women'], ageMin: 14, types: ['jewelry'] },
    { price: 2200 },
  ),
  prod(
    'watch',
    { occasions: ['birthday', 'valentines'], recipients: ['men'], ageMin: 18, types: ['watch'] },
    { price: 2499 },
  ),
  prod(
    'candle',
    { occasions: ['housewarming', 'birthday'], recipients: ['anyone'], types: ['home-decor'] },
    { price: 349 },
  ),
  prod(
    'journal',
    {
      occasions: ['graduation'],
      recipients: ['anyone'],
      ageMin: 12,
      types: ['stationery'],
      interests: ['writing', 'book'],
    },
    { price: 650 },
  ),
  prod(
    'mug',
    { occasions: ['birthday'], types: ['mug'], interests: ['tea', 'tv'] },
    { price: 249 },
  ),
  prod('wallet', { recipients: ['men'], types: ['wallet'] }, { inStock: 0 }),
  prod('plain', {}, { price: 100 }), // not tagged for gifting at all
];

const crit = (qs: string) => parseGiftCriteria(new URLSearchParams(qs));
const rank = (qs: string, catalog = CATALOG) => rankGifts(catalog, crit(qs));
const ids = (list: { product: ShopProduct }[]) => list.map((m) => m.product.id);
const allIds = (r: ReturnType<typeof rank>) => [...ids(r.matches), ...ids(r.alternatives)];

describe('parseGiftCriteria', () => {
  it('ignores a non-numeric, negative, fractional or out-of-range age', () => {
    for (const age of ['abc', '-3', '8.5', '121', '', ' ']) {
      expect(crit(`age=${age}`).age).toBeNull();
    }
    expect(crit('age=0').age).toBe(0);
    expect(crit('age=120').age).toBe(120);
  });

  it('treats recipient "anyone" as no preference', () => {
    expect(crit('recipient=anyone').recipient).toBe('');
    expect(crit('recipient=Kids').recipient).toBe('kids');
  });

  it('ignores invalid prices and rejects min above max', () => {
    expect(crit('minPrice=-5&maxPrice=abc')).toMatchObject({ minPrice: null, maxPrice: null });
    expect(crit('minPrice=500&maxPrice=500')).toMatchObject({ minPrice: 500, maxPrice: 500 });
    expect(() => crit('minPrice=2000&maxPrice=500')).toThrow(GiftQueryError);
  });

  it('dedupes gift types', () => {
    expect(crit('types=toys,toys,mug').types).toEqual(['toys', 'mug']);
  });
});

describe('interest words', () => {
  it('keeps 2-letter words and non-Latin scripts', () => {
    expect(words('tv, art')).toEqual(['tv', 'art']);
    expect(words('పాటలు, ఆటలు')).toEqual(['పాటలు', 'ఆటలు']);
    expect(words('a set of mugs')).toEqual(['set', 'mugs']);
  });

  it('folds simple English plurals', () => {
    expect(singular('books')).toBe('book');
    expect(singular('watches')).toBe('watch');
    expect(singular('stories')).toBe('story');
    expect(singular('glass')).toBe('glass');
    expect(singular('tv')).toBe('tv');
  });

  it('dedupes words that fold to the same key', () => {
    expect(parseLikes('book books')).toEqual([{ raw: 'book', key: 'book' }]);
  });
});

describe('rankGifts — each answer alone', () => {
  it('no answers lists every in-stock gift-tagged product as an idea', () => {
    const r = rank('');
    expect(ids(r.matches).sort()).toEqual(
      ['candle', 'jewelry-box', 'journal', 'mug', 'necklace', 'teddy', 'watch'].sort(),
    );
    expect(r.matches.every((m) => m.reasons[0].code === 'idea')).toBe(true);
    expect(r.alternatives).toEqual([]);
  });

  it('occasion ranks occasion-tagged products first', () => {
    const r = rank('occasion=birthday');
    expect(ids(r.matches)).toEqual(['mug', 'candle', 'teddy', 'jewelry-box', 'watch']);
    expect(r.matches[0].reasons).toEqual([{ code: 'occasion', value: 'birthday' }]);
  });

  it('recipient = kids never returns products tagged only for men/women', () => {
    const r = rank('recipient=kids');
    for (const id of allIds(r)) expect(['jewelry-box', 'necklace', 'watch']).not.toContain(id);
    expect(ids(r.matches)[0]).toBe('teddy');
    expect(r.matches[0].reasons).toEqual([{ code: 'recipient-kids' }]);
  });

  it('recipient = anyone returns the same as no recipient', () => {
    expect(rank('recipient=anyone')).toEqual(rank(''));
    expect(rank('recipient=anyone&occasion=birthday')).toEqual(rank('occasion=birthday'));
  });

  it('age excludes products whose range leaves it out but keeps untagged ages', () => {
    const r = rank('age=8');
    const shown = allIds(r);
    for (const id of ['jewelry-box', 'necklace', 'watch', 'journal']) {
      expect(shown).not.toContain(id);
    }
    expect(ids(r.matches)).toEqual(['teddy']);
    expect(shown).toContain('candle'); // no age tags: still eligible
    expect(shown).toContain('mug');
  });

  it('a gift type limits matches to that type', () => {
    expect(ids(rank('types=toys').matches)).toEqual(['teddy']);
  });

  it('interests match tags, names and plurals', () => {
    expect(ids(rank('likes=books').matches)).toEqual(['journal']);
    expect(ids(rank('likes=tv').matches)).toEqual(['mug']);
    expect(rank('likes=tv').matches[0].reasons).toEqual([{ code: 'interests', value: 'tv' }]);
  });

  it('Telugu interest text counts as an answer instead of being dropped', () => {
    const r = rank('likes=పాటలు');
    expect(r.matches).toEqual([]);
    expect(r.alternatives.length).toBeGreaterThan(0);
    expect(r.relaxed).toEqual(['interests']);
    // Matches when a product carries the word.
    const catalog = [...CATALOG, prod('veena', { interests: ['పాటలు'] })];
    expect(ids(rank('likes=పాటలు', catalog).matches)).toEqual(['veena']);
  });
});

describe('rankGifts — combinations', () => {
  it('birthday + kids + age 8 shows no adult-only or 14+/16+ products', () => {
    const shown = allIds(rank('occasion=birthday&recipient=kids&age=8'));
    for (const id of ['jewelry-box', 'necklace', 'watch', 'journal']) {
      expect(shown).not.toContain(id);
    }
    expect(shown[0]).toBe('teddy');
  });

  it("valentine's + men shows neither the women's necklace nor the kids teddy", () => {
    const r = rank('occasion=valentines&recipient=men');
    expect(allIds(r)).not.toContain('necklace');
    expect(allIds(r)).not.toContain('teddy');
    expect(ids(r.matches)[0]).toBe('watch');
  });

  it('multiple gift types are OR, and matching two types earns no extra score', () => {
    const catalog = [
      prod('one', { types: ['toys'] }, { price: 300 }),
      prod('two', { types: ['toys', 'mug'] }, { price: 400 }),
      prod('none', { types: ['jewelry'] }),
    ];
    const r = rank('types=toys,mug', catalog);
    expect(ids(r.matches)).toEqual(['one', 'two']); // same score → cheaper first
    expect(r.matches[0].score).toBe(r.matches[1].score);
    expect(r.matches[1].reasons).toEqual([{ code: 'type', value: 'toys,mug' }]);
  });

  it('ties break on more reasons, then lower price, then newest', () => {
    const catalog = [
      prod('new', { occasions: ['birthday'] }, { price: 500 }),
      prod('old', { occasions: ['birthday'] }, { price: 500 }),
      prod('cheap', { occasions: ['birthday'] }, { price: 100 }),
    ];
    expect(ids(rank('occasion=birthday', catalog).matches)).toEqual(['cheap', 'new', 'old']);
  });
});

describe('rankGifts — budget and availability', () => {
  it('budget bounds are inclusive and hard', () => {
    expect(ids(rank('minPrice=2499&maxPrice=2499').matches)).toEqual(['watch']);
    expect(allIds(rank('occasion=birthday&maxPrice=400'))).toEqual(['mug', 'candle']);
  });

  it('out-of-stock products are never shown', () => {
    const r = rank('types=wallet&recipient=men');
    expect(allIds(r)).not.toContain('wallet');
  });

  it('handles an empty catalog and an all-out-of-stock catalog', () => {
    const empty = rank('occasion=birthday', []);
    expect(empty).toEqual({ matches: [], alternatives: [], relaxed: [], facets: { types: {} } });
    const soldOut = CATALOG.map((p) => ({ ...p, inStock: 0 }));
    const r = rank('occasion=birthday', soldOut);
    expect(r.matches).toEqual([]);
    expect(r.alternatives).toEqual([]);
    expect(r.facets.types).toEqual({});
  });
});

describe('rankGifts — relaxing', () => {
  it('suggests alternatives with the relaxed answers named when nothing matches', () => {
    const r = rank('types=electronics&recipient=kids');
    expect(r.matches).toEqual([]);
    expect(r.relaxed).toEqual(['types']);
    expect(ids(r.alternatives)[0]).toBe('teddy'); // still fits the kids answer
    // Recipient is a hard filter, so it is never relaxed.
    for (const id of ['jewelry-box', 'necklace', 'watch']) {
      expect(ids(r.alternatives)).not.toContain(id);
    }
  });

  it('only names answers the alternatives actually miss', () => {
    const r = rank('occasion=birthday&types=electronics');
    expect(r.matches).toEqual([]);
    // Birthday products come first and keep their occasion reason.
    expect(r.alternatives[0].reasons).toEqual([{ code: 'occasion', value: 'birthday' }]);
    expect(r.relaxed).toEqual(['types', 'occasion']); // e.g. the journal is not for birthdays
  });

  it('never relaxes age or budget', () => {
    const r = rank('types=electronics&age=8&maxPrice=400');
    for (const m of r.alternatives) {
      expect(m.product.price).toBeLessThanOrEqual(400);
      expect(['jewelry-box', 'necklace', 'watch', 'journal']).not.toContain(m.product.id);
    }
  });

  it('gives no alternatives when there are enough matches', () => {
    const r = rank('occasion=birthday');
    expect(r.matches.length).toBeGreaterThanOrEqual(4);
    expect(r.alternatives).toEqual([]);
    expect(r.relaxed).toEqual([]);
  });
});

describe('countGiftTypes', () => {
  it('counts in-stock products per type, once each', () => {
    const counts = countGiftTypes([...CATALOG, prod('double', { types: ['mug', 'mug'] })]);
    expect(counts.mug).toBe(2);
    expect(counts.wallet).toBeUndefined(); // only wallet is out of stock
    expect(counts.electronics).toBeUndefined();
    expect(rank('').facets.types.jewelry).toBe(2);
  });
});

describe('rankGifts — malformed input and data', () => {
  it('matches Telugu interests whether typed composed or decomposed', () => {
    const composed = 'పైన'; // పైన, with the single "ai" vowel sign
    const decomposed = 'పైన'; // the same word, vowel sign split in two
    expect(decomposed).not.toBe(composed);
    const catalog = [prod('t', { interests: [composed], occasions: ['birthday'] })];
    const c = parseGiftCriteria(new URLSearchParams({ likes: decomposed }));
    expect(rankGifts(catalog, c).matches.map((m) => m.product.id)).toEqual(['t']);
  });

  it('treats an unknown recipient as no preference instead of hiding tagged products', () => {
    const c = parseGiftCriteria(new URLSearchParams('recipient=pets&occasion=birthday'));
    expect(c.recipient).toBe('');
    const unknown = rankGifts(CATALOG, c).matches.map((m) => m.product.id);
    const none = rank('occasion=birthday').matches.map((m) => m.product.id);
    expect(unknown).toEqual(none);
  });

  it('keeps a product whose age range is impossible (min above max) and gives no age score', () => {
    const catalog = [prod('bad', { ageMin: 10, ageMax: 5, occasions: ['birthday'] })];
    const r = rankGifts(catalog, parseGiftCriteria(new URLSearchParams('age=7&occasion=birthday')));
    expect(r.matches.map((m) => m.product.id)).toEqual(['bad']);
    expect(r.matches[0].reasons.some((x) => x.code === 'age')).toBe(false);
  });
});
