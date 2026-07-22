import { NextResponse } from 'next/server';
import { db, schema } from '@/db/client';

export async function GET() {
  const whs = await db.select().from(schema.warehouses).all();
  const products = await db.select().from(schema.products).all();
  const enriched = whs.map((w) => {
    const ps = products.filter((p) => p.warehouse === w.id);
    const value = ps.reduce((s, p) => s + p.cost * p.stock, 0);
    return { ...w, products: ps.length, value: Math.round(value) };
  });
  return NextResponse.json(enriched);
}
