import path from 'node:path';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { fakeJpeg, fakePng, text } from '@/lib/testImages';

// YAN-108: replacing one media item in place (same position, same cover status).
// In-memory DB, set before @/db/client is imported (it reads DATABASE_URL on import).
process.env.DATABASE_URL = ':memory:';

describe('/api/products/[id]/media/[mediaId] (replace)', () => {
  let route: any;
  let db: any;
  let schema: any;
  let adminCookie: string;

  const params = (id: string, mediaId: string) => ({
    params: Promise.resolve({ id, mediaId }),
  });
  const replace = (id: string, mediaId: string, file: File | null, cookie = adminCookie) => {
    const fd = new FormData();
    if (file) fd.append('file', file);
    return route.PUT(
      new NextRequest(`http://localhost/api/products/${id}/media/${mediaId}`, {
        method: 'PUT',
        body: fd,
        headers: { cookie },
      }),
      params(id, mediaId),
    );
  };
  const file = (bytes: BlobPart, name: string, type: string) => new File([bytes], name, { type });

  beforeAll(async () => {
    const { migrate } = await import('drizzle-orm/libsql/migrator');
    ({ db, schema } = await import('@/db/client'));
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    const { createSession, SESSION_COOKIE } = await import('@/lib/session');
    const token = await createSession({
      sub: 'u-admin',
      email: 'admin@test',
      name: 'Admin',
      role: 'admin',
    });
    adminCookie = `${SESSION_COOKIE}=${token}`;

    await db.insert(schema.products).values({ id: 'pa', name: 'pa', sku: 'PA' } as any);
    for (const [i, id] of ['m1', 'm2'].entries())
      await db.insert(schema.productMedia).values({
        id,
        productId: 'pa',
        url: `/uploads/seed-${id}.jpg`,
        type: 'image',
        sortOrder: i,
      });
    route = await import('./route');
  });

  it('replaces the file and keeps the position (sort_order unchanged)', async () => {
    const res = await replace('pa', 'm2', file(fakePng(1200, 1200), 'new.png', 'image/png'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('m2');
    expect(body.sortOrder).toBe(1);
    expect(body.url).toMatch(/^\/uploads\/pa-.+\.png$/);
    expect(body.type).toBe('image');
  });

  it('rejects a video replacing a photo with a structured typeMismatch', async () => {
    const res = await replace('pa', 'm1', file(text('fake video'), 'clip.mp4', 'video/mp4'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.problem).toMatchObject({ code: 'typeMismatch', expected: 'image' });
    // The row is untouched.
    const row = await db
      .select()
      .from(schema.productMedia)
      .where(eq(schema.productMedia.id, 'm1'))
      .get();
    expect(row.url).toBe('/uploads/seed-m1.jpg');
  });

  it('rejects an invalid file and changes nothing', async () => {
    const res = await replace('pa', 'm1', file(fakeJpeg(100, 100), 'tiny.jpg', 'image/jpeg'));
    expect(res.status).toBe(400);
    expect((await res.json()).problem.code).toBe('tooSmall');
  });

  it('404s for a media id of another product and for unknown ids', async () => {
    const ok = file(fakePng(1000, 1000), 'ok.png', 'image/png');
    expect((await replace('nope', 'm1', ok)).status).toBe(404);
    expect((await replace('pa', 'nope', ok)).status).toBe(404);
  });

  it('400s when no file is sent', async () => {
    expect((await replace('pa', 'm1', null)).status).toBe(400);
  });

  it('403s without an admin session', async () => {
    const res = await replace('pa', 'm1', file(fakePng(1000, 1000), 'ok.png', 'image/png'), '');
    expect(res.status).toBe(403);
  });
});
