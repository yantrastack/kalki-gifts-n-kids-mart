import { randomUUID } from 'node:crypto';
import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { desc } from 'drizzle-orm';
import { parseSupplier, type SupplierErrors, supplierErrorMessage } from '@/lib/supplierValidation';
import type { Supplier } from '@/db/schema';

export async function GET() {
  const rows = await db.select().from(schema.suppliers).orderBy(desc(schema.suppliers.spend));
  return NextResponse.json(rows);
}
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object')
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  try {
    // Duplicate check + insert in one write transaction, so concurrent saves can't both pass.
    const result = await db.transaction(
      async (
        tx,
      ): Promise<{
        row?: Supplier;
        errors?: SupplierErrors;
      }> => {
        const others = await tx
          .select({
            name: schema.suppliers.name,
            email: schema.suppliers.email,
            phone: schema.suppliers.phone,
          })
          .from(schema.suppliers);
        const parsed = parseSupplier(b, others);
        if (!parsed.data) return { errors: parsed.errors };
        const row: Supplier = {
          // Always server-generated: a client-supplied id could collide with an existing row.
          id: `s${Date.now().toString(36)}${randomUUID().slice(0, 4)}`,
          name: parsed.data.name,
          contact: parsed.data.contact || null,
          email: parsed.data.email,
          phone: parsed.data.phone,
          onTime: 0,
          lastOrder: null,
          spend: 0,
        };
        await tx.insert(schema.suppliers).values(row);
        return { row };
      },
    );
    if (result.errors)
      return NextResponse.json(
        { error: supplierErrorMessage(result.errors), errors: result.errors },
        { status: 400 },
      );
    return NextResponse.json(result.row, { status: 201 });
  } catch (e) {
    console.error('POST /api/suppliers failed', e);
    return NextResponse.json({ error: 'Could not save supplier' }, { status: 500 });
  }
}
