'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget } from '@/lib/api';

export default function OrdersPage() {
  const { fmt, Kpi2, statusBadge } = UI;
  const [sales, setSales] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [tab, setTab] = useState('sales');
  useEffect(() => {
    jget('/api/sales-orders').then(setSales);
    jget('/api/purchase-orders').then(setPos);
  }, []);

  const openPOs = pos.filter((o) => ['draft', 'approved', 'shipped'].includes(o.status));
  const poOutstanding = openPOs.reduce((s, o) => s + o.total, 0);
  const unpaid = sales.filter((o) => o.payment !== 'paid');
  const salesMtd = sales.reduce((s, o) => s + o.total, 0);

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Orders</div>
          <div className="ph-sub">Track purchase and sales orders across your channels.</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-secondary">
            <Icon name="download" size={14} /> Export
          </button>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 'var(--s-5)' }}>
        <Kpi2
          label="Sales total"
          value={fmt.moneyCompact(salesMtd)}
          sub={`${sales.length} orders`}
        />
        <Kpi2
          label="Open POs"
          value={String(openPOs.length)}
          sub={`${fmt.moneyCompact(poOutstanding)} outstanding`}
        />
        <Kpi2
          label="Awaiting payment"
          value={String(unpaid.length)}
          sub={`${fmt.moneyCompact(unpaid.reduce((s, o) => s + o.total, 0))} unpaid`}
        />
        <Kpi2 label="Purchase orders" value={String(pos.length)} sub="all statuses" />
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'sales' ? 'active' : ''}`} onClick={() => setTab('sales')}>
          Sales orders{' '}
          <span className="badge muted" style={{ marginLeft: 4 }}>
            {sales.length}
          </span>
        </div>
        <div
          className={`tab ${tab === 'purchase' ? 'active' : ''}`}
          onClick={() => setTab('purchase')}
        >
          Purchase orders{' '}
          <span className="badge muted" style={{ marginLeft: 4 }}>
            {pos.length}
          </span>
        </div>
      </div>

      {tab === 'sales' && (
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="dt">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="col-num">Items</th>
                  <th className="col-num">Total</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {sales.map((o) => (
                  <tr key={o.id}>
                    <td className="mono" style={{ fontWeight: 500 }}>
                      {o.id}
                    </td>
                    <td>{o.customer}</td>
                    <td className="col-num">{o.items}</td>
                    <td className="col-num mono">{fmt.money(o.total)}</td>
                    <td>{statusBadge(o.status)}</td>
                    <td>{statusBadge(o.payment)}</td>
                    <td className="muted">{o.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {tab === 'purchase' && (
        <div className="table-wrap">
          <div className="table-scroll">
            <table className="dt">
              <thead>
                <tr>
                  <th>PO</th>
                  <th>Supplier</th>
                  <th className="col-num">Items</th>
                  <th className="col-num">Total</th>
                  <th>Status</th>
                  <th>ETA</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {pos.map((o) => (
                  <tr key={o.id}>
                    <td className="mono" style={{ fontWeight: 500 }}>
                      {o.id}
                    </td>
                    <td>{o.supplier}</td>
                    <td className="col-num">{o.items}</td>
                    <td className="col-num mono">{fmt.money(o.total)}</td>
                    <td>{statusBadge(o.status)}</td>
                    <td className="muted">{o.eta}</td>
                    <td className="muted">{o.created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
