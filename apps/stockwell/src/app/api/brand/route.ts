import { NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import type { ShopBrand } from '@stockwell/shared';

// ShopBrand is the public contract consumed by the storefront app;
// plan/seats are extra fields used by Stockwell's own UI.
type BrandPayload = ShopBrand & { plan: string; seats: string };

const DEFAULTS: BrandPayload = {
  appName: 'Stockwell',
  brandInitial: 'S',
  accentColor: '#9a3a3a',
  tagline: 'Inventory & POS',
  plan: 'Growth',
  seats: '1',
  currency: '₹',
  phone: '',
  whatsapp: '',
  address: '',
};
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

// Public: branding shown before login (app name, logo, accent color).
export async function GET() {
  let brand = { ...DEFAULTS };
  try {
    const rows = await db.select().from(schema.settings).all();
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value ?? '';
    brand = {
      appName: map.appName || map.companyName || DEFAULTS.appName,
      brandInitial: map.brandInitial || (map.appName || DEFAULTS.appName).charAt(0).toUpperCase(),
      accentColor: map.accentColor || DEFAULTS.accentColor,
      tagline: map.tagline || DEFAULTS.tagline,
      plan: map.plan || DEFAULTS.plan,
      seats: map.seats || DEFAULTS.seats,
      currency: map.currency || DEFAULTS.currency,
      phone: map.phone || DEFAULTS.phone,
      whatsapp: map.whatsapp || map.phone || DEFAULTS.whatsapp,
      address: map.address || DEFAULTS.address,
    };
  } catch {}
  return NextResponse.json(brand, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}
