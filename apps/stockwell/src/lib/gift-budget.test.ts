import { describe, expect, it } from 'vitest';
import { GIFT_BUDGETS, budgetForPrice, budgetToPriceRange, countByBudget } from '@stockwell/shared';

// The gift-finder API filters with inclusive bounds: minPrice <= price <= maxPrice.
const inRange = (price: number, r: { minPrice?: number; maxPrice?: number }) =>
  (r.minPrice === undefined || price >= r.minPrice) &&
  (r.maxPrice === undefined || price <= r.maxPrice);

describe('budgetToPriceRange', () => {
  it('maps each preset to the expected API range', () => {
    expect(budgetToPriceRange('under-500')).toEqual({ maxPrice: 499.99 });
    expect(budgetToPriceRange('500-1000')).toEqual({ minPrice: 500, maxPrice: 999.99 });
    expect(budgetToPriceRange('1000-2500')).toEqual({ minPrice: 1000, maxPrice: 2499.99 });
    expect(budgetToPriceRange('above-2500')).toEqual({ minPrice: 2500 });
  });

  it('puts every price, including boundaries, in exactly one preset', () => {
    const prices = [0, 249, 499.99, 500, 999.99, 1000, 2499, 2499.99, 2500, 2500.01, 99999];
    for (const price of prices) {
      const hits = GIFT_BUDGETS.filter((b) => inRange(price, budgetToPriceRange(b)));
      expect(hits, `price ${price}`).toEqual([budgetForPrice(price)]);
    }
  });
});

describe('budgetForPrice', () => {
  it('assigns boundary prices to the upper bucket', () => {
    expect(budgetForPrice(499)).toBe('under-500');
    expect(budgetForPrice(500)).toBe('500-1000');
    expect(budgetForPrice(1000)).toBe('1000-2500');
    expect(budgetForPrice(2500)).toBe('above-2500');
  });
});

describe('countByBudget', () => {
  it('counts prices per preset, with zeros for empty ones', () => {
    expect(countByBudget([249, 499, 500, 1200, 2499])).toEqual({
      'under-500': 2,
      '500-1000': 1,
      '1000-2500': 2,
      'above-2500': 0,
    });
  });
});
