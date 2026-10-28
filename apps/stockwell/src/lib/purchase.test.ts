import { describe, expect, it } from 'vitest';
import { buildNewProductFromLine, priceRefreshPatch } from './purchase';

const deriveStatus = (stock: number) => (stock <= 0 ? 'out' : stock <= 10 ? 'low' : 'active');

describe('buildNewProductFromLine', () => {
  const ctx = {
    warehouse: 'WH-1',
    supplier: 'Sup-1',
    now: '2026-01-01T00:00:00.000Z',
    receiveNow: true,
  };

  it('always creates as draft, even with plenty of stock', () => {
    const row = buildNewProductFromLine(
      { name: 'Widget', sku: 'W-1', qty: 50, cost: 100 },
      ctx,
      deriveStatus,
    );
    expect(row.lifecycle).toBe('draft');
    expect(row.stock).toBe(50);
  });

  it('never guesses a price from cost * 1.25 — stores 0 when none given', () => {
    const row = buildNewProductFromLine(
      { name: 'Widget', sku: 'W-2', qty: 10, cost: 100 },
      ctx,
      deriveStatus,
    );
    expect(row.price).toBe(0);
  });

  it('uses the given selling price when provided', () => {
    const row = buildNewProductFromLine(
      { name: 'Widget', sku: 'W-3', qty: 10, cost: 100, price: 150 },
      ctx,
      deriveStatus,
    );
    expect(row.price).toBe(150);
  });

  it('does not silently default category to Uncategorized', () => {
    const row = buildNewProductFromLine(
      { name: 'Widget', sku: 'W-4', qty: 10, cost: 100 },
      ctx,
      deriveStatus,
    );
    expect(row.category).toBeNull();
  });
});

describe('priceRefreshPatch', () => {
  const existing = { cost: 100, price: 150, mrp: 200 };

  it('is a no-op without updateCatalogPrice', () => {
    expect(priceRefreshPatch({ qty: 1, cost: 120, price: 180 }, existing)).toEqual({});
  });

  it('patches price/cost/mrp when the flag is set', () => {
    const patch = priceRefreshPatch(
      { qty: 1, cost: 120, price: 180, mrp: 220, updateCatalogPrice: true },
      existing,
    );
    expect(patch).toEqual({ cost: 120, price: 180, mrp: 220 });
  });

  it('falls back to the existing cost when none is given', () => {
    const patch = priceRefreshPatch({ qty: 1, cost: 0, updateCatalogPrice: true }, existing);
    expect(patch.cost).toBe(100);
  });
});
