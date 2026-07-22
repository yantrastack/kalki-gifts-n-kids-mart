'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget } from '@/lib/api';

const SALES_SERIES = [
  18420, 19840, 17320, 22140, 24820, 21640, 19920, 23420, 25240, 27120, 24820, 26420, 28840, 31200,
  29420, 28140, 30220, 32440, 34120, 31840, 33620, 36120, 38420, 36240, 39120, 41420, 39840, 42120,
  44320, 46820,
];

export default function DashboardPage() {
  const { fmt, Kpi, LineChart, Donut, Avatar, statusBadge } = UI;
  const [range, setRange] = useState('30d');
  const [data, setData] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [moves, setMoves] = useState<any[]>([]);

  useEffect(() => {
    jget('/api/dashboard').then((d) => {
      setData(d);
      setMoves(d.recentMoves || []);
    });
    jget('/api/sales-orders').then(setOrders);
  }, []);

  if (!data)
    return (
      <div className="page">
        <div className="page-loading">Loading dashboard…</div>
      </div>
    );
  const k = data.kpis;
  const series =
    range === '7d'
      ? SALES_SERIES.slice(-7)
      : range === '90d'
        ? [...SALES_SERIES, ...SALES_SERIES, ...SALES_SERIES].slice(0, 90)
        : SALES_SERIES;

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Good afternoon, Owen</div>
          <div className="ph-sub">
            Here&apos;s what&apos;s happening across your inventory today.
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-secondary">
            <Icon name="calendar" size={14} /> Last 30 days <Icon name="chevDown" size={12} />
          </button>
          <button className="btn btn-secondary">
            <Icon name="download" size={14} /> Export
          </button>
          <Link href="/admin/products" className="btn btn-primary">
            <Icon name="plus" size={14} /> New product
          </Link>
        </div>
      </div>

      <div className="kpi-grid" style={{ marginBottom: 'var(--s-5)' }}>
        <Kpi
          label="Total products"
          value={fmt.int(k.productCount)}
          delta="+18"
          spark={[820, 824, 826, 830, 828, 834, 838, 840, 839, 842]}
          icon="box"
        />
        <Kpi
          label="Low stock items"
          value={fmt.int(k.lowStock)}
          delta="+3"
          spark={[8, 9, 10, 11, 9, 12, 13, 14, 12, 14]}
          icon="alert"
          sparkColor="var(--warn)"
        />
        <Kpi
          label="Out of stock"
          value={fmt.int(k.outOfStock)}
          delta="-1"
          spark={[4, 4, 3, 3, 3, 2, 3, 2, 3, 2]}
          icon="x"
        />
        <Kpi
          label="Inventory value (cost)"
          value={fmt.moneyCompact(k.inventoryValue)}
          delta="+12.4%"
          spark={SALES_SERIES.slice(-14)}
          icon="trending_up"
        />
      </div>

      <div className="dash-row-2" style={{ marginBottom: 'var(--s-5)' }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Revenue</div>
              <div className="card-subtitle">Daily sales · last 30 days</div>
            </div>
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-muted)',
                borderRadius: 'var(--r-md)',
                padding: 2,
              }}
            >
              {['7d', '30d', '90d'].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 'var(--t-sm)',
                    fontWeight: 500,
                    borderRadius: 'var(--r-sm)',
                    background: range === r ? 'var(--bg-elev)' : 'transparent',
                    color: range === r ? 'var(--fg)' : 'var(--fg-secondary)',
                    boxShadow: range === r ? 'var(--shadow-xs)' : 'none',
                  }}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 12 }}>
              <div>
                <div
                  style={{
                    fontSize: 'var(--t-3xl)',
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmt.money(series.reduce((a, b) => a + b, 0))}
                </div>
                <div className="kpi-delta up" style={{ marginTop: 2 }}>
                  <Icon name="arrowUp" size={12} /> +12.4%{' '}
                  <span className="dim" style={{ fontFamily: 'var(--font-sans)' }}>
                    vs. previous 30 days
                  </span>
                </div>
              </div>
            </div>
            <LineChart data={series} height={240} />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Category mix</div>
              <div className="card-subtitle">Share of retail value</div>
            </div>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
              <Donut
                data={data.categories}
                centerLabel="Categories"
                centerValue={String(data.categories.length)}
              />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  flex: 1,
                  minWidth: 160,
                }}
              >
                {data.categories.map((c: any) => (
                  <div key={c.name} className="spread">
                    <div className="row" style={{ gap: 8 }}>
                      <span
                        style={{ width: 10, height: 10, borderRadius: 3, background: c.color }}
                      />
                      <span style={{ fontSize: 'var(--t-base)' }}>{c.name}</span>
                    </div>
                    <span className="mono" style={{ color: 'var(--fg-secondary)' }}>
                      {fmt.pct(c.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="dash-row-2" style={{ marginBottom: 'var(--s-5)' }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Recent stock movement</div>
              <div className="card-subtitle">All warehouses</div>
            </div>
            <Link href="/admin/inventory" className="btn btn-ghost btn-sm">
              Open log <Icon name="arrowRight" size={12} />
            </Link>
          </div>
          <div className="card-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
            {moves.slice(0, 6).map((a: any) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  gap: 10,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--border-subtle)',
                }}
              >
                <Avatar name={a.who} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--t-base)', lineHeight: 1.4 }}>
                    <span
                      className="mono"
                      style={{
                        fontWeight: 600,
                        color: a.qty > 0 ? 'var(--success)' : 'var(--danger)',
                      }}
                    >
                      {a.qty > 0 ? '+' : ''}
                      {a.qty}
                    </span>{' '}
                    · {a.product}
                  </div>
                  <div
                    style={{ fontSize: 'var(--t-xs)', color: 'var(--fg-tertiary)', marginTop: 2 }}
                  >
                    {a.who} · {a.warehouse} · {a.meta}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Quick actions</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              { icon: 'plus', label: 'New product', sub: 'Add to catalog', go: '/products' },
              { icon: 'receipt', label: 'Sales orders', sub: 'Create + invoice', go: '/orders' },
              { icon: 'truck', label: 'Suppliers', sub: 'Manage vendors', go: '/suppliers' },
              { icon: 'layers', label: 'Adjust stock', sub: 'Inventory moves', go: '/inventory' },
              { icon: 'users', label: 'Customers', sub: 'Directory', go: '/customers' },
            ].map((q, i) => (
              <Link
                key={i}
                href={q.go}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 'var(--r-md)',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
                className="qa-row"
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: 'var(--bg-muted)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--fg-secondary)',
                  }}
                >
                  <Icon name={q.icon} size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--t-base)', fontWeight: 500 }}>{q.label}</div>
                  <div style={{ fontSize: 'var(--t-xs)', color: 'var(--fg-tertiary)' }}>
                    {q.sub}
                  </div>
                </div>
                <Icon name="chevRight" size={14} style={{ color: 'var(--fg-tertiary)' }} />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recent sales orders</div>
            <div className="card-subtitle">Latest {Math.min(orders.length, 8)} orders</div>
          </div>
          <Link href="/admin/orders" className="btn btn-ghost btn-sm">
            View all <Icon name="arrowRight" size={12} />
          </Link>
        </div>
        <div className="table-scroll">
          <table className="dt">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th className="col-num">Items</th>
                <th className="col-num">Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 8).map((o: any) => (
                <tr key={o.id}>
                  <td className="mono" style={{ fontWeight: 500 }}>
                    {o.id}
                  </td>
                  <td>{o.customer}</td>
                  <td className="col-num">{o.items}</td>
                  <td className="col-num mono">{fmt.money(o.total)}</td>
                  <td>{statusBadge(o.status)}</td>
                  <td className="muted">{o.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
