'use client';
import type React from 'react';
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
  {
    key: string;
    label: string;
    num?: boolean;
    money?: boolean;
    pct?: boolean;
    badge?: boolean;
    // Centred like the numeric columns, so the date sits under its heading.
    date?: boolean;
  }[]
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
    { key: 'lastOrder', label: 'Last order', date: true },
  ],
  receivables: [
    { key: 'status', label: 'Status', badge: true },
    { key: 'outstanding', label: 'Outstanding', num: true, money: true },
  ],
};

// Minimum width (px, padding included) per column type, so every count/amount/date/
// status column gets the same dedicated width in every report. The minimums double
// as the columns' relative weights, so all columns reach their minimum together at
// the table's min-width; below that the report scrolls horizontally instead of
// squeezing or clipping. The first (label) column is capped at 40%, so short
// reports spread the value columns wider instead of leaving a wide empty label column.
// The table uses `table-layout: fixed`, so these <col> widths are the only source of
// column boundaries — header and body cells can never size a column differently.
const COL_MIN = { label: 200, count: 92, pct: 84, money: 128, date: 96, status: 132, text: 128 };
type Col = (typeof COLUMNS)[string][number];
// Value columns (count/amount/percent/date/status) centre heading and values
// alike, so each value sits directly under its heading; text columns stay left.
// The same class goes on the <th> and every <td> of the column.
const alignClass = (c: Col) => (c.num || c.date || c.badge ? 'col-center' : '');
const colType = (c: Col): keyof typeof COL_MIN =>
  c.money
    ? 'money'
    : c.pct
      ? 'pct'
      : c.num
        ? 'count'
        : c.date
          ? 'date'
          : c.badge
            ? 'status'
            : 'text';
const colSizing = (cols: Col[]) => {
  const mins = cols.slice(1).map((c) => COL_MIN[colType(c)]);
  const total = mins.reduce((a, b) => a + b, 0);
  const share = Math.max((total / (total + COL_MIN.label)) * 100, 60);
  return {
    widths: [100 - share, ...mins.map((m) => (m * share) / total)],
    minWidth: Math.ceil(Math.max(total / (share / 100), COL_MIN.label / (1 - share / 100))),
  };
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
  const sizing = colSizing(cols);

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
            <div className="table-scroll dt-report-scroll">
              <table
                className="dt dt-report"
                data-density="compact"
                style={{ '--report-min': `${sizing.minWidth}px` } as React.CSSProperties}
              >
                <colgroup>
                  {sizing.widths.map((w, i) => (
                    <col key={cols[i].key} style={{ width: `${w}%` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {cols.map((c) => (
                      <th key={c.key} className={alignClass(c)}>
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
                          className={`${alignClass(c)} ${c.num ? 'mono' : ''}`.trim()}
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
