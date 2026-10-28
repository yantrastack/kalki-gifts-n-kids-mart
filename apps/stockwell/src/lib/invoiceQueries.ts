import { desc, inArray } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { isVoid, summarizeInvoice, type PayStatus, type InvoiceSummary } from '@/lib/payments';

type InvoiceRow = typeof schema.invoices.$inferSelect;
type PaymentRow = typeof schema.payments.$inferSelect;

// The invoice as the API returns it. `paid` and `method` are deprecated columns
// (see schema.ts) and are left out on purpose so nothing reads stale values; use
// paidAmount / balance / payStatus / isOverdue / displayStatus instead.
export type InvoiceView = Omit<InvoiceRow, 'paid' | 'method'> &
  Pick<InvoiceSummary, 'paidAmount' | 'balance' | 'payStatus' | 'isOverdue' | 'displayStatus'>;

export async function paymentsByInvoice(invoiceIds?: string[]): Promise<Map<string, PaymentRow[]>> {
  let rows: PaymentRow[];
  if (invoiceIds && invoiceIds.length === 0) rows = [];
  else if (invoiceIds && invoiceIds.length <= 500)
    rows = await db
      .select()
      .from(schema.payments)
      .where(inArray(schema.payments.invoiceId, invoiceIds))
      .all();
  else rows = await db.select().from(schema.payments).all();

  const byInvoice = new Map<string, PaymentRow[]>();
  for (const r of rows) {
    const list = byInvoice.get(r.invoiceId) ?? [];
    list.push(r);
    byInvoice.set(r.invoiceId, list);
  }
  return byInvoice;
}

export function toInvoiceView(inv: InvoiceRow, rows: PaymentRow[], today?: string): InvoiceView {
  const s = summarizeInvoice(inv, rows, today);
  const { paid: _paid, method: _method, ...rest } = inv;
  return {
    ...rest,
    paidAmount: s.paidAmount,
    balance: s.balance,
    payStatus: s.payStatus,
    isOverdue: s.isOverdue,
    displayStatus: s.displayStatus,
  };
}

export async function listInvoiceViews(): Promise<InvoiceView[]> {
  const [invoices, pays] = await Promise.all([
    db
      .select()
      .from(schema.invoices)
      .orderBy(desc(schema.invoices.issueDate), desc(schema.invoices.id))
      .all(),
    paymentsByInvoice(),
  ]);
  return invoices.map((i) => toInvoiceView(i, pays.get(i.id) ?? []));
}

// Outstanding rupees per registered customer: the sum of balances on their
// live (non-void) invoices. This replaces the old stored customers.balance.
export async function customerBalances(): Promise<Map<string, number>> {
  const [invoices, pays] = await Promise.all([
    db.select().from(schema.invoices).all(),
    paymentsByInvoice(),
  ]);
  const paiseByCustomer = new Map<string, number>();
  for (const inv of invoices) {
    if (!inv.customerId || isVoid(inv.status)) continue;
    const s = summarizeInvoice(inv, pays.get(inv.id) ?? []);
    paiseByCustomer.set(
      inv.customerId,
      (paiseByCustomer.get(inv.customerId) ?? 0) + s.balancePaise,
    );
  }
  return new Map([...paiseByCustomer].map(([id, paise]) => [id, paise / 100]));
}

// Payment status of each sales order, taken from the invoice raised for it.
export async function salesOrderPayStatuses(): Promise<Map<string, PayStatus>> {
  const [invoices, pays] = await Promise.all([
    db.select().from(schema.invoices).all(),
    paymentsByInvoice(),
  ]);
  const out = new Map<string, PayStatus>();
  for (const inv of invoices) {
    if (!inv.salesOrderId) continue;
    out.set(inv.salesOrderId, summarizeInvoice(inv, pays.get(inv.id) ?? []).payStatus);
  }
  return out;
}
