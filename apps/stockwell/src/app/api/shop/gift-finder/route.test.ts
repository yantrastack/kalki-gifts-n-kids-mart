import path from 'node:path';
import { NextRequest } from 'next/server';
import type { GiftFinderResponse } from '@stockwell/shared';
import { beforeAll, describe, expect, it } from 'vitest';

// Throwaway in-memory DB; must be set before anything imports @/db/client.
process.env.DATABASE_URL = ':memory:';

describe('GET /api/shop/gift-finder', () => {
  let GET: (req: NextRequest) => Promise<Response>;
  const find = async (qs: string) => {
    const res = await GET(new NextRequest(`http://localhost/api/shop/gift-finder?${qs}`));
    return { status: res.status, body: await res.json() };
  };

  beforeAll(async () => {
    const { migrate } = await import('drizzle-orm/libsql/migrator');
    const { db, schema } = await import('@/db/client');
    const { eq } = await import('drizzle-orm');
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    const { POST } = await import('@/app/api/products/route');
    // Publishing needs photos (YAN-109); these tests are about gift tags, so a product
    // with `activate` is created as a draft and then marked live directly.
    const create = async ({ activate, ...body }: { activate?: boolean; [k: string]: unknown }) => {
      const row = await (
        await POST(
          new NextRequest('http://localhost/api/products', {
            method: 'POST',
            body: JSON.stringify(body),
          }),
        )
      ).json();
      if (activate)
        await db
          .update(schema.products)
          .set({ lifecycle: 'active' } as any)
          .where(eq(schema.products.id, row.id));
    };
    const live = { category: 'Gifts', cost: 100, gstRate: 18, hsnCode: '9503', activate: true };
    await create({
      ...live,
      name: 'Teddy',
      sku: 'GF-1',
      price: 499,
      stock: 4,
      giftOccasions: 'birthday',
      giftRecipients: 'kids',
      giftAgeMin: 0,
      giftAgeMax: 12,
      giftTypes: 'toys',
    });
    await create({
      ...live,
      name: 'Necklace',
      sku: 'GF-2',
      price: 2200,
      stock: 2,
      giftOccasions: 'birthday',
      giftRecipients: 'women',
      giftAgeMin: 14,
      giftTypes: 'jewelry',
    });
    // Draft: never visible to customers.
    await create({ name: 'Draft toy', sku: 'GF-3', giftOccasions: 'birthday', giftTypes: 'toys' });
    ({ GET } = await import('./route'));
  });

  it('returns the GiftFinderResponse shape with facets', async () => {
    const { status, body } = await find('occasion=birthday');
    const r = body as GiftFinderResponse;
    expect(status).toBe(200);
    expect(r.matches.map((m) => m.product.name)).toEqual(['Teddy', 'Necklace']);
    expect(r.facets.types).toEqual({ toys: 1, jewelry: 1 });
  });

  it('applies recipient and age as hard filters end to end', async () => {
    const { body } = await find('occasion=birthday&recipient=kids&age=8');
    const r = body as GiftFinderResponse;
    const shown = [...r.matches, ...r.alternatives].map((m) => m.product.name);
    expect(shown).toEqual(['Teddy']);
  });

  it('rejects min price above max price with a 400', async () => {
    const { status, body } = await find('minPrice=2000&maxPrice=500');
    expect(status).toBe(400);
    expect(body.error).toBe('invalid-price-range');
  });

  it('ignores a non-numeric age instead of returning nothing', async () => {
    const { body } = await find('age=abc');
    expect((body as GiftFinderResponse).matches.map((m) => m.product.name)).toEqual([
      'Teddy',
      'Necklace',
    ]);
  });
});
