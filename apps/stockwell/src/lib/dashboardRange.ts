// Date-range helpers for the dashboard (`/api/dashboard?range=7d|30d|90d`).
// Pure functions so the day-bucketing can be checked without a DB.

export const DASHBOARD_RANGES = ['7d', '30d', '90d'] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

const DAY_MS = 86_400_000;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Unknown / missing values fall back to the default 30-day window. */
export function parseRange(v: string | null | undefined): DashboardRange {
  return (DASHBOARD_RANGES as readonly string[]).includes(v ?? '') ? (v as DashboardRange) : '30d';
}

export const rangeDays = (r: DashboardRange) => Number.parseInt(r, 10);

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** Local calendar date as YYYY-MM-DD. */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Sales-order `date` is free text written as "Jul 16" (no year) or "Jul 16, 2026".
 * A yearless date is assumed to be the most recent such day on or before `today`.
 */
export function parseOrderDate(s: string | null | undefined, today: Date): Date | null {
  if (!s) return null;
  const m = /^([A-Za-z]{3})[A-Za-z]*\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/.exec(s.trim());
  if (m) {
    const month = MONTHS.indexOf(m[1].toLowerCase());
    if (month < 0) return null;
    const d = new Date(m[3] ? Number(m[3]) : today.getFullYear(), month, Number(m[2]));
    if (!m[3] && d > today) d.setFullYear(d.getFullYear() - 1);
    return d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : startOfDay(d);
}

/** Whole days between `d` and today (0 = today, 1 = yesterday, …). */
export function daysAgo(d: Date, today: Date): number {
  return Math.round((startOfDay(today).getTime() - startOfDay(d).getTime()) / DAY_MS);
}

/**
 * Buckets dated amounts into a daily series of `days` points, oldest first and
 * ending today (inclusive). Also totals the equally long window just before it.
 */
export function dailySeries(
  rows: { date: Date | null; amount: number }[],
  days: number,
  today: Date,
): { series: { date: string; total: number }[]; total: number; prevTotal: number } {
  const start = startOfDay(today);
  const series = Array.from({ length: days }, (_, i) => ({
    date: isoDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() - (days - 1 - i))),
    total: 0,
  }));
  let prevTotal = 0;
  for (const r of rows) {
    if (!r.date) continue;
    const ago = daysAgo(r.date, today);
    if (ago >= 0 && ago < days) series[days - 1 - ago].total += r.amount;
    else if (ago >= days && ago < days * 2) prevTotal += r.amount;
  }
  const total = series.reduce((s, p) => s + p.total, 0);
  return { series, total, prevTotal };
}

/**
 * First instant of the window (local midnight, `days - 1` days ago) formatted
 * like SQLite's CURRENT_TIMESTAMP (UTC "YYYY-MM-DD HH:MM:SS") for text comparison.
 */
export function rangeStartSql(days: number, today: Date): string {
  const s = startOfDay(today);
  const from = new Date(s.getFullYear(), s.getMonth(), s.getDate() - (days - 1));
  return from.toISOString().slice(0, 19).replace('T', ' ');
}
