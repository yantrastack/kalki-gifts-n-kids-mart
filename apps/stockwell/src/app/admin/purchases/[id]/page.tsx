'use client';
import { use } from 'react';
import PurchaseForm from '../PurchaseForm';

export default function EditPurchasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <PurchaseForm poId={decodeURIComponent(id)} />;
}
