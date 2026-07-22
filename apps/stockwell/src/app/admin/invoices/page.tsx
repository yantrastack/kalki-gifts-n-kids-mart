'use client';
import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget, jsend } from '@/lib/api';

export default function InvoicesPage() {
  const { fmt, statusBadge, Kpi2, Modal, Dropdown, MenuItem, useToast } = UI;
  const toast = useToast();
  const [invoices, setInvoices] = useState<any[]>([]);
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [payFor, setPayFor] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');

  const load = () => jget('/api/invoices').then(setInvoices);
  useEffect(() => {
    load();
  }, []);

  const outstanding = invoices.reduce((s, i) => s + (i.total - (i.paid || 0)), 0);
  const overdue = invoices.filter((i) => i.status === 'overdue');
  const paidTotal = invoices.reduce((s, i) => s + (i.paid || 0), 0);

  const filtered = useMemo(
    () =>
      invoices.filter((i) => {
        if (filter !== 'all' && i.status !== filter) return false;
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

  const openPay = (inv: any) => {
    setPayFor(inv);
    setPayAmount(String((inv.total - (inv.paid || 0)).toFixed(2)));
  };
  const recordPayment = async () => {
    try {
      await jsend(`/api/invoices/${payFor.id}`, 'PUT', { pay: Number(payAmount), method: 'Card' });
      toast({ message: `Payment recorded for ${payFor.id}`, icon: 'check' });
      setPayFor(null);
      load();
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
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
          sub={`${fmt.moneyCompact(overdue.reduce((s, i) => s + (i.total - i.paid), 0))} owed`}
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
          <select
            className="select"
            style={{ width: 150 }}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        <div className="table-scroll">
          <table className="dt">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Channel</th>
                <th className="col-num">Total</th>
                <th className="col-num">Paid</th>
                <th className="col-num">Balance</th>
                <th>Status</th>
                <th>Due</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id}>
                  <td className="mono" style={{ fontWeight: 500 }}>
                    {i.id}
                  </td>
                  <td>{i.customer}</td>
                  <td className="muted">{i.channel}</td>
                  <td className="col-num mono">{fmt.money(i.total)}</td>
                  <td className="col-num mono muted">{fmt.money(i.paid)}</td>
                  <td
                    className="col-num mono"
                    style={{ color: i.total - i.paid > 0 ? 'var(--danger)' : 'var(--fg-tertiary)' }}
                  >
                    {i.total - i.paid > 0 ? fmt.money(i.total - i.paid) : '—'}
                  </td>
                  <td>{statusBadge(i.status)}</td>
                  <td className="muted">{i.due}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      trigger={
                        <button className="icon-btn" style={{ width: 26, height: 26 }}>
                          <Icon name="more" size={14} />
                        </button>
                      }
                    >
                      {i.total - i.paid > 0 && (
                        <MenuItem icon="card" label="Record payment" onClick={() => openPay(i)} />
                      )}
                      <MenuItem icon="printer" label="Print / PDF" onClick={() => window.print()} />
                    </Dropdown>
                  </td>
                </tr>
              ))}
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

      <Modal open={!!payFor} onClose={() => setPayFor(null)}>
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
                Record payment
              </h3>
              <button
                className="icon-btn"
                style={{ marginLeft: 'auto' }}
                onClick={() => setPayFor(null)}
              >
                <Icon name="x" size={16} />
              </button>
            </div>
            <div style={{ padding: 'var(--s-5)' }}>
              <div className="muted tiny" style={{ marginBottom: 12 }}>
                {payFor.id} · {payFor.customer} · balance{' '}
                <strong className="mono">{fmt.money(payFor.total - payFor.paid)}</strong>
              </div>
              <label className="field">
                <span>Amount</span>
                <input
                  className="input"
                  type="number"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
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
              <button className="btn btn-secondary" onClick={() => setPayFor(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={recordPayment}
                disabled={!Number(payAmount)}
              >
                <Icon name="check" size={14} /> Record
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
