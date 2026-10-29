'use client';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { useI18n } from '@/i18n';
import { jget, jsend } from '@/lib/api';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments';

const fmtDay = (iso?: string | null, fallback = '—') =>
  iso
    ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : fallback;
const fmtStamp = (iso: string) =>
  new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

// Every payment and refund against an invoice, oldest first. Refunds show as
// negative amounts.
function PaymentHistory({ rows }: { rows: any[] }) {
  const { t } = useI18n();
  const { fmt } = UI;
  if (!rows.length) return <div className="muted tiny">{t('payments.noPayments')}</div>;
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {rows.map((p) => (
        <div key={p.id} className="spread" style={{ fontSize: 'var(--t-sm)' }}>
          <span>
            {p.direction === 'refund' ? `${t('payments.refundRow')} · ` : ''}
            {t(`payments.methods.${p.method}`)}
            <span className="muted tiny">
              {' '}
              · {fmtStamp(p.receivedAt)}
              {p.reference ? ` · ${p.reference}` : ''}
            </span>
          </span>
          <span
            className="mono"
            style={{ color: p.direction === 'refund' ? 'var(--danger)' : 'inherit' }}
          >
            {p.direction === 'refund' ? '−' : ''}
            {fmt.money(p.amount)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function InvoicesPage() {
  const { fmt, statusBadge, Kpi2, Modal, Dropdown, MenuItem, useToast } = UI;
  const toast = useToast();
  const { t } = useI18n();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [payFor, setPayFor] = useState<any>(null);
  const [payHistory, setPayHistory] = useState<any[]>([]);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [payAmount, setPayAmount] = useState('');
  const [payReference, setPayReference] = useState('');
  const [busy, setBusy] = useState(false);
  const [detail, setDetail] = useState<any>(null);

  const load = () => jget('/api/invoices').then(setInvoices);
  useEffect(() => {
    load();
  }, []);

  // Status comes from the API's derived fields (paid/partial/unpaid from payment
  // rows, overdue from the due date); void invoices are left out of the money.
  const live = invoices.filter((i) => i.displayStatus !== 'void');
  const outstanding = live.reduce((s, i) => s + i.balance, 0);
  const overdue = live.filter((i) => i.isOverdue);
  const paidTotal = live.reduce((s, i) => s + i.paidAmount, 0);

  const filtered = useMemo(
    () =>
      invoices.filter((i) => {
        const voided = i.displayStatus === 'void';
        if (filter === 'void' && !voided) return false;
        if (filter === 'overdue' && !i.isOverdue) return false;
        if (['paid', 'partial', 'unpaid'].includes(filter) && (voided || i.payStatus !== filter))
          return false;
        if (
          query &&
          !(
            i.id.toLowerCase().includes(query.toLowerCase()) ||
            (i.customer || '').toLowerCase().includes(query.toLowerCase())
          )
        )
          return false;
        return true;
      }),
    [invoices, filter, query],
  );

  const openDetail = async (inv: any) => setDetail(await jget(`/api/invoices/${inv.id}`));
  const voidInvoice = async (inv: any) => {
    if (!window.confirm(t('payments.voidConfirm', { id: inv.id }))) return;
    try {
      await jsend(`/api/invoices/${inv.id}`, 'PUT', { status: 'void' });
      toast({ message: t('payments.voided', { id: inv.id }), icon: 'check' });
      setDetail(null);
      load();
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    }
  };
  const printInvoice = () => {
    document.body.classList.add('print-invoice');
    const done = () => {
      document.body.classList.remove('print-invoice');
      window.removeEventListener('afterprint', done);
    };
    window.addEventListener('afterprint', done);
    window.print();
  };

  const openPay = (inv: any) => {
    setPayFor(inv);
    setMethod('cash');
    setPayAmount(inv.balance.toFixed(2));
    setPayReference('');
    setPayHistory([]);
    jget(`/api/invoices/${inv.id}/payments`)
      .then(setPayHistory)
      .catch(() => setPayHistory([]));
  };
  const recordPayment = async () => {
    setBusy(true);
    try {
      await jsend(`/api/invoices/${payFor.id}/payments`, 'POST', {
        method,
        amount: Number(payAmount),
        reference: payReference.trim() || undefined,
      });
      toast({ message: t('payments.recorded', { id: payFor.id }), icon: 'check' });
      setPayFor(null);
      load();
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Invoices</div>
          <div className="ph-sub">
            {invoices.length} invoices · {fmt.moneyCompact(outstanding)} outstanding ·{' '}
            {overdue.length} overdue
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-secondary">
            <Icon name="download" size={14} /> Export
          </button>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 'var(--s-5)' }}>
        <Kpi2
          label="Outstanding"
          value={fmt.moneyCompact(outstanding)}
          sub="across open invoices"
          color="var(--warn)"
        />
        <Kpi2
          label="Collected"
          value={fmt.moneyCompact(paidTotal)}
          sub="total paid"
          color="var(--success)"
        />
        <Kpi2
          label="Overdue"
          value={String(overdue.length)}
          sub={`${fmt.moneyCompact(overdue.reduce((s, i) => s + i.balance, 0))} owed`}
          color="var(--danger)"
        />
        <Kpi2 label="Invoices" value={String(invoices.length)} sub="all time" />
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="input-group" style={{ width: 260 }}>
            <Icon name="search" size={14} style={{ color: 'var(--fg-tertiary)' }} />
            <input
              placeholder="Search invoice or customer"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <UI.Select
            aria-label="Status"
            style={{ width: 150 }}
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'paid', label: t('payments.status.paid') },
              { value: 'partial', label: t('payments.status.partial') },
              { value: 'unpaid', label: t('payments.status.unpaid') },
              { value: 'overdue', label: t('payments.status.overdue') },
              { value: 'void', label: t('payments.status.void') },
            ]}
          />
        </div>
        <div className="table-scroll">
          <table className="dt dt-center">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Channel</th>
                <th className="col-num">Total</th>
                <th className="col-num">Paid</th>
                <th className="col-num">Balance</th>
                <th>Status</th>
                <th>{t('payments.dueDate')}</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => {
                const voided = i.displayStatus === 'void';
                return (
                  <tr key={i.id}>
                    <td className="mono" style={{ fontWeight: 500 }}>
                      {i.id}
                    </td>
                    <td>{i.customer}</td>
                    <td className="muted">{i.channel}</td>
                    <td className="col-num mono">{fmt.money(i.total)}</td>
                    <td className="col-num mono muted">{fmt.money(i.paidAmount)}</td>
                    <td
                      className="col-num mono"
                      style={{
                        color: !voided && i.balance > 0 ? 'var(--danger)' : 'var(--fg-tertiary)',
                      }}
                    >
                      {!voided && i.balance > 0 ? fmt.money(i.balance) : '—'}
                    </td>
                    <td>{statusBadge(i.displayStatus)}</td>
                    <td className="muted">{fmtDay(i.dueDate, i.due || '—')}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        trigger={
                          <button className="icon-btn" style={{ width: 26, height: 26 }}>
                            <Icon name="more" size={14} />
                          </button>
                        }
                      >
                        <MenuItem
                          icon="receipt2"
                          label={t('payments.view')}
                          onClick={() => openDetail(i)}
                        />
                        {!voided && i.balance > 0 && (
                          <MenuItem
                            icon="card"
                            label={t('payments.recordPayment')}
                            onClick={() => openPay(i)}
                          />
                        )}
                        {!voided && (
                          <MenuItem
                            icon="x"
                            label={t('payments.void')}
                            onClick={() => voidInvoice(i)}
                          />
                        )}
                      </Dropdown>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <UI.EmptyState
                      icon="receipt2"
                      title="No invoices"
                      body="Invoices created from sales will appear here."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!payFor} onClose={() => !busy && setPayFor(null)}>
        {payFor && (
          <>
            <div
              style={{
                padding: 'var(--s-4) var(--s-5)',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 'var(--t-lg)', fontWeight: 600 }}>
                {t('payments.recordPayment')}
              </h3>
              <button
                className="icon-btn"
                style={{ marginLeft: 'auto' }}
                onClick={() => setPayFor(null)}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div style={{ padding: 'var(--s-5)', display: 'grid', gap: 12 }}>
              <div className="muted tiny">
                {payFor.id} · {payFor.customer} · {t('payments.balance')}{' '}
                <strong className="mono">{fmt.money(payFor.balance)}</strong>
              </div>
              <label className="field">
                <span>{t('payments.method')}</span>
                <select
                  className="select"
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
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
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </label>
              <label className="field">
                <span>{t('payments.reference')}</span>
                <input
                  className="input"
                  placeholder={t('payments.referenceHint')}
                  maxLength={120}
                  value={payReference}
                  onChange={(e) => setPayReference(e.target.value)}
                />
              </label>
              <div style={{ display: 'grid', gap: 6 }}>
                <strong style={{ fontSize: 'var(--t-sm)' }}>{t('payments.history')}</strong>
                <PaymentHistory rows={payHistory} />
              </div>
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
              <button className="btn btn-secondary" onClick={() => setPayFor(null)}>
                {t('payments.cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={recordPayment}
                disabled={busy || !(Number(payAmount) > 0)}
              >
                <Icon name="check" size={14} /> {t('payments.record')}
              </button>
            </div>
          </>
        )}
      </Modal>

      <style>{`@media print {
        body.print-invoice * { visibility: hidden; }
        body.print-invoice #invoice-print, body.print-invoice #invoice-print * { visibility: visible; }
        body.print-invoice #invoice-print { position: absolute; left: 0; top: 0; width: 100%; }
      }`}</style>
      <Modal open={!!detail} onClose={() => setDetail(null)}>
        {detail && (
          <>
            <div
              id="invoice-print"
              style={{ padding: 'var(--s-5)', display: 'grid', gap: 'var(--s-4)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ margin: 0, fontSize: 'var(--t-lg)', fontWeight: 600 }}>
                  Invoice {detail.id}
                </h3>
                <span style={{ marginLeft: 'auto' }}>{statusBadge(detail.displayStatus)}</span>
              </div>
              <div className="muted tiny">
                {detail.customer} · {fmtDay(detail.issueDate, detail.date || '—')} ·{' '}
                {detail.channel}
                {detail.terms === 'credit' && detail.dueDate
                  ? ` · ${t('payments.dueOn', { date: fmtDay(detail.dueDate) })}`
                  : ''}
              </div>
              {detail.lines?.length ? (
                <table className="dt">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="col-num">Qty</th>
                      <th className="col-num">Price</th>
                      <th className="col-num">Disc</th>
                      <th className="col-num">GST</th>
                      <th className="col-num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lines.map((l: any) => (
                      <tr key={l.id}>
                        <td>
                          {l.name}
                          <div className="muted tiny mono">
                            {l.sku}
                            {l.hsnCode ? ` · HSN ${l.hsnCode}` : ''}
                          </div>
                        </td>
                        <td className="col-num mono">{l.qty}</td>
                        <td className="col-num mono">{fmt.money(l.unitPrice)}</td>
                        <td className="col-num mono">{fmt.money(l.discount)}</td>
                        <td className="col-num mono">
                          {l.gstRate}% · {fmt.money(l.gstAmount)}
                        </td>
                        <td className="col-num mono">{fmt.money(l.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="muted tiny">{t('payments.noLines')}</div>
              )}
              <div style={{ display: 'grid', gap: 4, justifySelf: 'end', minWidth: 240 }}>
                <div className="muted">Subtotal · {fmt.money(detail.subtotal)}</div>
                <div className="muted">Tax · {fmt.money(detail.tax)}</div>
                <div style={{ fontWeight: 600 }}>
                  {t('payments.total')} · {fmt.money(detail.total)}
                </div>
                <div className="muted">
                  {t('payments.paid')} · {fmt.money(detail.paidAmount)}
                </div>
                <div className="muted">
                  {t('payments.balance')} · {fmt.money(detail.balance)}
                </div>
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <strong style={{ fontSize: 'var(--t-sm)' }}>{t('payments.history')}</strong>
                <PaymentHistory rows={detail.payments ?? []} />
              </div>
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
              {detail.displayStatus !== 'void' && (
                <button className="btn btn-secondary" onClick={() => voidInvoice(detail)}>
                  {t('payments.void')}
                </button>
              )}
              <button className="btn btn-primary" onClick={printInvoice}>
                <Icon name="printer" size={14} /> {t('payments.print')}
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
