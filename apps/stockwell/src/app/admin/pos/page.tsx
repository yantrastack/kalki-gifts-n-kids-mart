'use client';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget, jsend } from '@/lib/api';

const TAX_RATE = 0.08;
const PAYMENTS = [
  { id: 'card', label: 'Card', icon: 'card' },
  { id: 'cash', label: 'Cash', icon: 'banknote' },
  { id: 'wallet', label: 'Wallet', icon: 'wallet' },
  { id: 'ach', label: 'ACH / Invoice', icon: 'bank' },
];

export default function POSPage() {
  const { fmt, ProductThumb, Modal, EmptyState, useToast } = UI;
  const toast = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState<any[]>([]);
  const [customer, setCustomer] = useState('Walk-in customer');
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState('card');
  const [showPay, setShowPay] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = () => jget('/api/products').then(setProducts);
  useEffect(() => {
    load();
    jget('/api/customers').then(setCustomers);
  }, []);

  const categories = ['All', ...Array.from(new Set(products.map((p) => p.category)))];
  const filtered = products.filter((p) => {
    if (category !== 'All' && p.category !== category) return false;
    if (
      query &&
      !(
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.sku.toLowerCase().includes(query.toLowerCase())
      )
    )
      return false;
    return p.status !== 'out';
  });

  const inCart = (id: string) => cart.find((i) => i.id === id)?.qty || 0;
  const addToCart = (p: any) => {
    const have = inCart(p.id);
    if (have >= p.stock) {
      toast({ message: `Only ${p.stock} in stock for ${p.name}`, icon: 'alert', type: 'danger' });
      return;
    }
    setCart((c) => {
      const ex = c.find((i) => i.id === p.id);
      return ex
        ? c.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i))
        : [...c, { id: p.id, name: p.name, sku: p.sku, price: p.price, stock: p.stock, qty: 1 }];
    });
  };
  const updateQty = (id: string, delta: number) =>
    setCart((c) =>
      c.map((i) =>
        i.id === id ? { ...i, qty: Math.max(1, Math.min(i.stock, i.qty + delta)) } : i,
      ),
    );
  const removeItem = (id: string) => setCart((c) => c.filter((i) => i.id !== id));

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const discountAmount = subtotal * (discount / 100);
  const afterDiscount = subtotal - discountAmount;
  const tax = afterDiscount * TAX_RATE;
  const total = afterDiscount + tax;
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);

  const checkout = async () => {
    setBusy(true);
    try {
      const res = await jsend('/api/pos/checkout', 'POST', {
        items: cart.map((i) => ({ productId: i.id, qty: i.qty })),
        customerName: customer,
        discountPct: discount,
        payment,
        cashier: 'Register',
      });
      setShowPay(false);
      setReceipt(res.receipt);
      setCart([]);
      setDiscount(0);
      load();
      toast({ message: `Sale ${res.order.id} complete`, icon: 'check' });
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pos">
      {/* LEFT: catalog */}
      <div className="pos-catalog">
        <div className="pos-head">
          <div>
            <div style={{ fontSize: 'var(--t-lg)', fontWeight: 600 }}>Register</div>
            <div className="muted tiny">WH-NYC · Counter 1</div>
          </div>
        </div>
        <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="input-group" style={{ height: 40 }}>
            <Icon name="search" size={16} style={{ color: 'var(--fg-tertiary)' }} />
            <input
              placeholder="Search products or scan barcode…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
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
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8 }}>
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className="pos-chip"
                style={{
                  background: category === c ? 'var(--accent)' : 'var(--bg-elev)',
                  color: category === c ? 'var(--on-accent)' : 'var(--fg)',
                  borderColor: category === c ? 'var(--accent)' : 'var(--border)',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 20px 20px' }}>
          {filtered.length === 0 ? (
            <EmptyState
              icon="search"
              title="No products found"
              body="Try a different search or category."
            />
          ) : (
            <div className="pos-grid">
              {filtered.map((p) => (
                <button key={p.id} onClick={() => addToCart(p)} className="pos-prod">
                  <div className="img-placeholder" style={{ aspectRatio: 1, marginBottom: 8 }}>
                    <span>
                      {p.name
                        .split(' ')
                        .slice(0, 2)
                        .map((w: string) => w[0])
                        .join('')}
                    </span>
                  </div>
                  <div className="pos-prod-name">{p.name}</div>
                  <div className="spread" style={{ marginTop: 4 }}>
                    <span className="mono" style={{ fontWeight: 600, fontSize: 'var(--t-sm)' }}>
                      {fmt.money(p.price)}
                    </span>
                    <span
                      className="tiny"
                      style={{ color: p.status === 'low' ? 'var(--warn)' : 'var(--fg-tertiary)' }}
                    >
                      {p.stock} left
                    </span>
                  </div>
                  {inCart(p.id) > 0 && <span className="pos-badge">{inCart(p.id)}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: cart */}
      <div className="pos-cart">
        <div className="pos-head">
          <div style={{ fontWeight: 600 }}>Current sale</div>
          {cart.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => setCart([])}
            >
              <Icon name="trash" size={12} /> Clear
            </button>
          )}
        </div>
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
          <label className="field">
            <span>Customer</span>
            <select
              className="select"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
            >
              <option>Walk-in customer</option>
              {customers
                .filter((c) => c.name !== 'Walk-in customer')
                .map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
          {cart.length === 0 ? (
            <EmptyState
              icon="cart"
              title="Cart is empty"
              body="Tap a product to add it to the sale."
            />
          ) : (
            cart.map((i) => (
              <div key={i.id} className="pos-line">
                <ProductThumb name={i.name} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="pos-line-name">{i.name}</div>
                  <div className="muted tiny mono">{fmt.money(i.price)} each</div>
                </div>
                <div className="pos-qty">
                  <button onClick={() => updateQty(i.id, -1)}>
                    <Icon name="minus" size={12} />
                  </button>
                  <span className="mono">{i.qty}</span>
                  <button onClick={() => updateQty(i.id, 1)}>
                    <Icon name="plus" size={12} />
                  </button>
                </div>
                <div
                  className="mono"
                  style={{
                    fontWeight: 600,
                    width: 64,
                    textAlign: 'right',
                    fontSize: 'var(--t-sm)',
                  }}
                >
                  {fmt.money(i.price * i.qty)}
                </div>
                <button
                  className="icon-btn"
                  style={{ width: 22, height: 22 }}
                  onClick={() => removeItem(i.id)}
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))
          )}
        </div>
        <div className="pos-totals">
          <div className="spread">
            <span className="muted">Subtotal</span>
            <span className="mono">{fmt.money(subtotal)}</span>
          </div>
          <div className="spread">
            <span className="muted">
              Discount
              <select
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="pos-disc"
              >
                {[0, 5, 10, 15, 20].map((d) => (
                  <option key={d} value={d}>
                    {d}%
                  </option>
                ))}
              </select>
            </span>
            <span className="mono" style={{ color: discountAmount ? 'var(--success)' : 'inherit' }}>
              −{fmt.money(discountAmount)}
            </span>
          </div>
          <div className="spread">
            <span className="muted">Tax (8%)</span>
            <span className="mono">{fmt.money(tax)}</span>
          </div>
          <div className="spread pos-total">
            <span>Total</span>
            <span className="mono">{fmt.money(total)}</span>
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', height: 44, justifyContent: 'center', fontSize: 'var(--t-md)' }}
            disabled={cart.length === 0}
            onClick={() => setShowPay(true)}
          >
            <Icon name="card" size={16} /> Charge {fmt.money(total)}
          </button>
        </div>
      </div>

      {/* Payment modal */}
      <Modal open={showPay} onClose={() => !busy && setShowPay(false)}>
        <div
          style={{
            padding: 'var(--s-4) var(--s-5)',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 'var(--t-lg)', fontWeight: 600 }}>Take payment</h3>
          <button
            className="icon-btn"
            style={{ marginLeft: 'auto' }}
            onClick={() => !busy && setShowPay(false)}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div style={{ padding: 'var(--s-5)' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div className="muted tiny">Amount due</div>
            <div
              style={{
                fontSize: 'var(--t-4xl)',
                fontWeight: 700,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '-0.02em',
              }}
            >
              {fmt.money(total)}
            </div>
            <div className="muted tiny">
              {totalQty} item{totalQty !== 1 ? 's' : ''} · {customer}
            </div>
          </div>
          <div
            style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}
          >
            {PAYMENTS.map((pm) => (
              <button
                key={pm.id}
                onClick={() => setPayment(pm.id)}
                className="pos-pay"
                style={{
                  borderColor: payment === pm.id ? 'var(--accent)' : 'var(--border)',
                  background: payment === pm.id ? 'var(--accent-soft)' : 'var(--bg-elev)',
                }}
              >
                <Icon name={pm.icon} size={18} /> {pm.label}
              </button>
            ))}
          </div>
          <button
            className="btn btn-primary"
            style={{ width: '100%', height: 44, justifyContent: 'center' }}
            disabled={busy}
            onClick={checkout}
          >
            {busy ? (
              'Processing…'
            ) : (
              <>
                <Icon name="check" size={16} /> Complete sale
              </>
            )}
          </button>
        </div>
      </Modal>

      {/* Receipt modal */}
      <Modal open={!!receipt} onClose={() => setReceipt(null)}>
        {receipt && (
          <>
            <div
              style={{
                padding: 'var(--s-5)',
                textAlign: 'center',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 999,
                  background: 'var(--success-soft)',
                  color: 'var(--success)',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 10px',
                }}
              >
                <Icon name="check" size={24} />
              </div>
              <div style={{ fontSize: 'var(--t-lg)', fontWeight: 600 }}>Payment complete</div>
              <div className="muted tiny mono">
                {receipt.id} · {receipt.date}
              </div>
            </div>
            <div style={{ padding: 'var(--s-4) var(--s-5)', maxHeight: 260, overflow: 'auto' }}>
              {receipt.lines.map((l: any, i: number) => (
                <div
                  key={i}
                  className="spread"
                  style={{ padding: '6px 0', fontSize: 'var(--t-sm)' }}
                >
                  <span>
                    {l.qty}× {l.name}
                  </span>
                  <span className="mono">{fmt.money(l.lineTotal)}</span>
                </div>
              ))}
              <div
                style={{ borderTop: '1px solid var(--border-subtle)', marginTop: 8, paddingTop: 8 }}
              >
                <div className="spread" style={{ fontSize: 'var(--t-sm)' }}>
                  <span className="muted">Subtotal</span>
                  <span className="mono">{fmt.money(receipt.subtotal)}</span>
                </div>
                {receipt.discount > 0 && (
                  <div className="spread" style={{ fontSize: 'var(--t-sm)' }}>
                    <span className="muted">Discount</span>
                    <span className="mono">−{fmt.money(receipt.discount)}</span>
                  </div>
                )}
                <div className="spread" style={{ fontSize: 'var(--t-sm)' }}>
                  <span className="muted">Tax</span>
                  <span className="mono">{fmt.money(receipt.tax)}</span>
                </div>
                <div className="spread pos-total" style={{ marginTop: 4 }}>
                  <span>Total</span>
                  <span className="mono">{fmt.money(receipt.total)}</span>
                </div>
                <div className="spread" style={{ fontSize: 'var(--t-sm)', marginTop: 4 }}>
                  <span className="muted">Paid via</span>
                  <span style={{ textTransform: 'capitalize' }}>{receipt.payment}</span>
                </div>
              </div>
            </div>
            <div
              style={{
                padding: 'var(--s-3) var(--s-5)',
                borderTop: '1px solid var(--border)',
                display: 'flex',
                gap: 8,
                background: 'var(--bg-muted)',
              }}
            >
              <button
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => window.print()}
              >
                <Icon name="printer" size={14} /> Print
              </button>
              <button
                className="btn btn-primary"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setReceipt(null)}
              >
                New sale
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
