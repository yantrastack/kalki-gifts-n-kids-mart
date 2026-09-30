'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget, jsend } from '@/lib/api';

const modalHead = (title: string, onClose: () => void) => (
  <div
    style={{
      padding: 'var(--s-4) var(--s-5)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
    }}
  >
    <h3 style={{ margin: 0, fontSize: 'var(--t-lg)', fontWeight: 600 }}>{title}</h3>
    <button className="icon-btn" style={{ marginLeft: 'auto' }} onClick={onClose}>
      <Icon name="x" size={16} />
    </button>
  </div>
);

function PODetailModal({ poId, onClose, onChanged }: any) {
  const { fmt, statusBadge } = UI;
  const toast = UI.useToast();
  const [po, setPo] = useState<any>(null);
  const [recv, setRecv] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);

  const load = () =>
    jget(`/api/purchase-orders/${poId}`).then((p) => {
      setPo(p);
      const r: Record<number, string> = {};
      for (const l of p.lines) r[l.id] = String(l.qty - l.received);
      setRecv(r);
    });
  useEffect(() => {
    if (poId) load();
  }, [poId]);

  const receivable = po && !['received', 'cancelled'].includes(po.status);

  const receive = async () => {
    setBusy(true);
    try {
      const lines = po.lines
        .map((l: any) => ({ itemId: l.id, qty: Number(recv[l.id]) || 0 }))
        .filter((l: any) => l.qty > 0);
      const updated = await jsend(`/api/purchase-orders/${poId}/receive`, 'POST', { lines });
      toast({
        message: `Delivery received — ${poId} is ${updated.status}. Stock updated.`,
        icon: 'check',
      });
      onChanged();
      load();
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <UI.Modal open={!!poId} onClose={() => !busy && onClose()} large>
      {modalHead(poId || '', onClose)}
      {po && (
        <>
          <div
            style={{
              padding: 'var(--s-4) var(--s-5)',
              display: 'flex',
              gap: 20,
              alignItems: 'center',
              borderBottom: '1px solid var(--border-subtle)',
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div className="muted tiny">Supplier</div>
              <div style={{ fontWeight: 600 }}>{po.supplier}</div>
            </div>
            <div>
              <div className="muted tiny">Status</div>
              {statusBadge(po.status)}
            </div>
            <div>
              <div className="muted tiny">ETA</div>
              <div>{po.eta}</div>
            </div>
            {po.invoiceNo && (
              <div>
                <div className="muted tiny">Invoice</div>
                <div className="mono">{po.invoiceNo}</div>
              </div>
            )}
            {po.invoiceDate && (
              <div>
                <div className="muted tiny">Invoice date</div>
                <div>{po.invoiceDate}</div>
              </div>
            )}
            {po.enteredDate && (
              <div>
                <div className="muted tiny">Entered on</div>
                <div>{po.enteredDate}</div>
              </div>
            )}
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div className="muted tiny">Total</div>
              <div className="mono" style={{ fontWeight: 700 }}>
                {fmt.money(po.total)}
              </div>
            </div>
          </div>
          <div style={{ padding: 'var(--s-4) var(--s-5)', maxHeight: '48vh', overflow: 'auto' }}>
            {po.lines.length === 0 ? (
              <div className="muted" style={{ padding: 12 }}>
                No line items on this order (created before itemised purchases).
              </div>
            ) : (
              <table className="dt" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th className="col-num">Ordered</th>
                    <th className="col-num">Free</th>
                    <th className="col-num">Received</th>
                    <th className="col-num">Unit cost</th>
                    <th>Batch</th>
                    <th>Expiry</th>
                    {receivable && <th className="col-num">Receive now</th>}
                  </tr>
                </thead>
                <tbody>
                  {po.lines.map((l: any) => (
                    <tr key={l.id} style={{ cursor: 'default' }}>
                      <td>
                        {l.product}
                        <span className="muted tiny mono" style={{ marginLeft: 6 }}>
                          {l.sku}
                        </span>
                        {!!l.isNew && (
                          <span className="badge badge-info" style={{ marginLeft: 6 }}>
                            new
                          </span>
                        )}
                      </td>
                      <td className="col-num mono">{l.qty}</td>
                      <td className="col-num mono">{l.free || '—'}</td>
                      <td className="col-num mono">{l.received}</td>
                      <td className="col-num mono">{fmt.money(l.cost)}</td>
                      <td className="muted tiny mono">{l.batchNo || '—'}</td>
                      <td className="muted tiny">
                        {l.expiry || '—'}
                        {l.scheme ? ` · ${l.scheme}` : ''}
                      </td>
                      {receivable && (
                        <td className="col-num" style={{ width: 90 }}>
                          <input
                            className="input"
                            type="number"
                            min={0}
                            max={l.qty - l.received}
                            value={recv[l.id] ?? ''}
                            onChange={(e) =>
                              setRecv((r) => ({ ...r, [l.id]: e.target.value }))
                            }
                            style={{ width: 76, textAlign: 'right' }}
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div
            style={{
              padding: 'var(--s-3) var(--s-5)',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 8,
              background: 'var(--bg-muted)',
            }}
          >
            {po.status !== 'cancelled' && po.lines.length > 0 && (
              <Link
                href={`/admin/purchases/${encodeURIComponent(po.id)}`}
                className="btn btn-secondary"
                style={{ marginRight: 'auto' }}
              >
                <Icon name="edit" size={14} /> Edit purchase
              </Link>
            )}
            <button className="btn btn-secondary" onClick={onClose} disabled={busy}>
              Close
            </button>
            {receivable && po.lines.length > 0 && (
              <button className="btn btn-primary" onClick={receive} disabled={busy}>
                <Icon name="check" size={14} />{' '}
                {busy ? 'Receiving…' : 'Receive delivery'}
              </button>
            )}
          </div>
        </>
      )}
    </UI.Modal>
  );
}

export default function OrdersPage() {
  const { fmt, Kpi2, statusBadge } = UI;
  const [sales, setSales] = useState<any[]>([]);
  const [pos, setPos] = useState<any[]>([]);
  const [tab, setTab] = useState('sales');
  const [openPo, setOpenPo] = useState<string | null>(null);

  const load = () => {
    jget('/api/sales-orders').then(setSales);
    jget('/api/purchase-orders').then(setPos);
  };
  useEffect(load, []);

  const openPOs = pos.filter((o) => ['draft', 'approved', 'shipped', 'partial'].includes(o.status));
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
          <Link href="/admin/purchases/new" className="btn btn-primary">
            <Icon name="plus" size={14} /> New purchase
          </Link>
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
                  <tr key={o.id} onClick={() => setOpenPo(o.id)}>
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

      <PODetailModal poId={openPo} onClose={() => setOpenPo(null)} onChanged={load} />
    </div>
  );
}
