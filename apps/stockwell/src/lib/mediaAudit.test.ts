import { describe, expect, it } from 'vitest';
import { type AuditMedia, type AuditProduct, auditMedia, seedFileOf } from './mediaAudit';

// YAN-112: a DB seeded before YAN-101 still points at deleted seed files; repair only product_media.

const product = (id: string, stock = 5, lifecycle = 'active'): AuditProduct => ({
  id,
  name: id,
  stock,
  lifecycle,
});
const row = (id: string, productId: string, url: string, sortOrder = 0): AuditMedia => ({
  id,
  productId,
  url,
  type: 'image',
  sortOrder,
});

const SEED_FILES = ['p5-a.jpg', 'p9-a.jpg', 'p18-a.jpg', 'p18-b.jpg', 'p18-c.jpg'];

describe('seedFileOf', () => {
  it('reads the file name of a /seed/ URL only', () => {
    expect(seedFileOf('/seed/p9-a.jpg')).toBe('p9-a.jpg');
    expect(seedFileOf('/seed/p9-a.jpg?v=2')).toBe('p9-a.jpg');
    expect(seedFileOf('/uploads/abc.jpg')).toBeNull();
    expect(seedFileOf('https://res.cloudinary.com/x/seed/p9-a.jpg')).toBeNull();
    expect(seedFileOf('/seed/../secret')).toBeNull();
  });
});

describe('auditMedia', () => {
  it('finds dead seed rows from an old seed and refills the product with the current photo', () => {
    const products = [product('p5'), product('p1')];
    const media = [
      row('p5m1', 'p5', '/seed/p5-a.jpg'), // still shipped
      row('p5m2', 'p5', '/seed/p5-b.jpg', 1), // deleted in YAN-101
      row('p1m1', 'p1', '/seed/p1-a.jpg'), // deleted in YAN-101, p1 has no current seed photo
    ];
    const a = auditMedia(products, media, SEED_FILES);
    expect(a.deadSeed.map((m) => m.id)).toEqual(['p5m2', 'p1m1']);
    expect(a.toDelete.map((m) => m.id)).toEqual(['p5m2', 'p1m1']);
    // p5 keeps its live cover, so nothing is inserted for it.
    expect(a.toInsert).toEqual([]);
    expect(a.visibleWithoutMedia.map((p) => p.id)).toEqual(['p1']);
    expect(a.stillWithoutMedia.map((p) => p.id)).toEqual(['p1']);
  });

  it('replaces a dead row that reuses a current seed row ID', () => {
    // p9m1 pointed at an old file name; the current seed row has the same stable ID.
    const a = auditMedia([product('p9')], [row('p9m1', 'p9', '/seed/p9-old.jpg')], SEED_FILES);
    expect(a.toDelete.map((m) => m.id)).toEqual(['p9m1']);
    expect(a.toInsert).toEqual([
      { id: 'p9m1', productId: 'p9', url: '/seed/p9-a.jpg', type: 'image', sortOrder: 0 },
    ]);
    expect(a.visibleWithoutMedia.map((p) => p.id)).toEqual(['p9']);
    expect(a.stillWithoutMedia).toEqual([]);
  });

  it('restores a full seed gallery in order for a product with no media', () => {
    const a = auditMedia([product('p18', 0)], [], SEED_FILES);
    expect(a.toInsert.map((r) => [r.id, r.url, r.sortOrder])).toEqual([
      ['p18m1', '/seed/p18-a.jpg', 0],
      ['p18m2', '/seed/p18-b.jpg', 1],
      ['p18m3', '/seed/p18-c.jpg', 2],
    ]);
    // Out of stock: not visible, so not reported as a storefront gap.
    expect(a.visibleWithoutMedia).toEqual([]);
  });

  it('never touches admin uploads or remote URLs, and leaves their gallery alone', () => {
    const media = [
      row('u1', 'p9', '/uploads/shop-photo.jpg'),
      row('u2', 'p9', 'https://res.cloudinary.com/demo/image/upload/x.jpg', 1),
    ];
    const a = auditMedia([product('p9')], media, SEED_FILES);
    expect(a.toDelete).toEqual([]);
    expect(a.toInsert).toEqual([]);
    expect(a.visibleWithoutMedia).toEqual([]);
  });

  it('reports orphan rows and deletes them', () => {
    const a = auditMedia([product('p9')], [row('x1', 'gone', '/uploads/a.jpg')], SEED_FILES);
    expect(a.orphans.map((m) => m.id)).toEqual(['x1']);
    expect(a.toDelete.map((m) => m.id)).toEqual(['x1']);
  });

  it('only counts active, in-stock products as visible; ignores non-seed products for inserts', () => {
    const products = [product('draft1', 5, 'draft'), product('custom'), product('p8', 0)];
    const a = auditMedia(products, [], SEED_FILES);
    expect(a.visibleWithoutMedia.map((p) => p.id)).toEqual(['custom']);
    expect(a.toInsert).toEqual([]);
  });

  it('is idempotent: applying the plan and re-auditing finds nothing to do', () => {
    const products = [product('p5'), product('p9'), product('p18')];
    const media = [row('p5m9', 'p5', '/seed/p5-z.jpg')];
    const first = auditMedia(products, media, SEED_FILES);
    const deleted = new Set(first.toDelete.map((m) => m.id));
    const after = [...media.filter((m) => !deleted.has(m.id)), ...first.toInsert];
    const second = auditMedia(products, after, SEED_FILES);
    expect(second.toDelete).toEqual([]);
    expect(second.toInsert).toEqual([]);
  });
});
