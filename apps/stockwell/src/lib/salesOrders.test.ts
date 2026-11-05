import { describe, expect, it } from 'vitest';
import { parseOrderDate } from './dashboardRange';
import {
  latestOrders,
  orderPlacedAt,
  parseCreatedAt,
  RECENT_ORDERS_LIMIT,
  sortOrdersNewestFirst,
} from './salesOrders';

// YAN-115: sales orders are dated by `createdAt`; the old yearless label is a fallback.
const today = new Date(2026, 10, 2, 15, 0); // Nov 2, 2026 (local)

describe('parseOrderDate (legacy labels)', () => {
  it('reads "Mon DD" (Sales Orders API, seed)', () => {
    expect(parseOrderDate('Jul 16', today)).toEqual(new Date(2026, 6, 16));
  });

  it('reads "DD Mon" written by POS (en-IN), including "Sept"', () => {
    expect(parseOrderDate('16 Jul', today)).toEqual(new Date(2026, 6, 16));
    expect(parseOrderDate('05 Sept', today)).toEqual(new Date(2026, 8, 5));
    expect(parseOrderDate('16 Sept 2025', today)).toEqual(new Date(2025, 8, 16));
  });

  it('puts a yearless future day in the previous year', () => {
    expect(parseOrderDate('Dec 25', today)).toEqual(new Date(2025, 11, 25));
    expect(parseOrderDate('25 Dec', today)).toEqual(new Date(2025, 11, 25));
  });

  it('returns null for empty or unknown labels', () => {
    expect(parseOrderDate('', today)).toBeNull();
    expect(parseOrderDate(null, today)).toBeNull();
    expect(parseOrderDate('16 Foo', today)).toBeNull();
  });
});

describe('orderPlacedAt', () => {
  it('prefers createdAt over the label', () => {
    const d = orderPlacedAt(
      { id: 'a', createdAt: '2026-11-01T10:00:00.000Z', date: 'Jul 16' },
      today,
    );
    expect(d?.toISOString()).toBe('2026-11-01T10:00:00.000Z');
  });

  it('falls back to the label when createdAt is missing or invalid', () => {
    expect(orderPlacedAt({ id: 'a', createdAt: null, date: 'Jul 16' }, today)).toEqual(
      new Date(2026, 6, 16),
    );
    expect(orderPlacedAt({ id: 'a', createdAt: 'nope', date: '16 Jul' }, today)).toEqual(
      new Date(2026, 6, 16),
    );
    expect(orderPlacedAt({ id: 'a' }, today)).toBeNull();
  });
});

describe('sortOrdersNewestFirst / latestOrders', () => {
  const orders = [
    { id: 'SO-5815', createdAt: '2026-07-08T04:30:00.000Z', date: 'Jul 08' },
    { id: 'SO-5821', createdAt: '2026-07-16T10:30:00.000Z', date: 'Jul 16' },
    { id: 'SO-X', createdAt: null, date: 'garbage' },
    { id: 'SO-MHX1', createdAt: '2026-11-02T09:00:00.000Z', date: '02 Nov' },
    { id: 'SO-LEGACY', createdAt: null, date: '20 Oct' },
    { id: 'SO-5819', createdAt: '2026-07-15T08:30:00.000Z', date: 'Jul 15' },
    { id: 'SO-5820', createdAt: '2026-07-15T09:30:00.000Z', date: 'Jul 15' },
  ];

  it('orders by when the order was placed, not by id; undated last', () => {
    expect(sortOrdersNewestFirst(orders, today).map((o) => o.id)).toEqual([
      'SO-MHX1',
      'SO-LEGACY',
      'SO-5821',
      'SO-5820',
      'SO-5819',
      'SO-5815',
      'SO-X',
    ]);
  });

  it('breaks ties by id, descending', () => {
    const same = '2026-07-15T09:30:00.000Z';
    const r = sortOrdersNewestFirst(
      [
        { id: 'SO-1', createdAt: same },
        { id: 'SO-3', createdAt: same },
        { id: 'SO-2', createdAt: same },
      ],
      today,
    );
    expect(r.map((o) => o.id)).toEqual(['SO-3', 'SO-2', 'SO-1']);
  });

  it('keeps old orders: no date-range window, just the latest N', () => {
    expect(latestOrders(orders, RECENT_ORDERS_LIMIT, today)).toHaveLength(orders.length);
    expect(latestOrders(orders, 2, today).map((o) => o.id)).toEqual(['SO-MHX1', 'SO-LEGACY']);
    expect(latestOrders([], RECENT_ORDERS_LIMIT, today)).toEqual([]);
  });

  it('does not mutate the input', () => {
    const copy = [...orders];
    sortOrdersNewestFirst(orders, today);
    expect(orders).toEqual(copy);
  });
});

describe('parseCreatedAt', () => {
  it('normalises valid timestamps and rejects the rest', () => {
    expect(parseCreatedAt('2026-11-02T09:00:00Z')).toBe('2026-11-02T09:00:00.000Z');
    expect(parseCreatedAt('not a date')).toBeNull();
    expect(parseCreatedAt('')).toBeNull();
    expect(parseCreatedAt(42)).toBeNull();
    expect(parseCreatedAt(undefined)).toBeNull();
  });
});
