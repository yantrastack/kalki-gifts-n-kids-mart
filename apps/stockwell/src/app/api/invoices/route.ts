import { NextResponse } from 'next/server';
import { listInvoiceViews } from '@/lib/invoiceQueries';

// Invoices are created only by a POS sale (see api/pos/checkout). There is
// no free-form create endpoint. Each row carries derived payment fields
// (paidAmount, balance, payStatus, isOverdue, displayStatus).
export async function GET() {
  return NextResponse.json(await listInvoiceViews());
}
