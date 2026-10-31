import path from 'node:path';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it } from 'vitest';

// Point @/db/client at a throwaway in-memory DB before anything imports it.
// Must happen before the dynamic imports below, since the client module
// reads DATABASE_URL at import time.
process.env.DATABASE_URL = ':memory:';

describe('POST /api/products', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let POST: any;

  beforeAll(async () => {
    const { migrate } = await import('drizzle-orm/libsql/migrator');
    const { db } = await import('@/db/client');
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    ({ POST } = await import('./route'));
  });

  it('creates a draft product by default (no activate flag)', async () => {
    const req = new NextRequest('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Widget', sku: 'TST-1' }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.lifecycle).toBe('draft');
  });

  it('stores gift tags sent with the new product, including custom ones', async () => {
    const req = new NextRequest('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Gift Hamper',
        sku: 'GFT-1',
        giftOccasions: ['Birthday', 'raksha-bandhan', 'birthday'],
        giftTypes: ' board-game , Mug ',
        giftAgeMin: '3',
        giftAgeMax: '',
      }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.giftOccasions).toBe('birthday,raksha-bandhan');
    expect(body.giftTypes).toBe('board-game,mug');
    expect(body.giftAgeMin).toBe(3);
    expect(body.giftAgeMax).toBeNull();
    expect(body.giftRecipients).toBeNull();
  });

  it('leaves gift tags empty when none are sent', async () => {
    const req = new NextRequest('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'Plain', sku: 'PLN-1' }),
    });
    const body = await (await POST(req)).json();
    expect(body.giftOccasions).toBeNull();
    expect(body.giftTypes).toBeNull();
  });

  it('rejects a case/whitespace-variant duplicate SKU with 409', async () => {
    const first = new NextRequest('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'A', sku: 'DUP-1' }),
    });
    const firstRes = await POST(first);
    expect(firstRes.status).toBe(201);

    const second = new NextRequest('http://localhost/api/products', {
      method: 'POST',
      body: JSON.stringify({ name: 'B', sku: '  dup-1  ' }),
    });
    const secondRes = await POST(second);
    expect(secondRes.status).toBe(409);
  });
});
