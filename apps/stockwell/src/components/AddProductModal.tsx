'use client';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import * as UI from './ui';
import { jget } from '@/lib/api';

// Shared "Add product" form — used by the Products page and the purchase
// entry form. Collects full product details; the parent performs the POST.
export default function AddProductModal({ open, onClose, onSubmit, defaults }: any) {
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
  useEffect(() => {
    jget('/api/warehouses').then(setWarehouses);
  }, []);
  useEffect(() => {
    if (open)
      setForm({
        ...empty,
        warehouse: warehouses[0]?.id || '',
        ...(defaults || {}),
      });
  }, [open]);
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));
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
        <label className="field">
          <span>Warehouse</span>
          <select
            className="select"
            value={form.warehouse}
            onChange={(e) => set('warehouse', e.target.value)}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>HSN Code</span>
          <input
            className="input"
            value={form.hsnCode}
            onChange={(e) => set('hsnCode', e.target.value)}
            placeholder="e.g. 8518"
          />
        </label>
        <label className="field">
          <span>GST Rate (%)</span>
          <select
            className="select"
            value={form.gstRate}
            onChange={(e) => set('gstRate', e.target.value)}
          >
            <option value="0">0% (Nil Rated / Exempt)</option>
            <option value="5">5%</option>
            <option value="12">12%</option>
            <option value="18">18%</option>
            <option value="28">28%</option>
          </select>
        </label>
        <label className="field" style={{ gridColumn: '1 / -1' }}>
          <span>Supplier</span>
          <input
            className="input"
            value={form.supplier}
            onChange={(e) => set('supplier', e.target.value)}
          />
        </label>
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
        <button className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn btn-primary"
          onClick={() => onSubmit(form)}
          disabled={!form.name || !form.sku}
        >
          <Icon name="check" size={14} /> Publish product
        </button>
      </div>
    </UI.Modal>
  );
}
