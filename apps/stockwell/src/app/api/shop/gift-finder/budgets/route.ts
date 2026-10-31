import { NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { countByBudget } from '@stockwell/shared';
import { isPublic } from '@/lib/catalog';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

/**
 * Public: how many giftable (public, in-stock) products fall in each budget
 * preset, so the storefront can hide presets that would return nothing.
 * Uses the same eligibility rule as the gift finder itself.
 */
export async function GET() {
  const rows = await db
    .select({
      price: schema.products.price,
      stock: schema.products.stock,
      lifecycle: schema.products.lifecycle,
    })
    .from(schema.products)
    .all();
  const prices = rows.filter((p) => isPublic(p as any) && p.stock > 0).map((p) => p.price);
  return NextResponse.json(countByBudget(prices), { headers: CORS });
}
