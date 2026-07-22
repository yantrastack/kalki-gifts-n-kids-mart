'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget } from '@/lib/api';

const REPORTS = [
  { id: 'valuation', label: 'Inventory valuation', icon: 'box', desc: 'Stock value by warehouse' },
  { id: 'lowStock', label: 'Low / out of stock', icon: 'alert', desc: 'Items needing reorder' },
  { id: 'salesByStatus', label: 'Sales by status', icon: 'cart', desc: 'Order pipeline' },
  { id: 'supplierPerf', label: 'Supplier performance', icon: 'truck', desc: 'On-time & spend' },
  {
    id: 'receivables',
    label: 'Accounts receivable',
    icon: 'receipt2',
    desc: 'Outstanding by status',
  },
];

const COLUMNS: Record<
  string,
  { key: string; label: string; num?: boolean; money?: boolean; pct?: boolean; badge?: boolean }[]
> = {
  valuation: [
    { key: 'warehouse', label: 'Warehouse' },
    { key: 'lines', label: 'SKUs', num: true },
    { key: 'units', label: 'Units', num: true },
    { key: 'cost', label: 'Cost value', num: true, money: true },
    { key: 'retail', label: 'Retail value', num: true, money: true },
    { key: 'potentialMargin', label: 'Potential margin', num: true, money: true },
  ],
  lowStock: [
    { key: 'name', label: 'Product' },
    { key: 'sku', label: 'SKU' },
    { key: 'warehouse', label: 'Warehouse' },
    { key: 'stock', label: 'On hand', num: true },
    { key: 'incoming', label: 'Incoming', num: true },
    { key: 'status', label: 'Status', badge: true },
  ],
  salesByStatus: [
    { key: 'status', label: 'Status', badge: true },
    { key: 'count', label: 'Orders', num: true },
    { key: 'value', label: 'Value', num: true, money: true },
  ],
  supplierPerf: [
    { key: 'name', label: 'Supplier' },
    { key: 'onTime', label: 'On-time', num: true, pct: true },
    { key: 'spend', label: 'Total spend', num: true, money: true },
    { key: 'lastOrder', label: 'Last order' },
  ],
  receivables: [
    { key: 'status', label: 'Status', badge: true },
    { key: 'outstanding', label: 'Outstanding', num: true, money: true },
  ],
};

export default function ReportsPage() {
  const { fmt, statusBadge, EmptyState } = UI;
  const [data, setData] = useState<any>(null);
  const [active, setActive] = useState('valuation');
  useEffect(() => {
    jget('/api/reports').then(setData);
  }, []);

  const rows = data?.[active] || [];
  const cols = COLUMNS[active];

  const exportCsv = () => {
    const header = cols.map((c) => c.label).join(',');
    const lines = rows.map((r: any) => cols.map((c) => `"${r[c.key]}"`).join(','));
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${active}-report.csv`;
    a.click();
  };

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Reports</div>
          <div className="ph-sub">Operational reports across inventory, sales and suppliers.</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-primary" onClick={exportCsv} disabled={!rows.length}>
            <Icon name="download" size={14} /> Export CSV
          </button>
        </div>
      </div>

      <div
        style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 'var(--s-4)' }}
        className="reports-layout"
      >
        <div className="card" style={{ padding: 8, alignSelf: 'start' }}>
          {REPORTS.map((r) => (
            <button
              key={r.id}
              onClick={() => setActive(r.id)}
              className="report-item"
              style={{ background: active === r.id ? 'var(--bg-active)' : 'transparent' }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: 'var(--bg-muted)',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--accent)',
                }}
              >
                <Icon name={r.icon} size={15} />
              </div>
              <div style={{ minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: 'var(--t-sm)', fontWeight: 500 }}>{r.label}</div>
                <div className="muted tiny">{r.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <div className="table-wrap" style={{ alignSelf: 'start' }}>
          <div className="table-toolbar">
            <div style={{ fontWeight: 600, fontSize: 'var(--t-md)' }}>
              {REPORTS.find((r) => r.id === active)?.label}
            </div>
            <span className="muted tiny" style={{ marginLeft: 'auto' }}>
              {rows.length} rows
            </span>
          </div>
          {!data ? (
            <div className="page-loading">Loading…</div>
          ) : rows.length === 0 ? (
            <EmptyState icon="file" title="No data" />
          ) : (
            <div className="table-scroll">
              <table className="dt">
                <thead>
                  <tr>
                    {cols.map((c) => (
                      <th key={c.key} className={c.num ? 'col-num' : ''}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any, i: number) => (
                    <tr key={i}>
                      {cols.map((c) => (
                        <td
                          key={c.key}
                          className={(c.num ? 'col-num ' : '') + (c.money || c.num ? 'mono' : '')}
                        >
                          {c.badge
                            ? statusBadge(r[c.key])
                            : c.money
                              ? fmt.money(r[c.key])
                              : c.pct
                                ? fmt.pct(r[c.key])
                                : c.num
                                  ? fmt.int(r[c.key])
                                  : r[c.key]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
