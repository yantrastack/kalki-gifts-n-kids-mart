'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget, jsend } from '@/lib/api';
import AddProductModal from '@/components/AddProductModal';

const today = () => new Date().toISOString().slice(0, 10);

type Line = {
  key: string;
  productId: string | null; // null = new product
  name: string;
  sku: string;
  category: string;
  qty: string;
  free: string;
  cost: string;
  price: string;
  mrp: string;
  expiry: string;
  scheme: string;
  batchNo: string;
};

// Shared form for the purchase-entry page: creates a bill (`poId` absent,
// POST + receive) or edits an existing one (`poId` set, PUT re-applies stock).
export default function PurchaseForm({ poId }: { poId?: string }) {
  const { fmt, EmptyState } = UI;
  const toast = UI.useToast();
  const router = useRouter();
  const editing = !!poId;

  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(!editing);

  const [supplier, setSupplier] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [enteredDate, setEnteredDate] = useState(today());

  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    jget('/api/suppliers').then(setSuppliers);
    jget('/api/products').then(setProducts);
    jget('/api/warehouses').then((ws) => {
      setWarehouses(ws);
      setWarehouse((w) => w || ws[0]?.id || '');
    });
  }, []);

  // Edit mode: prefill from the existing bill.
  useEffect(() => {
    if (!poId) return;
    jget(`/api/purchase-orders/${poId}`)
      .then((po) => {
        setSupplier(po.supplier || '');
        setInvoiceNo(po.invoiceNo || '');
        setInvoiceDate(po.invoiceDate || today());
        setEnteredDate(po.enteredDate || today());
        setLines(
          (po.lines || []).map((l: any) => ({
            key: `it-${l.id}`,
            productId: l.productId,
            name: l.product || '',
            sku: l.sku || '',
            category: '',
            qty: String(l.qty),
            free: l.free ? String(l.free) : '',
            cost: l.cost ? String(l.cost) : '',
            price: l.price ? String(l.price) : '',
            mrp: l.mrp ? String(l.mrp) : '',
            expiry: l.expiry || '',
            scheme: l.scheme || '',
            batchNo: l.batchNo || '',
          })),
        );
        setLoaded(true);
      })
      .catch((e) => toast({ message: e.message, icon: 'alert', type: 'danger' }));
  }, [poId]);

  // Close the search results when clicking outside.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node))
        setShowResults(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode || '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [query, products]);

  const addExisting = (p: any) => {
    setLines((ls) => {
      const ex = ls.find((l) => l.productId === p.id);
      if (ex)
        return ls.map((l) =>
          l.productId === p.id ? { ...l, qty: String((Number(l.qty) || 0) + 1) } : l,
        );
      return [
        ...ls,
        {
          key: `${p.id}-${Date.now()}`,
          productId: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category || '',
          qty: '1',
          free: '',
          cost: p.cost ? String(p.cost) : '',
          price: p.price ? String(p.price) : '',
          mrp: p.mrp ? String(p.mrp) : '',
          expiry: p.expiry || '',
          scheme: '',
          batchNo: '',
        },
      ];
    });
    setQuery('');
    setShowResults(false);
  };

  const addNew = () => {
    setLines((ls) => [
      ...ls,
      {
        key: `new-${Date.now()}`,
        productId: null,
        name: query.trim(),
        sku: '',
        category: '',
        qty: '1',
        free: '',
        cost: '',
        price: '',
        mrp: '',
        expiry: '',
        scheme: '',
        batchNo: '',
      },
    ]);
    setQuery('');
    setShowResults(false);
  };

  // Full-details product creation (shared Add product form): publishes the
  // product immediately, then drops it into the bill as a line.
  const createProduct = async (form: any) => {
    try {
      const p = await jsend('/api/products', 'POST', {
        ...form,
        supplier: form.supplier || supplier,
        warehouse: form.warehouse || warehouse,
      });
      setProducts((ps) => [p, ...ps]);
      setShowAddProduct(false);
      toast({ message: `Published "${p.name}"`, icon: 'check' });
      addExisting(p);
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    }
  };

  const setLine = (key: string, k: keyof Line, v: string) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, [k]: v } : l)));
  const removeLine = (key: string) => setLines((ls) => ls.filter((l) => l.key !== key));

  const totals = useMemo(() => {
    const qty = lines.reduce((s, l) => s + (Number(l.qty) || 0), 0);
    const free = lines.reduce((s, l) => s + (Number(l.free) || 0), 0);
    const value = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.cost) || 0), 0);
    return { qty, free, value };
  }, [lines]);

  const save = async () => {
    if (!supplier) {
      toast({ message: 'Select a supplier', icon: 'alert', type: 'danger' });
      return;
    }
    const bad = lines.find((l) => !l.productId && !(l.name.trim() && l.sku.trim()));
    if (bad) {
      toast({ message: 'New products need a name and SKU', icon: 'alert', type: 'danger' });
      return;
    }
    const payload = lines
      .filter((l) => (Number(l.qty) || 0) > 0)
      .map((l) => ({
        productId: l.productId || undefined,
        name: l.productId ? undefined : l.name,
        sku: l.productId ? undefined : l.sku,
        category: l.productId ? undefined : l.category,
        qty: Number(l.qty),
        free: Number(l.free) || 0,
        cost: Number(l.cost) || 0,
        price: Number(l.price) || 0,
        mrp: Number(l.mrp) || 0,
        expiry: l.expiry || undefined,
        scheme: l.scheme || undefined,
        batchNo: l.batchNo || undefined,
      }));
    if (!payload.length) {
      toast({ message: 'Add at least one item', icon: 'alert', type: 'danger' });
      return;
    }
    setSaving(true);
    try {
      const body = {
        supplier,
        warehouse,
        invoiceNo,
        invoiceDate,
        enteredDate,
        lines: payload,
      };
      const po = editing
        ? await jsend(`/api/purchase-orders/${poId}`, 'PUT', body)
        : await jsend('/api/purchase-orders', 'POST', { ...body, receive: true });
      toast({
        message: editing
          ? `Purchase ${po.id} updated — stock corrected`
          : `Purchase ${po.id} saved — stock updated`,
        icon: 'check',
      });
      router.push('/admin/orders');
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">{editing ? `Edit purchase ${poId}` : 'New purchase entry'}</div>
          <div className="ph-sub">
            {editing
              ? 'Correct this bill — stock and prices are re-applied on save.'
              : 'Enter a supplier bill after delivery — stock and prices update on save.'}
          </div>
        </div>
        <div className="ph-actions">
          <Link href="/admin/orders" className="btn btn-secondary">
            <Icon name="chevLeft" size={14} /> Back to orders
          </Link>
        </div>
      </div>

      {!loaded ? (
        <div className="card">
          <EmptyState icon="clock" title="Loading…" />
        </div>
      ) : (
        <>
          {/* Bill details */}
          <div className="card" style={{ padding: 'var(--s-4)', marginBottom: 'var(--s-4)' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 14,
              }}
            >
              <label className="field">
                <span>Supplier *</span>
                <select
                  className="select"
                  value={supplier}
                  onChange={(e) => setSupplier(e.target.value)}
                >
                  <option value="">Select supplier…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Invoice no.</span>
                <input
                  className="input"
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="Supplier bill no."
                />
              </label>
              <label className="field">
                <span>Invoice date</span>
                <input
                  className="input"
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Entered on</span>
                <input
                  className="input"
                  type="date"
                  value={enteredDate}
                  onChange={(e) => setEnteredDate(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Deliver to</span>
                <select
                  className="select"
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          {/* Product search */}
          <div
            ref={searchRef}
            style={{
              position: 'relative',
              marginBottom: 'var(--s-4)',
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <div className="input-group" style={{ height: 42, flex: 1, minWidth: 240, maxWidth: 560 }}>
              <Icon name="search" size={16} style={{ color: 'var(--fg-tertiary)' }} />
              <input
                placeholder="Search products by name, SKU or barcode to add…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setShowResults(true);
                }}
                onFocus={() => setShowResults(true)}
                style={{ fontSize: 'var(--t-md)' }}
              />
              {query && (
                <Icon
                  name="x"
                  size={14}
                  style={{ cursor: 'pointer', color: 'var(--fg-tertiary)' }}
                  onClick={() => setQuery('')}
                />
              )}
            </div>
            <button className="btn btn-secondary" onClick={() => setShowAddProduct(true)}>
              <Icon name="plus" size={14} /> Add product
            </button>
            {showResults && query.trim() && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 4px)',
                  left: 0,
                  width: '100%',
                  maxWidth: 560,
                  background: 'var(--bg-elev)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--r-md)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 40,
                  overflow: 'hidden',
                }}
              >
                {matches.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => addExisting(p)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '9px 12px',
                      cursor: 'pointer',
                      borderBottom: '1px solid var(--border-subtle)',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <UI.ProductThumb name={p.name} size={30} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500, fontSize: 'var(--t-base)' }}>{p.name}</div>
                      <div className="muted tiny mono">
                        {p.sku} · {p.stock} in stock
                      </div>
                    </div>
                    <div className="mono tiny">{fmt.money(p.cost)} cost</div>
                  </div>
                ))}
                <div
                  onClick={addNew}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    color: 'var(--accent)',
                    fontWeight: 600,
                    fontSize: 'var(--t-base)',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <Icon name="plus" size={14} /> Add “{query.trim()}” as a new product
                </div>
              </div>
            )}
          </div>

          {/* Lines */}
          {lines.length === 0 ? (
            <div className="card">
              <EmptyState
                icon="cart"
                title="No items yet"
                body="Search above to add products from this bill. Unlisted products can be added on the spot."
              />
            </div>
          ) : (
            lines.map((l) => (
              <div
                key={l.key}
                className="card"
                style={{ padding: 'var(--s-4)', marginBottom: 'var(--s-3)' }}
              >
                <div className="spread" style={{ marginBottom: 10 }}>
                  <div className="row" style={{ gap: 10, minWidth: 0 }}>
                    <UI.ProductThumb name={l.name || '?'} size={32} />
                    {l.productId ? (
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600 }}>{l.name}</div>
                        <div className="muted tiny mono">{l.sku}</div>
                      </div>
                    ) : (
                      <span className="badge badge-info">new product</span>
                    )}
                  </div>
                  <div className="row" style={{ gap: 10 }}>
                    <div className="mono" style={{ fontWeight: 600 }}>
                      {fmt.money((Number(l.qty) || 0) * (Number(l.cost) || 0))}
                    </div>
                    <button className="icon-btn" onClick={() => removeLine(l.key)}>
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
                {!l.productId && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                      gap: 10,
                      marginBottom: 10,
                    }}
                  >
                    <label className="field">
                      <span>Name *</span>
                      <input
                        className="input"
                        value={l.name}
                        onChange={(e) => setLine(l.key, 'name', e.target.value)}
                        placeholder="Product name"
                      />
                    </label>
                    <label className="field">
                      <span>SKU *</span>
                      <input
                        className="input"
                        value={l.sku}
                        onChange={(e) => setLine(l.key, 'sku', e.target.value)}
                        placeholder="ABC-001"
                      />
                    </label>
                    <label className="field">
                      <span>Category</span>
                      <input
                        className="input"
                        value={l.category}
                        onChange={(e) => setLine(l.key, 'category', e.target.value)}
                        placeholder="Toys"
                      />
                    </label>
                  </div>
                )}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(105px, 1fr))',
                    gap: 10,
                  }}
                >
                  <label className="field">
                    <span>Units *</span>
                    <input
                      className="input"
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) => setLine(l.key, 'qty', e.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Free units</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={l.free}
                      onChange={(e) => setLine(l.key, 'free', e.target.value)}
                      placeholder="0"
                    />
                  </label>
                  <label className="field">
                    <span>Actual price (cost)</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={l.cost}
                      onChange={(e) => setLine(l.key, 'cost', e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="field">
                    <span>Selling price</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={l.price}
                      onChange={(e) => setLine(l.key, 'price', e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="field">
                    <span>MRP</span>
                    <input
                      className="input"
                      type="number"
                      min={0}
                      value={l.mrp}
                      onChange={(e) => setLine(l.key, 'mrp', e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                  <label className="field">
                    <span>Batch no.</span>
                    <input
                      className="input"
                      value={l.batchNo}
                      onChange={(e) => setLine(l.key, 'batchNo', e.target.value)}
                      placeholder="e.g. B2407"
                    />
                  </label>
                  <label className="field">
                    <span>Expiry</span>
                    <input
                      className="input"
                      type="date"
                      value={l.expiry}
                      onChange={(e) => setLine(l.key, 'expiry', e.target.value)}
                    />
                  </label>
                  <label className="field" style={{ gridColumn: 'span 2' }}>
                    <span>Scheme / offer</span>
                    <input
                      className="input"
                      value={l.scheme}
                      onChange={(e) => setLine(l.key, 'scheme', e.target.value)}
                      placeholder="e.g. 10+1 free, 5% off"
                    />
                  </label>
                </div>
              </div>
            ))
          )}

          {/* Save bar */}
          <div
            className="card"
            style={{
              padding: 'var(--s-3) var(--s-4)',
              marginTop: 'var(--s-4)',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              flexWrap: 'wrap',
            }}
          >
            <div className="muted">
              {lines.length} item{lines.length !== 1 ? 's' : ''} · {totals.qty} units
              {totals.free ? ` + ${totals.free} free` : ''}
            </div>
            <div style={{ fontWeight: 700, fontSize: 'var(--t-md)' }}>
              Bill total <span className="mono">{fmt.money(totals.value)}</span>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <Link href="/admin/orders" className="btn btn-secondary">
                Cancel
              </Link>
              <button
                className="btn btn-primary"
                onClick={save}
                disabled={saving || lines.length === 0}
              >
                <Icon name="check" size={14} />{' '}
                {saving
                  ? 'Saving…'
                  : editing
                    ? 'Save changes & correct stock'
                    : 'Save purchase & update stock'}
              </button>
            </div>
          </div>

          <AddProductModal
            open={showAddProduct}
            onClose={() => setShowAddProduct(false)}
            onSubmit={createProduct}
            defaults={{ supplier, warehouse }}
          />
        </>
      )}
    </div>
  );
}
