import path from 'node:path';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it } from 'vitest';

// Throwaway in-memory DB; must be set before anything imports @/db/client.
process.env.DATABASE_URL = ':memory:';

describe('POST /api/shop/events', () => {
  let POST: (req: NextRequest) => Promise<Response>;
  let productId = '';
  const send = (body: unknown) =>
    POST(
      new NextRequest('http://localhost/api/shop/events', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    );

  beforeAll(async () => {
    const { migrate } = await import('drizzle-orm/libsql/migrator');
    const { db } = await import('@/db/client');
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    const products = await import('@/app/api/products/route');
    const row = await (
      await products.POST(
        new NextRequest('http://localhost/api/products', {
          method: 'POST',
          body: JSON.stringify({ name: 'Teddy', sku: 'EV-1', category: 'Toys', price: 299 }),
        }),
      )
    ).json();
    productId = row.id;
    ({ POST } = await import('./route'));
  });

  it('records wishlist save / unsave events (YAN-111)', async () => {
    const { db, schema } = await import('@/db/client');
    for (const type of ['save', 'unsave']) {
      expect((await send({ productId, type, sessionId: 'sf-test' })).status).toBe(200);
    }
    const rows = await db.select().from(schema.productEvents).all();
    expect(rows.map((r) => r.type)).toEqual(['save', 'unsave']);
  });

  it('still accepts the existing types and rejects unknown ones', async () => {
    expect((await send({ productId, type: 'like' })).status).toBe(200);
    expect((await send({ productId, type: 'bookmark' })).status).toBe(400);
    expect((await send({ type: 'save' })).status).toBe(400);
  });
});
