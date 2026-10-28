import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { canTransition, missingForActivation, type Lifecycle } from '@/lib/catalog';
import { eq } from 'drizzle-orm';

const VALID: Lifecycle[] = ['draft', 'active', 'discontinued'];

// Transition a product's lifecycle (draft -> active -> discontinued, or
// discontinued -> active to reactivate). Separate from PUT /api/products/[id]
// so lifecycle changes always go through the activation completeness check.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const to = body.to as Lifecycle;
  if (!VALID.includes(to)) {
    return NextResponse.json({ error: `to must be one of ${VALID.join(', ')}` }, { status: 400 });
  }

  const product = await db.select().from(schema.products).where(eq(schema.products.id, id)).get();
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!canTransition(product.lifecycle as Lifecycle, to)) {
    return NextResponse.json(
      { error: `Cannot move from ${product.lifecycle} to ${to}` },
      { status: 409 },
    );
  }

  if (to === 'active') {
    const missing = missingForActivation(product);
    if (missing.length) {
      return NextResponse.json({ error: 'Incomplete product', missing }, { status: 400 });
    }
  }

  await db
    .update(schema.products)
    .set({ lifecycle: to, updatedAt: new Date().toISOString() } as any)
    .where(eq(schema.products.id, id));
  const row = await db.select().from(schema.products).where(eq(schema.products.id, id)).get();
  return NextResponse.json(row);
}
