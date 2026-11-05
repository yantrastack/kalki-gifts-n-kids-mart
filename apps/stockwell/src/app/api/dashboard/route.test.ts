import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@libsql/client';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it } from 'vitest';

// Point @/db/client at a throwaway in-memory DB before anything imports it.
process.env.DATABASE_URL = ':memory:';

// YAN-115: Recent sales orders ignore the range; orders carry a real timestamp.
describe('dashboard + sales orders (YAN-115)', () => {
  let db: any;
  let schema: any;
  let dashboardGET: any;
  let ordersGET: any;
  let ordersPOST: any;

  const dashboard = async (range: string) =>
    (await dashboardGET(new NextRequest(`http://localhost/api/dashboard?range=${range}`))).json();

  const daysAgoIso = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

  beforeAll(async () => {
    const { migrate } = await import('drizzle-orm/libsql/migrator');
    ({ db, schema } = await import('@/db/client'));
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    ({ GET: dashboardGET } = await import('./route'));
    ({ GET: ordersGET, POST: ordersPOST } = await import('../sales-orders/route'));

    // Ten orders well outside even the 90-day window, plus one cancelled recent one.
    const old = Array.from({ length: 10 }, (_, i) => ({
      id: `SO-OLD${i}`,
      customer: `Old ${i}`,
      items: 1,
      total: 100,
      status: 'fulfilled',
      payment: 'paid',
      date: 'Jul 08',
      createdAt: daysAgoIso(200 + i),
    }));
    const rows = [
      ...old,
      {
        id: 'SO-CANCEL',
        customer: 'C',
        items: 1,
        total: 999,
        status: 'cancelled',
        payment: 'unpaid',
        date: 'x',
        createdAt: daysAgoIso(1),
      },
    ];
    await db.insert(schema.salesOrders).values(rows);
  });

  it('lists the latest orders even when all are outside the range, capped at 8', async () => {
    const d = await dashboard('7d');
    expect(d.recentOrders).toHaveLength(8);
    expect(d.recentOrders[0].id).toBe('SO-CANCEL');
    expect(d.recentOrders[1].id).toBe('SO-OLD0');
    // Same list for every range.
    expect((await dashboard('90d')).recentOrders.map((o: any) => o.id)).toEqual(
      d.recentOrders.map((o: any) => o.id),
    );
  });

  it('keeps revenue bounded by the range and excludes cancelled orders', async () => {
    const d = await dashboard('7d');
    expect(d.revenue.series).toHaveLength(7);
    expect(d.revenue.total).toBe(0);
    expect((await dashboard('30d')).revenue.series).toHaveLength(30);
  });

  it('stamps a new order with createdAt and shows it first everywhere', async () => {
    const res = await ordersPOST(
      new NextRequest('http://localhost/api/sales-orders', {
        method: 'POST',
        body: JSON.stringify({ id: 'SO-NEW', customer: 'New', items: 2, total: 500 }),
      }),
    );
    const created = await res.json();
    expect(res.status).toBe(201);
    expect(Number.isNaN(new Date(created.createdAt).getTime())).toBe(false);

    const list = await (await ordersGET()).json();
    expect(list[0].id).toBe('SO-NEW');

    const d = await dashboard('7d');
    expect(d.recentOrders[0].id).toBe('SO-NEW');
    expect(d.recentOrders).toHaveLength(8);
    // Today's order lands in the revenue series.
    expect(d.revenue.total).toBe(500);
    expect(d.revenue.series.at(-1).total).toBe(500);
  });

  it('returns an empty list (not an error) when there are no orders', async () => {
    await db.delete(schema.salesOrders);
    const d = await dashboard('30d');
    expect(d.recentOrders).toEqual([]);
  });
});

describe('migration 0015 backfills created_at from legacy labels', () => {
  const sql = fs.readFileSync(
    path.resolve(process.cwd(), 'drizzle/0015_sales_order_created_at.sql'),
    'utf8',
  );

  it('handles "Mon DD", "DD Mon", explicit years, future days and junk', async () => {
    const c = createClient({ url: ':memory:' });
    // The table as it was before 0015.
    await c.execute(
      'CREATE TABLE sales_orders (id text PRIMARY KEY, customer text, items integer, total real, status text, payment text, date text)',
    );
    const future = new Date(Date.now() + 10 * 86_400_000);
    const mon = future.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const futureLabel = `${mon} ${String(future.getUTCDate()).padStart(2, '0')}`;
    const labels: Record<string, string | null> = {
      A: 'Jul 16',
      B: '16 Jul',
      C: 'Jul 16, 2024',
      D: '05 Sept 2025',
      E: futureLabel,
      F: 'garbage',
      G: null,
    };
    for (const [id, date] of Object.entries(labels))
      await c.execute({
        sql: 'INSERT INTO sales_orders (id, date) VALUES (?, ?)',
        args: [id, date],
      });

    for (const stmt of sql.split('--> statement-breakpoint')) await c.execute(stmt);

    const rows = (await c.execute('SELECT id, created_at FROM sales_orders ORDER BY id')).rows;
    const got = Object.fromEntries(rows.map((r) => [r.id, r.created_at]));
    const y = new Date().getUTCFullYear();
    const julY = new Date(Date.UTC(y, 6, 16)) > new Date() ? y - 1 : y;
    const pad = (n: number) => String(n).padStart(2, '0');

    expect(got.A).toBe(`${julY}-07-16T12:00:00.000Z`);
    expect(got.B).toBe(`${julY}-07-16T12:00:00.000Z`);
    expect(got.C).toBe('2024-07-16T12:00:00.000Z');
    expect(got.D).toBe('2025-09-05T12:00:00.000Z');
    expect(got.E).toBe(
      `${future.getUTCFullYear() - 1}-${pad(future.getUTCMonth() + 1)}-${pad(future.getUTCDate())}T12:00:00.000Z`,
    );
    expect(got.F).toBeNull();
    expect(got.G).toBeNull();
    c.close();
  });
});
