import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { PRODUCT_EVENT_TYPES, type ProductEventType } from '@stockwell/shared';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new NextResponse(null, { headers: CORS });
}

const VALID = new Set<string>(PRODUCT_EVENT_TYPES);

// Public: record a storefront engagement event (view/like/unlike/share/buy/open).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const productId = String(body.productId || '');
  const type = String(body.type || '') as ProductEventType;
  const sessionId = body.sessionId ? String(body.sessionId).slice(0, 64) : null;

  if (!productId || !VALID.has(type)) {
    return NextResponse.json(
      { error: 'productId and a valid type are required' },
      { status: 400, headers: CORS },
    );
  }

  await db.insert(schema.productEvents).values({ productId, type, sessionId } as any);
  return NextResponse.json({ ok: true }, { headers: CORS });
}
