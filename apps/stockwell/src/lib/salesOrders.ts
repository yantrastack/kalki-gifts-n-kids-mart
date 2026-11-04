// When a sales order was placed, and newest-first ordering (YAN-115).
// Pure so it can be tested without a DB.
import { parseOrderDate } from './dashboardRange';

/** Rows shown in the Dashboard's "Recent sales orders" card. */
export const RECENT_ORDERS_LIMIT = 8;

type DatedOrder = { id: string; createdAt?: string | null; date?: string | null };

/**
 * `createdAt` (ISO) when present and valid; otherwise the legacy yearless `date`
 * label, for rows that predate the column and weren't backfilled.
 */
export function orderPlacedAt(o: DatedOrder, today: Date): Date | null {
  if (o.createdAt) {
    const d = new Date(o.createdAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return parseOrderDate(o.date, today);
}

/** Newest first; undated orders last; ties broken by id, descending. */
export function sortOrdersNewestFirst<T extends DatedOrder>(orders: T[], today: Date): T[] {
  return orders
    .map((o) => ({ o, t: orderPlacedAt(o, today)?.getTime() ?? null }))
    .sort((a, b) => {
      if (a.t !== b.t) {
        if (a.t == null) return 1;
        if (b.t == null) return -1;
        return b.t - a.t;
      }
      return a.o.id < b.o.id ? 1 : a.o.id > b.o.id ? -1 : 0;
    })
    .map(({ o }) => o);
}

/** The latest `n` orders, regardless of any date range. */
export function latestOrders<T extends DatedOrder>(orders: T[], n: number, today: Date): T[] {
  return sortOrdersNewestFirst(orders, today).slice(0, n);
}

/** A client-supplied timestamp as normalised ISO, or null if missing/invalid. */
export function parseCreatedAt(v: unknown): string | null {
  if (typeof v !== 'string' || !v.trim()) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
