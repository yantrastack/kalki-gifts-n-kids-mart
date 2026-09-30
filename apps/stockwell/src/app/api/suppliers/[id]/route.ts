import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { eq, ne } from 'drizzle-orm';
import { parseSupplier, supplierErrorMessage } from '@/lib/supplierValidation';

const findSupplier = (id: string) =>
  db.select().from(schema.suppliers).where(eq(schema.suppliers.id, id)).get();
const notFound = () => NextResponse.json({ error: 'Supplier not found' }, { status: 404 });

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object')
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  try {
    // Duplicate check + update in one write transaction, so concurrent saves can't both pass.
    const result = await db.transaction(async (tx) => {
      const current = await tx
        .select()
        .from(schema.suppliers)
        .where(eq(schema.suppliers.id, id))
        .get();
      if (!current) return { status: 'notFound' as const };
      // Every *other* supplier — this one's own name/email/phone aren't duplicates of itself.
      const others = await tx
        .select({
          name: schema.suppliers.name,
          email: schema.suppliers.email,
          phone: schema.suppliers.phone,
        })
        .from(schema.suppliers)
        .where(ne(schema.suppliers.id, id));
      const parsed = parseSupplier(b, others);
      if (!parsed.data) return { status: 'invalid' as const, errors: parsed.errors };

      const { name, contact, email, phone } = parsed.data;
      // Only the editable fields; on-time %, spend and last order are derived metrics.
      const patch = { name, contact: contact || null, email, phone };
      await tx.update(schema.suppliers).set(patch).where(eq(schema.suppliers.id, id));
      // Products and purchase orders reference suppliers by name (see docs/DATA_MODEL.md),
      // so a rename must carry through or those links break.
      if (name !== current.name) {
        await tx
          .update(schema.products)
          .set({ supplier: name } as any)
          .where(eq(schema.products.supplier, current.name));
        await tx
          .update(schema.purchaseOrders)
          .set({ supplier: name } as any)
          .where(eq(schema.purchaseOrders.supplier, current.name));
      }
      return { status: 'ok' as const, row: { ...current, ...patch } };
    });
    if (result.status === 'notFound') return notFound();
    if (result.status === 'invalid')
      return NextResponse.json(
        { error: supplierErrorMessage(result.errors), errors: result.errors },
        { status: 400 },
      );
    return NextResponse.json(result.row);
  } catch (e) {
    console.error(`PUT /api/suppliers/${id} failed`, e);
    return NextResponse.json({ error: 'Could not save supplier' }, { status: 500 });
  }
}
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    if (!(await findSupplier(id))) return notFound();
    await db.delete(schema.suppliers).where(eq(schema.suppliers.id, id));
  } catch (e) {
    console.error(`DELETE /api/suppliers/${id} failed`, e);
    return NextResponse.json({ error: 'Could not remove supplier' }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
