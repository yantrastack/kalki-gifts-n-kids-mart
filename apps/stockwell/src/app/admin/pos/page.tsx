'use client';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { useI18n } from '@/i18n';
import { jget, jsend } from '@/lib/api';
import { buildSaleLines } from '@/lib/invoice';
import {
  PAYMENT_METHODS,
  isIsoDate,
  planSalePayments,
  rupeesToPaise,
  todayIST,
  type PaymentMethod,
} from '@/lib/payments';

type TenderRow = { key: number; method: PaymentMethod; amount: string; reference: string };
let nextRowKey = 0;
const newRow = (method: PaymentMethod, amount: string): TenderRow => ({
  key: ++nextRowKey,
  method,
  amount,
  reference: '',
});
const inDays = (days: number) => {
  const d = new Date(`${todayIST()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
// A row's amount in paise, or null if it is empty, zero, negative or has more
// than two decimals.
const rowPaise = (r: TenderRow) => {
  const p = rupeesToPaise(Number(r.amount));
  return p !== null && p > 0 ? p : null;
};

export default function POSPage() {
  const { fmt, ProductThumb, Modal, EmptyState, useToast } = UI;
  const toast = useToast();
  const { t } = useI18n();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [cart, setCart] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState('');
  const [discount, setDiscount] = useState(0);
  const [credit, setCredit] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [rows, setRows] = useState<TenderRow[]>([]);
  const [showPay, setShowPay] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = () => jget('/api/products?sellable=1').then(setProducts);
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
        : [
            ...c,
            {
              id: p.id,
              name: p.name,
              sku: p.sku,
              hsnCode: p.hsnCode,
              price: p.price,
              gstRate: p.gstRate,
              stock: p.stock,
              qty: 1,
            },
          ];
    });
  };
  const updateQty = (id: string, delta: number) =>
    setCart((c) =>
      c.map((i) =>
        i.id === id ? { ...i, qty: Math.max(1, Math.min(i.stock, i.qty + delta)) } : i,
      ),
    );
  const removeItem = (id: string) => setCart((c) => c.filter((i) => i.id !== id));

  const sale = useMemo(
    () =>
      buildSaleLines(
        cart.map((i) => ({
          productId: i.id,
          name: i.name,
          sku: i.sku,
          hsnCode: i.hsnCode,
          price: i.price,
          gstRate: i.gstRate,
          qty: i.qty,
        })),
        discount,
      ),
    [cart, discount],
  );
  const subtotal = sale.subtotal;
  const discountAmount = sale.discount;
  const tax = sale.tax;
  const total = sale.total;
  const totalQty = cart.reduce((s, i) => s + i.qty, 0);

  const registered = customers.filter((c) => c.name !== 'Walk-in customer');
  const customerName = registered.find((c) => c.id === customerId)?.name ?? t('payments.walkIn');
  const totalPaise = Math.round(total * 100);

  const openPay = () => {
    setCredit(false);
    setRows([newRow('cash', total.toFixed(2))]);
    setShowPay(true);
  };
  // Credit is a sale term, not a payment method: it starts with no payment (the
  // customer pays later) and needs a due date.
  const toggleCredit = (on: boolean) => {
    setCredit(on);
    if (on) {
      setRows([]);
      if (!dueDate) setDueDate(inDays(30));
    } else setRows([newRow('cash', total.toFixed(2))]);
  };
  const setRow = (key: number, patch: Partial<TenderRow>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Mirrors the server's checks (lib/payments.planSalePayments), which are the
  // ones that count, so the button only enables for a sale the server will take.
  const rowsValid = rows.every((r) => rowPaise(r) !== null);
  const tendered = rows.reduce((s, r) => s + (rowPaise(r) ?? 0), 0);
  const plan = rowsValid
    ? planSalePayments(
        totalPaise,
        credit ? 'credit' : 'immediate',
        rows.map((r) => ({ method: r.method, amountPaise: rowPaise(r), reference: r.reference })),
      )
    : null;
  const planOk = !!plan && !('error' in plan);
  const changePaise = plan && 'changePaise' in plan ? plan.changePaise : 0;
  const remainingPaise = totalPaise - tendered;
  const creditOk = !credit || (!!customerId && isIsoDate(dueDate) && dueDate >= todayIST());
  const canComplete = planOk && creditOk && !busy;

  const checkout = async () => {
    setBusy(true);
    try {
      const res = await jsend('/api/pos/checkout', 'POST', {
        items: cart.map((i) => ({ productId: i.id, qty: i.qty })),
        customerId: customerId || undefined,
        discountPct: discount,
        terms: credit ? 'credit' : 'immediate',
        dueDate: credit ? dueDate : undefined,
        payments: rows.map((r) => ({
          method: r.method,
          amount: Number(r.amount),
          reference: r.reference.trim() || undefined,
        })),
        cashier: 'Register',
      });
      setShowPay(false);
      setReceipt(res.receipt);
      setCart([]);
      setDiscount(0);
      setCustomerId('');
      setCredit(false);
      setRows([]);
      load();
      toast({ message: t('payments.saleComplete', { id: res.order.id }), icon: 'check' });
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
          <div className="field">
            <span>Customer</span>
            <UI.Select
              aria-label="Customer"
              value={customerId}
              onChange={setCustomerId}
              options={[
                { value: '', label: t('payments.walkIn') },
                ...registered.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </div>
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
              <UI.Select
                aria-label="Discount"
                className="pos-disc"
                value={String(discount)}
                onChange={(v) => setDiscount(Number(v))}
                options={[0, 5, 10, 15, 20].map((d) => ({ value: String(d), label: `${d}%` }))}
              />
            </span>
            <span className="mono" style={{ color: discountAmount ? 'var(--success)' : 'inherit' }}>
              −{fmt.money(discountAmount)}
            </span>
          </div>
          <div className="spread">
            <span className="muted">GST</span>
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
            onClick={openPay}
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
          <h3 style={{ margin: 0, fontSize: 'var(--t-lg)', fontWeight: 600 }}>
            {t('payments.takePayment')}
          </h3>
          <button
            className="icon-btn"
            style={{ marginLeft: 'auto' }}
            onClick={() => !busy && setShowPay(false)}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div
          style={{
            padding: 'var(--s-5)',
            display: 'grid',
            gap: 16,
            maxHeight: '75vh',
            overflow: 'auto',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div className="muted tiny">{t('payments.amountDue')}</div>
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
              {totalQty} item{totalQty !== 1 ? 's' : ''} · {customerName}
            </div>
          </div>

          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <input
              type="checkbox"
              checked={credit}
              disabled={!customerId}
              onChange={(e) => toggleCredit(e.target.checked)}
              style={{ marginTop: 3 }}
            />
            <span>
              <strong>{t('payments.sellOnCredit')}</strong>
              <div className="muted tiny">
                {customerId ? t('payments.creditHint') : t('payments.creditNeedsCustomer')}
              </div>
            </span>
          </label>

          {credit && (
            <label className="field">
              <span>{t('payments.dueDate')}</span>
              <input
                className="input"
                type="date"
                min={todayIST()}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </label>
          )}

          <div style={{ display: 'grid', gap: 8 }}>
            <div className="spread">
              <strong>{t('payments.payments')}</strong>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() =>
                  setRows((rs) => [
                    ...rs,
                    newRow('cash', remainingPaise > 0 ? (remainingPaise / 100).toFixed(2) : ''),
                  ])
                }
              >
                <Icon name="plus" size={12} /> {t('payments.addPayment')}
              </button>
            </div>
            {rows.map((r) => (
              <div
                key={r.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.1fr 1fr 1.2fr auto',
                  gap: 6,
                  alignItems: 'end',
                }}
              >
                <label className="field">
                  <span>{t('payments.method')}</span>
                  <select
                    className="select"
                    value={r.method}
                    onChange={(e) => setRow(r.key, { method: e.target.value as PaymentMethod })}
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {t(`payments.methods.${m}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>{t('payments.amount')}</span>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={r.amount}
                    onChange={(e) => setRow(r.key, { amount: e.target.value })}
                  />
                </label>
                <label className="field">
                  <span>{t('payments.reference')}</span>
                  <input
                    className="input"
                    placeholder={t('payments.referenceHint')}
                    maxLength={120}
                    value={r.reference}
                    onChange={(e) => setRow(r.key, { reference: e.target.value })}
                  />
                </label>
                <button
                  className="icon-btn"
                  aria-label={t('payments.removePayment')}
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 4 }}>
            <div className="spread">
              <span className="muted">{t('payments.tendered')}</span>
              <span className="mono">{fmt.money(tendered / 100)}</span>
            </div>
            {remainingPaise > 0 && (
              <div className="spread">
                <span className="muted">
                  {credit ? t('payments.balanceDue') : t('payments.remaining')}
                </span>
                <span className="mono" style={{ color: credit ? 'inherit' : 'var(--danger)' }}>
                  {fmt.money(remainingPaise / 100)}
                </span>
              </div>
            )}
            {changePaise > 0 && (
              <div className="spread">
                <span className="muted">{t('payments.change')}</span>
                <span className="mono">{fmt.money(changePaise / 100)}</span>
              </div>
            )}
            {rowsValid && remainingPaise < 0 && !planOk && (
              <div className="tiny" style={{ color: 'var(--danger)' }}>
                {credit ? t('payments.creditOverpaid') : t('payments.overpaid')}
              </div>
            )}
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', height: 44, justifyContent: 'center' }}
            disabled={!canComplete}
            onClick={checkout}
          >
            {busy ? (
              t('payments.processing')
            ) : (
              <>
                <Icon name="check" size={16} /> {t('payments.completeSale')}
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
                {receipt.payments.map((p: any, i: number) => (
                  <div key={i} className="spread" style={{ fontSize: 'var(--t-sm)', marginTop: 4 }}>
                    <span className="muted">
                      {t('payments.paidVia')} {t(`payments.methods.${p.method}`)}
                      {p.reference ? ` · ${p.reference}` : ''}
                    </span>
                    <span className="mono">{fmt.money(p.amount)}</span>
                  </div>
                ))}
                {receipt.change > 0 && (
                  <div className="spread" style={{ fontSize: 'var(--t-sm)', marginTop: 4 }}>
                    <span className="muted">{t('payments.change')}</span>
                    <span className="mono">{fmt.money(receipt.change)}</span>
                  </div>
                )}
                {receipt.terms === 'credit' && (
                  <>
                    <div className="spread" style={{ fontSize: 'var(--t-sm)', marginTop: 4 }}>
                      <span className="muted">
                        {t('payments.creditSale')} ·{' '}
                        {t('payments.dueOn', { date: receipt.dueDate })}
                      </span>
                      <span />
                    </div>
                    <div className="spread" style={{ fontSize: 'var(--t-sm)', marginTop: 4 }}>
                      <span className="muted">{t('payments.balanceDue')}</span>
                      <span className="mono">{fmt.money(receipt.balance)}</span>
                    </div>
                  </>
                )}
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
