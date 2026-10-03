import { type NextRequest, NextResponse } from 'next/server';
import { db, schema } from '@/db/client';
import { desc } from 'drizzle-orm';
import { customerErrorMessage, parseCustomer } from '@/lib/customerValidation';

export async function GET() {
  const rows = await db.select().from(schema.customers).orderBy(desc(schema.customers.spend));
  return NextResponse.json(rows);
}
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null);
  if (!b || typeof b !== 'object')
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  try {
    // Same Zod schema as the admin form; the client check is a convenience, this is the
    // gate. Duplicate check + insert run in one write transaction, so concurrent saves
    // of the same email/phone can't both pass.
    const result = await db.transaction(async (tx) => {
      const others = await tx
        .select({ email: schema.customers.email, phone: schema.customers.phone })
        .from(schema.customers);
      const { data, errors } = parseCustomer(b, others);
      if (!data) return { errors };
      const row = {
        id: b.id || `c${Date.now().toString(36)}`,
        name: data.name,
        type: data.type,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        orders: Number(b.orders) || 0,
        spend: Number(b.spend) || 0,
        lastOrder: b.lastOrder || null,
        balance: Number(b.balance) || 0,
        color: b.color || null,
      };
      await tx.insert(schema.customers).values(row);
      return { row };
    });
    if (result.errors)
      return NextResponse.json(
        { error: customerErrorMessage(result.errors), errors: result.errors },
        { status: 400 },
      );
    return NextResponse.json(result.row, { status: 201 });
  } catch (e) {
    console.error('POST /api/customers failed', e);
    return NextResponse.json({ error: 'Could not save customer' }, { status: 500 });
  }
}
