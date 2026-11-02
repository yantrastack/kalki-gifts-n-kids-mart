import path from 'node:path';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it } from 'vitest';

// YAN-109: publishing needs at least 3 photos; products already live stay live.
// In-memory DB, set before @/db/client is imported (it reads DATABASE_URL on import).
process.env.DATABASE_URL = ':memory:';

describe('publishing and the photo rule', () => {
  let lifecycle: any;
  let product: any;
  let products: any;
  let db: any;
  let schema: any;

  const complete = {
    category: 'Gifts',
    price: 500,
    cost: 300,
    gstRate: 18,
    hsnCode: '8518',
    stock: 4,
  };
  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  const create = async (body: object) =>
    products.POST(
      new NextRequest('http://localhost/api/products', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );
  const activate = (id: string) =>
    lifecycle.POST(
      new NextRequest(`http://localhost/api/products/${id}/lifecycle`, {
        method: 'POST',
        body: JSON.stringify({ to: 'active' }),
      }),
      params(id),
    );
  const addMedia = async (productId: string, types: ('image' | 'video')[]) => {
    for (const [i, type] of types.entries())
      await db.insert(schema.productMedia).values({
        id: `${productId}-m${i}-${Math.random().toString(36).slice(2, 7)}`,
        productId,
        url: `/uploads/${productId}-${i}`,
        type,
        sortOrder: i,
      });
  };

  beforeAll(async () => {
    const { migrate } = await import('drizzle-orm/libsql/migrator');
    ({ db, schema } = await import('@/db/client'));
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    lifecycle = await import('./route');
    product = await import('../route');
    products = await import('../../route');
  });

  it('refuses to publish a draft with fewer than 3 photos, naming photos', async () => {
    const draft = await (await create({ ...complete, name: 'Two photos', sku: 'PH-2' })).json();
    await addMedia(draft.id, ['image', 'image']);
    const res = await activate(draft.id);
    expect(res.status).toBe(400);
    expect((await res.json()).missing).toEqual(['photos']);
  });

  it('does not count videos toward the 3 photos', async () => {
    const draft = await (await create({ ...complete, name: 'Videos', sku: 'PH-V' })).json();
    await addMedia(draft.id, ['image', 'image', 'video', 'video']);
    expect((await activate(draft.id)).status).toBe(400);
  });

  it('publishes a complete draft with 3 photos', async () => {
    const draft = await (await create({ ...complete, name: 'Three photos', sku: 'PH-3' })).json();
    await addMedia(draft.id, ['image', 'video', 'image', 'image']);
    const res = await activate(draft.id);
    expect(res.status).toBe(200);
    expect((await res.json()).lifecycle).toBe('active');
  });

  it('refuses create-and-publish in one request, since a new product has no photos', async () => {
    const res = await create({ ...complete, name: 'Direct', sku: 'PH-D', activate: true });
    expect(res.status).toBe(400);
    expect((await res.json()).missing).toEqual(['photos']);
  });

  it('still saves a draft with no photos', async () => {
    const res = await create({ ...complete, name: 'Draft only', sku: 'PH-0' });
    expect(res.status).toBe(201);
    expect((await res.json()).lifecycle).toBe('draft');
  });

  describe('already-live products with too few photos (grandfathered)', () => {
    let live: any;

    beforeAll(async () => {
      live = { id: 'legacy', name: 'Legacy', sku: 'LEG-1', ...complete, lifecycle: 'active' };
      await db.insert(schema.products).values(live);
      await addMedia('legacy', ['image']);
    });

    it('stay live and can still be edited', async () => {
      const res = await product.PUT(
        new NextRequest('http://localhost/api/products/legacy', {
          method: 'PUT',
          body: JSON.stringify({ name: 'Legacy (renamed)', price: 550 }),
        }),
        params('legacy'),
      );
      expect(res.status).toBe(200);
      const row = await res.json();
      expect(row.lifecycle).toBe('active');
      expect(row.price).toBe(550);
    });

    it('keep their photos when details are edited', async () => {
      const rows = await db.select().from(schema.productMedia);
      expect(rows.filter((m: any) => m.productId === 'legacy')).toHaveLength(1);
    });

    it('are listed with their photo count, for the "Needs photos" badge', async () => {
      const list = await (
        await products.GET(new NextRequest('http://localhost/api/products'))
      ).json();
      const byId = Object.fromEntries(list.map((p: any) => [p.id, p.photoCount]));
      expect(byId.legacy).toBe(1);
      expect(Object.values(byId).every((n) => typeof n === 'number')).toBe(true);
    });
  });
});
