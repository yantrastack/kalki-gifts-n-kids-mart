import { NextResponse } from 'next/server';
import { getGiftOptions } from '@/lib/giftOptions';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' };

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

// Public: the occasion / gift-type choices for the storefront's Find a gift screen. Custom
// values only appear once a sellable (active, in-stock) product carries them.
export async function GET() {
  return NextResponse.json(await getGiftOptions({ publicOnly: true }), { headers: CORS });
}
