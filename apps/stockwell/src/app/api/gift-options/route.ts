import { NextResponse } from 'next/server';
import { getGiftOptions } from '@/lib/giftOptions';

// Admin: built-in occasions/gift types plus every custom one used on any product
// (drafts included), for the product forms.
export async function GET() {
  return NextResponse.json(await getGiftOptions({ publicOnly: false }));
}
