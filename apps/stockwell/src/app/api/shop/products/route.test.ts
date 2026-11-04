import path from 'node:path';
import { NextRequest } from 'next/server';
import { WISHLIST_MAX, type ShopProduct } from '@stockwell/shared';
import { beforeAll, describe, expect, it } from 'vitest';

// Throwaway in-memory DB; must be set before anything imports @/db/client.
process.env.DATABASE_URL = ':memory:';

describe('GET /api/shop/products', () => {
  let GET: (req: NextRequest) => Promise<Response>;
  const ids: Record<string, string> = {};
  const get = async (qs = '') => {
    const res = await GET(new NextRequest(`http://localhost/api/shop/products${qs}`));
    return { status: res.status, body: await res.json() };
  };

  beforeAll(async () => {
    const { migrate } = await import('drizzle-orm/libsql/migrator');
    const { db, schema } = await import('@/db/client');
    const { eq } = await import('drizzle-orm');
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    const { POST } = await import('@/app/api/products/route');
    // Created as drafts, then given a lifecycle directly (publishing needs photos, YAN-109).
    const create = async (key: string, stock: number, lifecycle: string) => {
      const row = await (
        await POST(
          new NextRequest('http://localhost/api/products', {
            method: 'POST',
            body: JSON.stringify({
              name: `Item ${key}`,
              sku: `WL-${key}`,
              category: 'Toys',
              price: 299,
              cost: 100,
              gstRate: 18,
              hsnCode: '9503',
              stock,
            }),
          }),
        )
      ).json();
      await db
        .update(schema.products)
        .set({ lifecycle } as any)
        .where(eq(schema.products.id, row.id));
      ids[key] = row.id;
    };
    await create('live', 5, 'active');
    await create('soldout', 0, 'active');
    await create('draft', 5, 'draft');
    await create('retired', 5, 'discontinued');
    await db.insert(schema.productMedia).values({
      id: 'm-live',
      productId: ids.live,
      url: '/uploads/live.jpg',
      type: 'image',
      sortOrder: 0,
    } as any);
    ({ GET } = await import('./route'));
  });

  it('without ids: the catalog lists only active products in stock', async () => {
    const { status, body } = await get();
    expect(status).toBe(200);
    expect((body as ShopProduct[]).map((p) => p.id)).toEqual([ids.live]);
  });

  it('?ids= returns live products including sold-out ones, and leaves the rest out', async () => {
    const wanted = [ids.live, ids.soldout, ids.draft, ids.retired, 'no-such-id'];
    const { status, body } = await get(`?ids=${wanted.join(',')}`);
    expect(status).toBe(200);
    const byId = new Map((body as ShopProduct[]).map((p) => [p.id, p]));
    expect([...byId.keys()].sort()).toEqual([ids.live, ids.soldout].sort());
    expect(byId.get(ids.soldout)?.inStock).toBe(0);
    expect(byId.get(ids.live)?.media.map((m) => m.url)).toEqual(['/uploads/live.jpg']);
  });

  it('?ids= returns public fields only', async () => {
    const { body } = await get(`?ids=${ids.live}`);
    expect(Object.keys(body[0]).sort()).toEqual(
      ['brand', 'category', 'gift', 'id', 'inStock', 'media', 'name', 'price', 'sku', 'tag'].sort(),
    );
  });

  it('?ids= trims, de-duplicates and ignores blanks', async () => {
    const { body } = await get(`?ids=${encodeURIComponent(` ${ids.live} ,,${ids.live}, `)}`);
    expect((body as ShopProduct[]).map((p) => p.id)).toEqual([ids.live]);
    expect((await get('?ids=')).body).toEqual([]);
  });

  it('?ids= rejects too many or too long ids', async () => {
    const many = Array.from({ length: WISHLIST_MAX + 1 }, (_, i) => `p${i}`).join(',');
    expect((await get(`?ids=${many}`)).status).toBe(400);
    expect((await get(`?ids=${'x'.repeat(65)}`)).status).toBe(400);
  });
});
