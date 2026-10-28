import { describe, expect, it } from 'vitest';
import {
  canTransition,
  isPublic,
  isSellable,
  missingForActivation,
  normaliseSku,
  validatePricing,
} from './catalog';

describe('missingForActivation', () => {
  const complete = {
    name: 'Candle',
    sku: 'ABC-1',
    category: 'Candles',
    price: 100,
    cost: 50,
    gstRate: 12,
    hsnCode: '3406',
  };

  it('is empty for a complete product', () => {
    expect(missingForActivation(complete)).toEqual([]);
  });

  it('flags missing price', () => {
    expect(missingForActivation({ ...complete, price: 0 })).toContain('price');
  });

  it('flags missing category', () => {
    expect(missingForActivation({ ...complete, category: '' })).toContain('category');
  });

  it("treats 'Uncategorized' as missing", () => {
    expect(missingForActivation({ ...complete, category: 'Uncategorized' })).toContain('category');
  });

  it('rejects a null gstRate but accepts an explicit 0', () => {
    expect(missingForActivation({ ...complete, gstRate: null })).toContain('gstRate');
    expect(missingForActivation({ ...complete, gstRate: 0 })).toEqual([]);
  });

  it('rejects an invalid HSN length', () => {
    expect(missingForActivation({ ...complete, hsnCode: '12' })).toContain('hsnCode');
  });
});

describe('validatePricing', () => {
  it('flags price above MRP', () => {
    expect(validatePricing({ price: 100, cost: 50, mrp: 90 })).toContain('priceAboveMrp');
  });

  it('flags price below cost as a warning', () => {
    expect(validatePricing({ price: 40, cost: 50, mrp: 90 })).toContain('priceBelowCost');
  });

  it('is clean for sane pricing', () => {
    expect(validatePricing({ price: 80, cost: 50, mrp: 90 })).toEqual([]);
  });
});

describe('normaliseSku', () => {
  it('trims and uppercases', () => {
    expect(normaliseSku('  abc-123  ')).toBe('ABC-123');
  });
});

describe('canTransition', () => {
  it('allows draft -> active', () => expect(canTransition('draft', 'active')).toBe(true));
  it('allows active -> discontinued', () =>
    expect(canTransition('active', 'discontinued')).toBe(true));
  it('allows discontinued -> active', () =>
    expect(canTransition('discontinued', 'active')).toBe(true));
  it('rejects active -> draft', () => expect(canTransition('active', 'draft')).toBe(false));
  it('rejects discontinued -> draft', () =>
    expect(canTransition('discontinued', 'draft')).toBe(false));
  it('allows a no-op same -> same', () => expect(canTransition('draft', 'draft')).toBe(true));
});

describe('isSellable / isPublic', () => {
  it('is sellable only when active, in-stock-status, and stock > 0', () => {
    expect(isSellable({ lifecycle: 'active', status: 'active', stock: 5 })).toBe(true);
    expect(isSellable({ lifecycle: 'draft', status: 'active', stock: 5 })).toBe(false);
    expect(isSellable({ lifecycle: 'active', status: 'out', stock: 0 })).toBe(false);
    expect(isSellable({ lifecycle: 'active', status: 'active', stock: 0 })).toBe(false);
  });

  it('is public only when lifecycle is active', () => {
    expect(isPublic({ lifecycle: 'active' })).toBe(true);
    expect(isPublic({ lifecycle: 'draft' })).toBe(false);
    expect(isPublic({ lifecycle: 'discontinued' })).toBe(false);
  });
});
