import path from 'node:path';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it } from 'vitest';
import { fakeJpeg, fakePng, text } from '@/lib/testImages';

// YAN-109: reordering product media and server-side upload checks.
// In-memory DB, set before @/db/client is imported (it reads DATABASE_URL on import).
process.env.DATABASE_URL = ':memory:';

describe('/api/products/[id]/media', () => {
  let route: any;
  let db: any;
  let schema: any;
  let adminCookie: string;

  const params = (id: string) => ({ params: Promise.resolve({ id }) });
  // Media mutations are admin-only (YAN-108); sign a real admin session for the writes.
  const authed = (init: RequestInit): RequestInit => ({
    ...init,
    headers: { ...(init.headers || {}), cookie: adminCookie },
  });
  const addMedia = async (productId: string, ids: string[]) => {
    for (const [i, id] of ids.entries())
      await db.insert(schema.productMedia).values({
        id,
        productId,
        url: `/uploads/${id}.jpg`,
        type: 'image',
        sortOrder: i,
      });
  };
  const patch = (id: string, body: unknown) =>
    route.PATCH(
      new NextRequest(
        `http://localhost/api/products/${id}/media`,
        authed({ method: 'PATCH', body: JSON.stringify(body) }),
      ),
      params(id),
    );
  const upload = (id: string, files: File[]) => {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    return route.POST(
      new NextRequest(
        `http://localhost/api/products/${id}/media`,
        authed({ method: 'POST', body: fd }),
      ),
      params(id),
    );
  };

  beforeAll(async () => {
    const { migrate } = await import('drizzle-orm/libsql/migrator');
    ({ db, schema } = await import('@/db/client'));
    const { createSession, SESSION_COOKIE } = await import('@/lib/session');
    const token = await createSession({
      sub: 'u-admin',
      email: 'admin@test',
      name: 'Admin',
      role: 'admin',
    });
    adminCookie = `${SESSION_COOKIE}=${token}`;
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    for (const id of ['pa', 'pb'])
      await db.insert(schema.products).values({ id, name: id, sku: id.toUpperCase() } as any);
    await addMedia('pa', ['a1', 'a2', 'a3']);
    await addMedia('pb', ['b1']);
    route = await import('./route');
  });

  describe('PATCH (reorder / set as cover)', () => {
    it('saves the new order; the first item becomes the cover', async () => {
      const res = await patch('pa', { order: ['a3', 'a1', 'a2'] });
      expect(res.status).toBe(200);
      const rows = await res.json();
      expect(rows.map((m: any) => m.id)).toEqual(['a3', 'a1', 'a2']);
      expect(rows.map((m: any) => m.sortOrder)).toEqual([0, 1, 2]);

      const listed = await (
        await route.GET(new NextRequest('http://localhost/api/products/pa/media'), params('pa'))
      ).json();
      expect(listed[0].id).toBe('a3');
    });

    it("rejects another product's media id and changes nothing", async () => {
      const before = await (
        await route.GET(new NextRequest('http://localhost/api/products/pa/media'), params('pa'))
      ).json();
      const res = await patch('pa', { order: ['a1', 'a2', 'b1'] });
      expect(res.status).toBe(400);
      const after = await (
        await route.GET(new NextRequest('http://localhost/api/products/pa/media'), params('pa'))
      ).json();
      expect(after.map((m: any) => m.id)).toEqual(before.map((m: any) => m.id));
    });

    it('rejects duplicates, missing ids and a malformed body', async () => {
      expect((await patch('pa', { order: ['a1', 'a1', 'a2'] })).status).toBe(400);
      expect((await patch('pa', { order: ['a1', 'a2'] })).status).toBe(400);
      expect((await patch('pa', { order: 'a1,a2,a3' })).status).toBe(400);
      expect((await patch('pa', {})).status).toBe(400);
    });

    it('404s for an unknown product', async () => {
      expect((await patch('nope', { order: [] })).status).toBe(404);
    });
  });

  describe('POST (upload checks, before anything is stored)', () => {
    const file = (bytes: BlobPart, name: string, type: string) => new File([bytes], name, { type });

    it('rejects a photo below the minimum resolution with a structured problem', async () => {
      const res = await upload('pb', [file(fakeJpeg(640, 480), 'small.jpg', 'image/jpeg')]);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.problem).toMatchObject({ code: 'tooSmall', width: 640, height: 480, min: 800 });
      expect(body.error).toContain('small.jpg');
    });

    it('rejects a renamed non-image file', async () => {
      const res = await upload('pb', [file(text('not a photo'), 'fake.png', 'image/png')]);
      expect(res.status).toBe(400);
      expect((await res.json()).problem.code).toBe('notAnImage');
    });

    it('rejects GIFs', async () => {
      const res = await upload('pb', [file(text('GIF89a'), 'a.gif', 'image/gif')]);
      expect((await res.json()).problem.code).toBe('unsupported');
    });

    it('stores nothing when any file in the batch is bad', async () => {
      const res = await upload('pb', [
        file(fakePng(1000, 1000), 'ok.png', 'image/png'),
        file(fakePng(100, 100), 'tiny.png', 'image/png'),
      ]);
      expect(res.status).toBe(400);
      const rows = await (
        await route.GET(new NextRequest('http://localhost/api/products/pb/media'), params('pb'))
      ).json();
      expect(rows.map((m: any) => m.id)).toEqual(['b1']);
    });
  });

  describe('permissions: mutations need a signed-in user', () => {
    it('POST without a session is refused and stores nothing', async () => {
      const fd = new FormData();
      fd.append('files', new File([fakePng(1000, 1000)], 'ok.png', { type: 'image/png' }));
      const res = await route.POST(
        new NextRequest('http://localhost/api/products/pb/media', { method: 'POST', body: fd }),
        params('pb'),
      );
      expect(res.status).toBe(403);
      const rows = await (
        await route.GET(new NextRequest('http://localhost/api/products/pb/media'), params('pb'))
      ).json();
      expect(rows.map((m: any) => m.id)).toEqual(['b1']);
    });

    it('PATCH without a session is refused and the order is unchanged', async () => {
      const res = await route.PATCH(
        new NextRequest('http://localhost/api/products/pa/media', {
          method: 'PATCH',
          body: JSON.stringify({ order: ['a2', 'a1', 'a3'] }),
        }),
        params('pa'),
      );
      expect(res.status).toBe(403);
      const rows = await (
        await route.GET(new NextRequest('http://localhost/api/products/pa/media'), params('pa'))
      ).json();
      expect(rows.map((m: any) => m.id)).toEqual(['a3', 'a1', 'a2']);
    });
  });
});
