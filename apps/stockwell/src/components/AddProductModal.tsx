'use client';
import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';
import * as UI from './ui';
import GiftFields, { EMPTY_GIFT, type GiftValue } from './GiftFields';
import MediaPicker from './MediaPicker';
import { jget } from '@/lib/api';
import { useI18n } from '@/i18n';

// Shared "Add product" form — used by the Products page and the purchase
// entry form. Collects full product details; the parent performs the POST.
// With `customizable`, a Customize button reveals photo/video and Gift Finder sections:
// `onSubmit(form, files)` then also gets the gift tags (in `form`) and the chosen files,
// which the parent uploads once the product exists.
export default function AddProductModal({
  open,
  onClose,
  onSubmit,
  defaults,
  customizable = false,
}: any) {
  const { t } = useI18n();
  const empty = {
    name: '',
    sku: '',
    barcode: '',
    category: '',
    brand: '',
    price: '',
    cost: '',
    stock: '',
    warehouse: '',
    supplier: '',
    hsnCode: '',
    gstRate: '18',
  };
  const [form, setForm] = useState<any>(empty);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [customize, setCustomize] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [gift, setGift] = useState<GiftValue>(EMPTY_GIFT);
  const [busy, setBusy] = useState(false);
  const extrasRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    jget('/api/warehouses').then(setWarehouses);
  }, []);
  useEffect(() => {
    if (open) {
      setForm({
        ...empty,
        warehouse: warehouses[0]?.id || '',
        ...(defaults || {}),
      });
      setCustomize(false);
      setFiles([]);
      setGift(EMPTY_GIFT);
    }
  }, [open]);
  useEffect(() => {
    if (customize) extrasRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [customize]);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
  const patchGift = (p: Partial<GiftValue>) => setGift((g) => ({ ...g, ...p }));

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (!customizable) return await onSubmit(form);
      await onSubmit(
        {
          ...form,
          giftOccasions: gift.occasions.join(','),
          giftRecipients: gift.recipients.join(','),
          giftTypes: gift.types.join(','),
          giftInterests: gift.interests,
          giftAgeMin: gift.ageMin === '' ? null : Number(gift.ageMin),
          giftAgeMax: gift.ageMax === '' ? null : Number(gift.ageMax),
        },
        files,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <UI.Modal open={open} onClose={onClose} large>
      <div
        style={{
          padding: 'var(--s-4) var(--s-5)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 'var(--t-lg)', fontWeight: 600 }}>Add product</h3>
        <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <div
        style={{
          padding: 'var(--s-5)',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 14,
          maxHeight: '60vh',
          overflow: 'auto',
        }}
      >
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Product name *</span>
          <input
            className="input"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Aurora Wireless Headphones"
            autoFocus
          />
        </label>
        <label className="field">
          <span>SKU *</span>
          <input
            className="input"
            value={form.sku}
            onChange={(e) => set('sku', e.target.value)}
            placeholder="AUR-WH-001"
          />
        </label>
        <label className="field">
          <span>Barcode</span>
          <input
            className="input"
            value={form.barcode}
            onChange={(e) => set('barcode', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Category</span>
          <input
            className="input"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            placeholder="Toys"
          />
        </label>
        <label className="field">
          <span>Brand</span>
          <input
            className="input"
            value={form.brand}
            onChange={(e) => set('brand', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Retail price</span>
          <input
            className="input"
            type="number"
            value={form.price}
            onChange={(e) => set('price', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Cost</span>
          <input
            className="input"
            type="number"
            value={form.cost}
            onChange={(e) => set('cost', e.target.value)}
          />
        </label>
        <label className="field">
          <span>Opening stock</span>
          <input
            className="input"
            type="number"
            value={form.stock}
            onChange={(e) => set('stock', e.target.value)}
          />
        </label>
        <div className="field">
          <span>Warehouse</span>
          <UI.Select
            aria-label="Warehouse"
            value={form.warehouse}
            onChange={(v) => set('warehouse', v)}
            options={warehouses.map((w) => ({ value: w.id, label: w.name }))}
          />
        </div>
        <label className="field">
          <span>HSN Code</span>
          <input
            className="input"
            value={form.hsnCode}
            onChange={(e) => set('hsnCode', e.target.value)}
            placeholder="e.g. 8518"
          />
        </label>
        <div className="field">
          <span>GST Rate (%)</span>
          <UI.Select
            aria-label="GST Rate"
            value={form.gstRate}
            onChange={(v) => set('gstRate', v)}
            options={[
              { value: '0', label: '0% (Nil Rated / Exempt)' },
              { value: '5', label: '5%' },
              { value: '12', label: '12%' },
              { value: '18', label: '18%' },
              { value: '28', label: '28%' },
            ]}
          />
        </div>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Supplier</span>
          <input
            className="input"
            value={form.supplier}
            onChange={(e) => set('supplier', e.target.value)}
          />
        </label>
        {customizable && (
          // Kept mounted while hidden so nothing typed or chosen is lost.
          <div
            ref={extrasRef}
            id="add-product-extras"
            style={{
              gridColumn: '1 / -1',
              display: customize ? 'grid' : 'none',
              gap: 22,
              paddingTop: 6,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <MediaPicker files={files} onChange={setFiles} disabled={busy} />
            <GiftFields value={gift} onChange={patchGift} />
          </div>
        )}
      </div>
      <div
        style={{
          padding: 'var(--s-3) var(--s-5)',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: 8,
          justifyContent: 'flex-end',
          background: 'var(--bg-muted)',
        }}
      >
        {customizable && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ marginRight: 'auto' }}
            aria-expanded={customize}
            aria-controls="add-product-extras"
            onClick={() => setCustomize((c) => !c)}
          >
            <Icon name="settings" size={14} />{' '}
            {customize ? t('productForm.hideCustomize') : t('productForm.customize')}
          </button>
        )}
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={!form.name || !form.sku || busy}
        >
          <Icon name="check" size={14} /> {busy ? t('productForm.publishing') : 'Publish product'}
        </button>
      </div>
    </UI.Modal>
  );
}
