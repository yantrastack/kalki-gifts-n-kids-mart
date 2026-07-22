import { NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { desc, asc } from 'drizzle-orm';
import { csvToList, type ShopMedia, type ShopProduct } from '@stockwell/shared';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

// Public storefront catalog: only sellable products, no cost/supplier data.
export async function GET() {
  const [rows, media] = await Promise.all([
    db.select().from(schema.products).orderBy(desc(schema.products.updatedAt)).all(),
    db.select().from(schema.productMedia).orderBy(asc(schema.productMedia.sortOrder)).all(),
  ]);
  const mediaByProduct = new Map<string, ShopMedia[]>();
  for (const m of media) {
    const list = mediaByProduct.get(m.productId) ?? [];
    list.push({ id: m.id, url: m.url, type: m.type === 'video' ? 'video' : 'image' });
    mediaByProduct.set(m.productId, list);
  }
  const items: ShopProduct[] = rows
    .filter((p) => p.status !== 'out' && p.stock > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      category: p.category,
      brand: p.brand,
      inStock: p.stock,
      tag: p.tag,
      media: mediaByProduct.get(p.id) ?? [],
      gift: {
        occasions: csvToList(p.giftOccasions),
        recipients: csvToList(p.giftRecipients),
        ageMin: p.giftAgeMin ?? null,
        ageMax: p.giftAgeMax ?? null,
        types: csvToList(p.giftTypes),
        interests: csvToList(p.giftInterests),
      },
    }));
  return NextResponse.json(items, { headers: CORS });
}
