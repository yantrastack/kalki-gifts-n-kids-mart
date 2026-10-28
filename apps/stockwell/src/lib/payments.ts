// Payment rules shared by the API routes, the seed and the admin pages. Pure
// functions only (no DB), so the money logic is unit-testable on its own.
//
// Money is handled in integer paise. Invoice totals are stored as rupees (REAL)
// for now, so they are converted at the boundary with Math.round(total * 100).

export const PAYMENT_METHODS = ['cash', 'upi', 'card', 'bank_transfer', 'cheque'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type PaymentDirection = 'payment' | 'refund';
export type PayStatus = 'paid' | 'partial' | 'unpaid';
export type SaleTerms = 'immediate' | 'credit';
export type DisplayStatus = PayStatus | 'overdue' | 'void';

// Credit, ACH, invoice and wallet are deliberately not payment methods.
export function isPaymentMethod(v: unknown): v is PaymentMethod {
  return typeof v === 'string' && (PAYMENT_METHODS as readonly string[]).includes(v);
}

// Today's calendar date in India (IST, UTC+5:30) as YYYY-MM-DD. Overdue is
// judged on this day boundary, not on the server's timezone.
export function todayIST(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
}

export function isIsoDate(v: unknown): v is string {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

// Rupees (a JSON number) to whole paise. Returns null for anything that is not a
// finite number with at most two decimal places, so 10.005 is rejected rather
// than silently rounded.
export function rupeesToPaise(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null;
  const paise = Math.round(v * 100);
  if (Math.abs(v * 100 - paise) > 1e-6) return null;
  return paise;
}

export const paiseToRupees = (paise: number) => paise / 100;

export const newPaymentId = () =>
  `PAY-${Date.now().toString(36).toUpperCase()}${globalThis.crypto.randomUUID().slice(0, 4).toUpperCase()}`;

export type MoneyRow = { direction: string; amountPaise: number };

export type InvoiceSummary = {
  totalPaise: number;
  paidPaise: number;
  refundedPaise: number;
  netPaidPaise: number;
  balancePaise: number;
  paidAmount: number;
  balance: number;
  payStatus: PayStatus;
  isOverdue: boolean;
  displayStatus: DisplayStatus;
};

export const isVoid = (status: string | null | undefined) => status === 'void';

// paidAmount = payments - refunds (the cash actually kept, shown for information)
// balance    = total - payments
// payStatus  = paid when nothing is owed, partial when cash is kept, else unpaid
// overdue    = balance > 0 and a due date earlier than today (never stored)
//
// Refunds do not raise the balance. A refund here always pays back money for
// goods the customer returned, so the customer owes nothing more: the returned
// goods come off what they owe just as the refund comes off what they paid.
// (Counting it as "paid less" would show a customer who returned an item as
// owing the refund.) Because balance ignores refunds, a refund also can't be
// collected again as a new payment.
export function summarizeInvoice(
  inv: { total: number | null; dueDate: string | null; status?: string | null },
  rows: MoneyRow[],
  today: string = todayIST(),
): InvoiceSummary {
  const totalPaise = Math.round((inv.total ?? 0) * 100);
  let paidPaise = 0;
  let refundedPaise = 0;
  for (const r of rows) {
    if (r.direction === 'refund') refundedPaise += r.amountPaise;
    else paidPaise += r.amountPaise;
  }
  const netPaidPaise = paidPaise - refundedPaise;
  const rawBalance = totalPaise - paidPaise;
  const balancePaise = Math.max(0, rawBalance);
  const payStatus: PayStatus = rawBalance <= 0 ? 'paid' : netPaidPaise > 0 ? 'partial' : 'unpaid';
  const voided = isVoid(inv.status);
  const isOverdue = !voided && balancePaise > 0 && !!inv.dueDate && inv.dueDate < today;
  return {
    totalPaise,
    paidPaise,
    refundedPaise,
    netPaidPaise,
    balancePaise,
    paidAmount: paiseToRupees(netPaidPaise),
    balance: paiseToRupees(balancePaise),
    payStatus,
    isOverdue,
    displayStatus: voided ? 'void' : isOverdue ? 'overdue' : payStatus,
  };
}

export type SalePaymentInput = {
  method: unknown;
  amountPaise: unknown;
  reference?: unknown;
};
export type SalePayment = { method: PaymentMethod; amountPaise: number; reference: string | null };

export type SalePaymentPlan =
  | { ok: true; payments: SalePayment[]; paidPaise: number; changePaise: number }
  | { ok: false; error: string };

const MAX_REFERENCE = 120;

// Validates the tender for a POS sale.
//   immediate: payments must cover the total. Only cash may exceed it, and the
//              excess is handed back as change (taken out of the cash rows, so
//              the stored payments add up to exactly the total).
//   credit:    goods now, pay later. Zero or a partial down payment, never more
//              than the total, and no change.
export function planSalePayments(
  totalPaise: number,
  terms: SaleTerms,
  input: SalePaymentInput[],
): SalePaymentPlan {
  const rows: SalePayment[] = [];
  for (const p of input) {
    if (!isPaymentMethod(p.method))
      return {
        ok: false,
        error: 'Unknown payment method. Use cash, UPI, card, bank transfer or cheque.',
      };
    const paise = p.amountPaise;
    if (typeof paise !== 'number' || !Number.isInteger(paise) || paise <= 0)
      return {
        ok: false,
        error: 'Each payment amount must be greater than zero, with at most two decimals.',
      };
    let reference: string | null = null;
    if (p.reference != null && p.reference !== '') {
      if (typeof p.reference !== 'string' || p.reference.length > MAX_REFERENCE)
        return {
          ok: false,
          error: `Payment reference must be ${MAX_REFERENCE} characters or fewer.`,
        };
      reference = p.reference.trim() || null;
    }
    rows.push({ method: p.method, amountPaise: paise, reference });
  }

  const sum = rows.reduce((s, r) => s + r.amountPaise, 0);

  if (terms === 'credit') {
    if (sum > totalPaise)
      return { ok: false, error: 'Payments on a credit sale cannot exceed the total.' };
    return { ok: true, payments: rows, paidPaise: sum, changePaise: 0 };
  }

  if (sum < totalPaise) return { ok: false, error: 'Payments add up to less than the total.' };
  if (sum === totalPaise) return { ok: true, payments: rows, paidPaise: sum, changePaise: 0 };

  const excess = sum - totalPaise;
  const cash = rows.filter((r) => r.method === 'cash').reduce((s, r) => s + r.amountPaise, 0);
  if (cash < excess)
    return { ok: false, error: 'Only cash can be more than the total, to give change.' };

  let toRemove = excess;
  const adjusted = [...rows];
  for (let i = adjusted.length - 1; i >= 0 && toRemove > 0; i--) {
    if (adjusted[i].method !== 'cash') continue;
    const take = Math.min(adjusted[i].amountPaise, toRemove);
    adjusted[i] = { ...adjusted[i], amountPaise: adjusted[i].amountPaise - take };
    toRemove -= take;
  }
  const kept = adjusted.filter((r) => r.amountPaise > 0);
  return {
    ok: true,
    payments: kept,
    paidPaise: kept.reduce((s, r) => s + r.amountPaise, 0),
    changePaise: excess,
  };
}
