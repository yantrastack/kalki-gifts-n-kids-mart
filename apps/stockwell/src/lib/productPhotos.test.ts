import path from 'node:path';
import { NextRequest } from 'next/server';
import { beforeAll, describe, expect, it } from 'vitest';

// Throwaway in-memory DB; must be set before anything imports @/db/client.
process.env.DATABASE_URL = ':memory:';

describe('product photos for the admin', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mod: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let GET: any;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    const { migrate } = await import('drizzle-orm/libsql/migrator');
    const { db, schema } = await import('@/db/client');
    await migrate(db, { migrationsFolder: path.resolve(process.cwd(), 'drizzle') });
    const { POST } = await import('@/app/api/products/route');
    const create = async (name: string, sku: string) =>
      (
        await (
          await POST(
            new NextRequest('http://localhost/api/products', {
              method: 'POST',
              body: JSON.stringify({ name, sku }),
            }),
          )
        ).json()
      ).id as string;
    ids.withPhotos = await create('With photos', 'PH-1');
    ids.videoOnly = await create('Video only', 'PH-2');
    ids.none = await create('No media', 'PH-3');

    const media = (
      id: string,
      productId: string,
      url: string,
      type: string,
      sortOrder: number,
    ) => ({ id, productId, url, type, sortOrder });
    await db.insert(schema.productMedia).values([
      // Inserted out of order on purpose: the sort order decides which photo is the cover.
      media('m2', ids.withPhotos, '/uploads/b.jpg', 'image', 1),
      media('m1', ids.withPhotos, '/uploads/a.jpg', 'image', 0),
      media('m3', ids.withPhotos, '/uploads/clip.mp4', 'video', 2),
      media('m4', ids.videoOnly, '/uploads/only.mp4', 'video', 0),
    ] as any);
    mod = await import('./productPhotos');
    ({ GET } = await import('@/app/api/products/route'));
  });

  it('lists photos in media order and skips videos', async () => {
    const photos = await mod.loadPhotos();
    expect(photos.get(ids.withPhotos)).toEqual(['/uploads/a.jpg', '/uploads/b.jpg']);
    expect(photos.has(ids.videoOnly)).toBe(false);
  });

  it('uses the first photo as the cover, or null when there is none', async () => {
    const photos = await mod.loadPhotos();
    expect(mod.coverOf(photos, ids.withPhotos)).toBe('/uploads/a.jpg');
    expect(mod.coverOf(photos, ids.videoOnly)).toBeNull();
    expect(mod.coverOf(photos, ids.none)).toBeNull();
    expect(mod.coverOf(photos, null)).toBeNull();
  });

  it('adds a cover to any rows that carry a product id', async () => {
    const rows = await mod.withCover(
      [
        { id: 1, productId: ids.withPhotos },
        { id: 2, productId: null },
      ],
      'productId',
    );
    expect(rows.map((r: { cover: string | null }) => r.cover)).toEqual(['/uploads/a.jpg', null]);
  });

  it('GET /api/products returns each product with its cover and photos', async () => {
    const res = await GET(new NextRequest('http://localhost/api/products'));
    const list = await res.json();
    const byId = new Map(list.map((p: { id: string }) => [p.id, p]));
    const withPhotos = byId.get(ids.withPhotos) as any;
    expect(withPhotos.cover).toBe('/uploads/a.jpg');
    expect(withPhotos.photos).toEqual(['/uploads/a.jpg', '/uploads/b.jpg']);
    expect(withPhotos.photoCount).toBe(2);
    const none = byId.get(ids.none) as any;
    expect(none.cover).toBeNull();
    expect(none.photos).toEqual([]);
  });

  it('GET /api/products also returns the videos, in media order with the photos', async () => {
    const list = await (await GET(new NextRequest('http://localhost/api/products'))).json();
    const byId = new Map(list.map((p: { id: string }) => [p.id, p]));
    const withPhotos = byId.get(ids.withPhotos) as any;
    expect(withPhotos.gallery.map((g: { type: string }) => g.type)).toEqual([
      'image',
      'image',
      'video',
    ]);
    expect(withPhotos.videoCount).toBe(1);
    const videoOnly = byId.get(ids.videoOnly) as any;
    expect(videoOnly.videoCount).toBe(1);
    expect(videoOnly.photoCount).toBe(0);
    expect(videoOnly.cover).toBeNull(); // a video never becomes the thumbnail
    expect((byId.get(ids.none) as any).videoCount).toBe(0);
  });
});
