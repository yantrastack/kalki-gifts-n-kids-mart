import path from 'node:path';
import { NextRequest } from 'next/server';
import { GIFT_OCCASIONS, GIFT_TYPES } from '@stockwell/shared';
import { beforeAll, describe, expect, it } from 'vitest';

// Throwaway in-memory DB; must be set before anything imports @/db/client.
process.env.DATABASE_URL = ':memory:';

describe('getGiftOptions', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let getGiftOptions: any;

  beforeAll(async () => {
    const { migrate } = await import('drizzle-orm/libsql/migrator');
    const { db } = await import('@/db/client');
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    const { POST } = await import('@/app/api/products/route');
    const create = (body: object) =>
      POST(
        new NextRequest('http://localhost/api/products', {
          method: 'POST',
          body: JSON.stringify(body),
        }),
      );
    const complete = {
      category: 'Gifts',
      price: 500,
      cost: 300,
      gstRate: 18,
      hsnCode: '8518',
    };
    // Live and in stock: its custom words are visible to customers.
    await create({
      ...complete,
      name: 'Live',
      sku: 'GO-1',
      stock: 5,
      activate: true,
      giftOccasions: 'raksha-bandhan,birthday',
      giftTypes: 'board-game',
    });
    // Draft: admin sees its custom words, customers don't.
    await create({ name: 'Draft', sku: 'GO-2', giftOccasions: 'diwali', giftTypes: 'Candle' });
    // Live but out of stock: not shown to customers either.
    await create({
      ...complete,
      name: 'Sold out',
      sku: 'GO-3',
      stock: 0,
      activate: true,
      giftTypes: 'puzzle',
    });
    ({ getGiftOptions } = await import('./giftOptions'));
  });

  it('lists the built-in choices first, then custom ones from every product (admin)', async () => {
    const o = await getGiftOptions({ publicOnly: false });
    expect(o.occasions.slice(0, GIFT_OCCASIONS.length)).toEqual([...GIFT_OCCASIONS]);
    expect(o.occasions.slice(GIFT_OCCASIONS.length)).toEqual(['diwali', 'raksha-bandhan']);
    expect(o.types.slice(0, GIFT_TYPES.length)).toEqual([...GIFT_TYPES]);
    expect(o.types.slice(GIFT_TYPES.length)).toEqual(['board-game', 'candle', 'puzzle']);
  });

  it('only offers custom words used by sellable products to customers', async () => {
    const o = await getGiftOptions({ publicOnly: true });
    expect(o.occasions.slice(GIFT_OCCASIONS.length)).toEqual(['raksha-bandhan']);
    expect(o.types.slice(GIFT_TYPES.length)).toEqual(['board-game']);
  });

  it('never repeats a built-in choice', async () => {
    const o = await getGiftOptions({ publicOnly: false });
    expect(o.occasions.filter((x: string) => x === 'birthday')).toHaveLength(1);
  });
});
