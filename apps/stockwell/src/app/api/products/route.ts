import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { deriveStatus } from '@/lib/status';
import {
  CatalogError,
  assertSkuUnique,
  isSellable,
  missingForActivation,
  normaliseSku,
} from '@/lib/catalog';
import { like, or, eq, and, desc, sql } from 'drizzle-orm';
import { csvToList, productBadgeKey } from '@stockwell/shared';

// Gift tags arrive as a CSV string (or a list); store them trimmed, lower-cased and de-duplicated.
const giftCsv = (v: unknown): string | null => {
  const list = csvToList(Array.isArray(v) ? v.join(',') : typeof v === 'string' ? v : '');
  return list.length ? [...new Set(list)].join(',') : null;
};
const giftAge = (v: unknown): number | null =>
  v === '' || v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Math.trunc(Number(v)));

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q')?.trim();
  const category = searchParams.get('category');
  const status = searchParams.get('status');
  const warehouse = searchParams.get('warehouse');
  const lifecycle = searchParams.get('lifecycle');
  const sellable = searchParams.get('sellable') === '1';

  const conditions = [];
  if (q)
    conditions.push(
      or(
        like(schema.products.name, `%${q}%`),
        like(schema.products.sku, `%${q}%`),
        like(schema.products.barcode, `%${q}%`),
      ),
    );
  if (category && category !== 'all') conditions.push(eq(schema.products.category, category));
  if (status && status !== 'all') conditions.push(eq(schema.products.status, status));
  if (warehouse && warehouse !== 'all') conditions.push(eq(schema.products.warehouse, warehouse));
  if (lifecycle && lifecycle !== 'all') conditions.push(eq(schema.products.lifecycle, lifecycle));

  const rows = await db
    .select()
    .from(schema.products)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(schema.products.updatedAt));
  const filtered = sellable ? rows.filter((p) => isSellable(p as any)) : rows;

  // Photo count per product, so the admin can flag products with too few photos.
  const counts = await db
    .select({ productId: schema.productMedia.productId, n: sql<number>`count(*)` })
    .from(schema.productMedia)
    .where(eq(schema.productMedia.type, 'image'))
    .groupBy(schema.productMedia.productId);
  const photos = new Map(counts.map((c) => [c.productId, Number(c.n)]));
  return NextResponse.json(filtered.map((p) => ({ ...p, photoCount: photos.get(p.id) ?? 0 })));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !body.sku)
    return NextResponse.json({ error: 'name and sku are required' }, { status: 400 });

  try {
    await assertSkuUnique(body.sku, undefined, async (normalised) => {
      const existing = await db
        .select({ id: schema.products.id })
        .from(schema.products)
        .where(sql`UPPER(TRIM(${schema.products.sku})) = ${normalised}`)
        .get();
      return existing;
    });
  } catch (e) {
    if (e instanceof CatalogError) {
      return NextResponse.json({ error: e.message }, { status: 409 });
    }
    throw e;
  }

  const id = body.id || `p${Date.now().toString(36)}`;
  const stock = Number(body.stock) || 0;
  const now = new Date().toISOString();
  const candidate = {
    name: body.name,
    sku: normaliseSku(body.sku),
    category: body.category || null,
    price: body.price != null ? Number(body.price) : null,
    cost: body.cost != null ? Number(body.cost) : null,
    gstRate: body.gstRate != null ? Number(body.gstRate) : null,
    hsnCode: body.hsnCode || null,
  };

  // A new product has no photos yet (they upload once it has an id), so publishing in
  // the same request is refused for `photos`. The admin creates a draft, uploads, then
  // activates via POST /api/products/[id]/lifecycle. YAN-109.
  const activate = !!body.activate;
  if (activate) {
    const missing = missingForActivation(candidate, { imageCount: 0 });
    if (missing.length)
      return NextResponse.json({ error: 'Incomplete product', missing }, { status: 400 });
  }

  const row = {
    id,
    name: body.name,
    sku: body.sku,
    barcode: body.barcode || null,
    category: body.category || null,
    brand: body.brand || null,
    price: Number(body.price) || 0,
    cost: Number(body.cost) || 0,
    stock,
    reserved: Number(body.reserved) || 0,
    incoming: Number(body.incoming) || 0,
    damaged: Number(body.damaged) || 0,
    warehouse: body.warehouse || null,
    supplier: body.supplier || null,
    status: deriveStatus(stock),
    lifecycle: activate ? 'active' : 'draft',
    // Badge code ("Kids favourite" → "kids-favourite"); the storefront translates it.
    tag: productBadgeKey(typeof body.tag === 'string' ? body.tag : null),
    hsnCode: body.hsnCode || null,
    gstRate: body.gstRate != null ? Number(body.gstRate) : null,
    giftOccasions: giftCsv(body.giftOccasions),
    giftRecipients: giftCsv(body.giftRecipients),
    giftTypes: giftCsv(body.giftTypes),
    giftInterests: giftCsv(body.giftInterests),
    giftAgeMin: giftAge(body.giftAgeMin),
    giftAgeMax: giftAge(body.giftAgeMax),
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(schema.products).values(row as any);
  return NextResponse.json(row, { status: 201 });
}
