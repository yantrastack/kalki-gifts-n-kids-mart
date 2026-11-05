import path from 'node:path';
import { NextRequest } from 'next/server';
import type { FeedResponse } from '@stockwell/shared';
import { beforeAll, describe, expect, it } from 'vitest';

// Throwaway in-memory DB; must be set before anything imports @/db/client.
process.env.DATABASE_URL = ':memory:';

// YAN-117: the "Found N" toast needs the size of the whole category, not of the first page.
describe('GET /api/shop/feed total', () => {
  let GET: (req: NextRequest) => Promise<Response>;
  const feed = async (qs = '') => {
    const res = await GET(new NextRequest(`http://localhost/api/shop/feed?${qs}`));
    return (await res.json()) as FeedResponse;
  };

  beforeAll(async () => {
    const { migrate } = await import('drizzle-orm/libsql/migrator');
    const { db, schema } = await import('@/db/client');
    const { eq } = await import('drizzle-orm');
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    const { POST } = await import('@/app/api/products/route');

    // `live` = sellable (active, in stock); `media` = has a photo, so it is a reel.
    const add = async (
      name: string,
      category: string,
      opts: { live?: boolean; media?: boolean },
    ) => {
      const row = await (
        await POST(
          new NextRequest('http://localhost/api/products', {
            method: 'POST',
            body: JSON.stringify({
              name,
              sku: name.toUpperCase().replace(/\W+/g, '-'),
              category,
              stock: 3,
            }),
          }),
        )
      ).json();
      if (opts.live)
        await db
          .update(schema.products)
          .set({ lifecycle: 'active' } as any)
          .where(eq(schema.products.id, row.id));
      if (opts.media)
        await db.insert(schema.productMedia).values({
          id: `m-${row.id}`,
          productId: row.id,
          url: `/seed/${row.id}.jpg`,
          type: 'image',
          sortOrder: 0,
        } as any);
    };

    // Candles: 7 reels (more than one 5-item page) + 1 with no media + 1 draft.
    for (let i = 1; i <= 7; i++) await add(`Candle ${i}`, 'Candles', { live: true, media: true });
    await add('Candle no media', 'Candles', { live: true });
    await add('Candle draft', 'Candles', { media: true });
    // Toys: 2 reels. Plants: nothing sellable.
    await add('Toy 1', 'Toys', { live: true, media: true });
    await add('Toy 2', 'Toys', { live: true, media: true });
    await add('Plant draft', 'Plants', {});
    ({ GET } = await import('./route'));
  });

  it('counts every reel of a category, even past the first page', async () => {
    const res = await feed('category=Candles&limit=5');
    expect(res.items).toHaveLength(5); // one page…
    expect(res.nextCursor).not.toBeNull();
    expect(res.total).toBe(7); // …but the toast must say 7
  });

  it('gives the same total on later pages', async () => {
    const res = await feed('category=Candles&limit=5&cursor=5');
    expect(res.items).toHaveLength(2);
    expect(res.nextCursor).toBeNull();
    expect(res.total).toBe(7);
  });

  it('counts all reels for All, and skips products with no media or not live', async () => {
    expect((await feed()).total).toBe(9); // 7 candles + 2 toys
    expect((await feed('category=all')).total).toBe(9);
  });

  it('is 0 for a category with no reels', async () => {
    const res = await feed('category=Plants');
    expect(res.items).toEqual([]);
    expect(res.total).toBe(0);
  });
});
