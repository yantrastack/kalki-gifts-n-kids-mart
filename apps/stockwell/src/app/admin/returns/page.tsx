'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget, jsend } from '@/lib/api';

export default function ReturnsPage() {
  const { fmt, statusBadge, Kpi2, Dropdown, MenuItem, useToast } = UI;
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const load = () => jget('/api/returns').then(setRows);
  useEffect(() => {
    load();
  }, []);

  const pending = rows.filter((r) => r.status === 'pending');
  const refunded = rows.filter((r) => r.status === 'refunded');
  const refundValue = refunded.reduce((s, r) => s + r.total, 0);

  const setStatus = async (id: string, status: string) => {
    try {
      await jsend(`/api/returns/${id}`, 'PUT', { status });
      toast({ message: `${id} → ${status}`, icon: 'check' });
      load();
    } catch (e: any) {
      toast({ message: e.message, icon: 'alert', type: 'danger' });
    }
  };

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Returns</div>
          <div className="ph-sub">
            {rows.length} RMAs · {pending.length} pending · {fmt.moneyCompact(refundValue)} refunded
          </div>
        </div>
      </div>
      <div className="kpi-grid" style={{ marginBottom: 'var(--s-5)' }}>
        <Kpi2
          label="Open RMAs"
          value={String(pending.length)}
          sub="awaiting review"
          color="var(--warn)"
        />
        <Kpi2
          label="Refunded"
          value={String(refunded.length)}
          sub={`${fmt.moneyCompact(refundValue)} total`}
        />
        <Kpi2
          label="Approved"
          value={String(rows.filter((r) => r.status === 'approved').length)}
          sub="ready to refund"
          color="var(--info)"
        />
        <Kpi2 label="Total" value={String(rows.length)} sub="all returns" />
      </div>
      <div className="table-wrap">
        <div className="table-scroll">
          <table className="dt">
            <thead>
              <tr>
                <th>RMA</th>
                <th>Customer</th>
                <th>Invoice</th>
                <th className="col-num">Items</th>
                <th className="col-num">Value</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ width: 36 }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="mono" style={{ fontWeight: 500 }}>
                    {r.id}
                  </td>
                  <td>{r.customer}</td>
                  <td className="mono muted">{r.invoice}</td>
                  <td className="col-num">{r.items}</td>
                  <td className="col-num mono">{fmt.money(r.total)}</td>
                  <td className="muted">{r.reason}</td>
                  <td>{statusBadge(r.status)}</td>
                  <td className="muted">{r.date}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      trigger={
                        <button className="icon-btn" style={{ width: 26, height: 26 }}>
                          <Icon name="more" size={14} />
                        </button>
                      }
                    >
                      <MenuItem
                        icon="check"
                        label="Approve"
                        onClick={() => setStatus(r.id, 'approved')}
                      />
                      <MenuItem
                        icon="refund"
                        label="Mark refunded"
                        onClick={() => setStatus(r.id, 'refunded')}
                      />
                      <MenuItem
                        icon="x"
                        label="Reject"
                        danger
                        onClick={() => setStatus(r.id, 'rejected')}
                      />
                    </Dropdown>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <UI.EmptyState
                      icon="refund"
                      title="No returns"
                      body="Return requests will appear here."
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
