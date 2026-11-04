import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { SEED_MEDIA, seedMediaRows } from './seedMedia';

// Throwaway in-memory DB; must be set before anything imports @/db/client.
process.env.DATABASE_URL = ':memory:';

// YAN-101 follow-up: seeded products must carry real, licensed photos that reach the storefront.

const root = process.cwd(); // apps/stockwell
const seedDir = path.join(root, 'public/seed');
const seedSource = readFileSync(path.join(root, 'src/db/seed.ts'), 'utf8');
const productNames = new Map(
  [...seedSource.matchAll(/^ {4}id: '(p\d+)',\r?\n {4}name: '([^']+)'/gm)].map((m) => [m[1], m[2]]),
);
const mediaDoc = readFileSync(path.join(root, 'docs/MEDIA.md'), 'utf8');

/** Width/height from a baseline or progressive JPEG's SOF marker. */
function jpegSize(buf: Buffer) {
  expect(buf.readUInt16BE(0)).toBe(0xffd8);
  let i = 2;
  while (i < buf.length) {
    const marker = buf.readUInt16BE(i);
    const len = buf.readUInt16BE(i + 2);
    if (marker >= 0xffc0 && marker <= 0xffc2) {
      return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error('no SOF marker');
}

const entries = Object.entries(SEED_MEDIA).flatMap(([id, list]) => list.map((m) => ({ id, ...m })));

describe('seed media files', () => {
  it('reads all 20 seed products (guards the name lookup below)', () => {
    expect(productNames.size).toBe(20);
    expect(productNames.get('p9')).toBe('Minimalist Wall Clock');
  });

  it('covers the six home-grid products that had no photo, except the lights', () => {
    for (const id of ['p9', 'p11', 'p12', 'p13', 'p14']) expect(SEED_MEDIA[id]?.length).toBe(1);
    // No CC0 photo of copper-wire fairy lights as a product was found: placeholder on purpose.
    expect(SEED_MEDIA.p10).toBeUndefined();
  });

  it('gives the chess set a three-photo gallery in a stable order', () => {
    expect(seedMediaRows(['p18'])).toEqual([
      { id: 'p18m1', productId: 'p18', url: '/seed/p18-a.jpg', type: 'image', sortOrder: 0 },
      { id: 'p18m2', productId: 'p18', url: '/seed/p18-b.jpg', type: 'image', sortOrder: 1 },
      { id: 'p18m3', productId: 'p18', url: '/seed/p18-c.jpg', type: 'image', sortOrder: 2 },
    ]);
  });

  it('never uses more than three photos, and names them a, b, c in gallery order', () => {
    for (const [id, list] of Object.entries(SEED_MEDIA)) {
      const photos = list.filter((m) => m.type === 'image').map((m) => m.file);
      expect(photos.length).toBeLessThanOrEqual(3);
      expect(photos).toEqual(['a', 'b', 'c'].slice(0, photos.length).map((s) => `${id}-${s}.jpg`));
    }
  });

  it('is repeatable: row IDs are unique and stable, so a reseed never duplicates media', () => {
    const ids = Object.keys(SEED_MEDIA);
    const first = seedMediaRows(ids);
    expect(seedMediaRows(ids)).toEqual(first);
    expect(new Set(first.map((r) => r.id)).size).toBe(first.length);
  });

  it('records every seed product without a photo as an exception, with a reason (YAN-112)', () => {
    const exceptions = mediaDoc.split('### Products without a photo (exceptions)')[1] ?? '';
    for (const [id, name] of productNames) {
      if (SEED_MEDIA[id]) continue;
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(exceptions).toMatch(new RegExp(`\\| ${id} \\| ${escaped} \\| \\S`));
    }
  });

  it.each(entries)('$file belongs to a real seed product and is recorded', ({ id, file }) => {
    expect(productNames.has(id)).toBe(true);
    expect(file.startsWith(`${id}-`)).toBe(true);
    expect(mediaDoc).toContain(`| ${file} | ${productNames.get(id)} |`);
  });

  it.each(entries)('$file is a square JPEG of at least 1200 px', ({ file }) => {
    const { width, height } = jpegSize(readFileSync(path.join(seedDir, file)));
    expect(width).toBe(height);
    expect(width).toBeGreaterThanOrEqual(1200);
  });

  it('has no orphan files and no duplicate photos', () => {
    const onDisk = readdirSync(seedDir).filter((f) => !f.startsWith('.'));
    expect(onDisk.sort()).toEqual(entries.map((e) => e.file).sort());
    const hashes = onDisk.map((f) =>
      createHash('sha1')
        .update(readFileSync(path.join(seedDir, f)))
        .digest('hex'),
    );
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});

describe('seed media through GET /api/shop/products', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any[];

  beforeAll(async () => {
    const { migrate } = await import('drizzle-orm/libsql/migrator');
    const { db, schema } = await import('@/db/client');
    await migrate(db, { migrationsFolder: path.resolve(root, 'drizzle') });
    const product = (id: string, sku: string) => ({
      id,
      name: productNames.get(id) ?? id,
      sku,
      price: 100,
      stock: 5,
      lifecycle: 'active',
    });
    await db
      .insert(schema.products)
      .values([product('p9', 'SM-9'), product('p10', 'SM-10'), product('p18', 'SM-18')] as any);
    // Insert out of order: the API must still return the gallery by sortOrder.
    await db
      .insert(schema.productMedia)
      .values(seedMediaRows(['p9', 'p10', 'p18']).reverse() as any);
    const { GET } = await import('@/app/api/shop/products/route');
    const { NextRequest } = await import('next/server');
    body = await (await GET(new NextRequest('http://localhost/api/shop/products'))).json();
  });

  it('returns the seeded photo as the product cover', () => {
    const clock = body.find((p) => p.id === 'p9');
    expect(clock.media).toEqual([{ id: 'p9m1', url: '/seed/p9-a.jpg', type: 'image' }]);
  });

  it('returns all three chess photos, cover first', () => {
    expect(body.find((p) => p.id === 'p18').media.map((m: any) => m.url)).toEqual([
      '/seed/p18-a.jpg',
      '/seed/p18-b.jpg',
      '/seed/p18-c.jpg',
    ]);
  });

  it('returns no media for a product without a verified photo (storefront shows placeholder)', () => {
    expect(body.find((p) => p.id === 'p10').media).toEqual([]);
  });
});
