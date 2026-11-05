'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget } from '@/lib/api';
import { DASHBOARD_RANGES, type DashboardRange, isoDay, rangeDays } from '@/lib/dashboardRange';
import { useI18n } from '@/i18n';

// Every target is under /admin (the storefront owns /). YAN-115.
const QUICK_ACTIONS = [
  { icon: 'plus', key: 'newProduct', href: '/admin/products?new=1' },
  { icon: 'receipt', key: 'newSale', href: '/admin/pos' },
  { icon: 'truck', key: 'suppliers', href: '/admin/suppliers' },
  { icon: 'layers', key: 'adjustStock', href: '/admin/inventory' },
  { icon: 'users', key: 'customers', href: '/admin/customers' },
] as const;

const SALES_SERIES = [
  18420, 19840, 17320, 22140, 24820, 21640, 19920, 23420, 25240, 27120, 24820, 26420, 28840, 31200,
  29420, 28140, 30220, 32440, 34120, 31840, 33620, 36120, 38420, 36240, 39120, 41420, 39840, 42120,
  44320, 46820,
];

const csvCell = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export default function DashboardPage() {
  const { fmt, Kpi, LineChart, Donut, Avatar, statusBadge, Dropdown, MenuItem, EmptyState } = UI;
  const { t } = useI18n();
  const [range, setRange] = useState<DashboardRange>('30d');
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    let live = true;
    jget(`/api/dashboard?range=${range}`).then((d) => {
      if (live) setData(d);
    });
    return () => {
      live = false;
    };
  }, [range]);

  if (!data)
    return (
      <div className="page">
        <div className="page-loading">Loading dashboard…</div>
      </div>
    );
  const k = data.kpis;
  const days = rangeDays(range);
  const orders: any[] = data.recentOrders || [];
  const moves: any[] = data.recentMoves || [];
  const series: number[] = data.revenue.series.map((p: any) => p.total);
  const { total: revenueTotal, prevTotal } = data.revenue;
  const revenueDelta = prevTotal > 0 ? (revenueTotal - prevTotal) / prevTotal : null;

  const exportCsv = () => {
    const c = (key: string) => t(`dashboard.csv.${key}`);
    const rows: unknown[][] = [
      [c('section'), c('metric'), c('value')],
      [c('range'), t('dashboard.lastNDays', { n: days }), ''],
      [c('kpis'), c('productCount'), k.productCount],
      [c('kpis'), c('lowStock'), k.lowStock],
      [c('kpis'), c('outOfStock'), k.outOfStock],
      [c('kpis'), c('inventoryValue'), fmt.money(k.inventoryValue)],
      [c('kpis'), c('retailValue'), fmt.money(k.retailValue)],
      [c('kpis'), c('revenueTotal'), fmt.money(revenueTotal)],
      [c('kpis'), c('revenuePrev'), fmt.money(prevTotal)],
      [],
      [c('revenue'), c('date'), c('total')],
      ...data.revenue.series.map((p: any) => [c('revenue'), p.date, fmt.money(p.total)]),
      [],
      [c('categories'), c('metric'), c('value')],
      ...data.categories.map((cat: any) => [c('categories'), cat.name, fmt.pct(cat.value)]),
      [],
      [c('order'), c('customer'), c('items'), c('total'), c('status'), c('date')],
      ...orders.map((o) => [o.id, o.customer, o.items, fmt.money(o.total), o.status, o.date]),
    ];
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
    // BOM so spreadsheet apps read ₹ and Telugu text as UTF-8.
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-${range}-${isoDay(new Date())}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

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
          <Dropdown
            trigger={
              <button type="button" className="btn btn-secondary">
                <Icon name="calendar" size={14} /> {t('dashboard.lastNDays', { n: days })}{' '}
                <Icon name="chevDown" size={12} />
              </button>
            }
          >
            {DASHBOARD_RANGES.map((r) => (
              <MenuItem
                key={r}
                icon={r === range ? 'check' : undefined}
                label={t('dashboard.lastNDays', { n: rangeDays(r) })}
                onClick={() => setRange(r)}
              />
            ))}
          </Dropdown>
          <button type="button" className="btn btn-secondary" onClick={exportCsv}>
            <Icon name="download" size={14} /> {t('dashboard.export')}
          </button>
          <Link href="/admin/products?new=1" className="btn btn-primary">
            <Icon name="plus" size={14} /> {t('dashboard.quickActions.newProduct')}
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
              <div className="card-subtitle">{t('dashboard.revenueSub', { n: days })}</div>
            </div>
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-muted)',
                borderRadius: 'var(--r-md)',
                padding: 2,
              }}
            >
              {DASHBOARD_RANGES.map((r) => (
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
                  {fmt.money(revenueTotal)}
                </div>
                <div
                  className={`kpi-delta ${revenueDelta == null ? '' : revenueDelta >= 0 ? 'up' : 'down'}`}
                  style={{ marginTop: 2 }}
                >
                  {revenueDelta == null ? (
                    '—'
                  ) : (
                    <>
                      <Icon name={revenueDelta >= 0 ? 'arrowUp' : 'arrowDown'} size={12} />{' '}
                      {revenueDelta >= 0 ? '+' : ''}
                      {(revenueDelta * 100).toFixed(1)}%
                    </>
                  )}{' '}
                  <span className="dim" style={{ fontFamily: 'var(--font-sans)' }}>
                    {t('dashboard.vsPrevious', { n: days })}
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
                    ·{' '}
                    <span style={{ display: 'inline-flex', verticalAlign: 'middle', marginRight: 6 }}>
                      <UI.ProductThumb name={a.product || '?'} size={22} src={a.cover} />
                    </span>
                    {a.product}
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
            <h2 className="card-title">{t('dashboard.quickActions.title')}</h2>
          </div>
          <nav
            aria-label={t('dashboard.quickActions.title')}
            className="card-body"
            style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
          >
            {QUICK_ACTIONS.map((q) => (
              <Link
                key={q.key}
                href={q.href}
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
                  <div style={{ fontSize: 'var(--t-base)', fontWeight: 500 }}>
                    {t(`dashboard.quickActions.${q.key}`)}
                  </div>
                  <div style={{ fontSize: 'var(--t-xs)', color: 'var(--fg-tertiary)' }}>
                    {t(`dashboard.quickActions.${q.key}Sub`)}
                  </div>
                </div>
                <Icon name="chevRight" size={14} style={{ color: 'var(--fg-tertiary)' }} />
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <section className="card" aria-labelledby="dash-recent-orders">
        <div className="card-header">
          <div>
            <h2 id="dash-recent-orders" className="card-title">
              {t('dashboard.recentOrders.title')}
            </h2>
            {orders.length > 0 && (
              <div className="card-subtitle">
                {t('dashboard.recentOrders.sub', { count: orders.length })}
              </div>
            )}
          </div>
          <Link href="/admin/orders" className="btn btn-ghost btn-sm">
            {t('dashboard.recentOrders.viewAll')} <Icon name="arrowRight" size={12} />
          </Link>
        </div>
        {orders.length === 0 ? (
          <EmptyState
            icon="receipt"
            title={t('dashboard.recentOrders.emptyTitle')}
            body={t('dashboard.recentOrders.emptyBody')}
          />
        ) : (
          <div className="table-scroll">
            <table className="dt">
              <thead>
                <tr>
                  <th>{t('dashboard.csv.order')}</th>
                  <th>{t('dashboard.csv.customer')}</th>
                  <th className="col-num">{t('dashboard.csv.items')}</th>
                  <th className="col-num">{t('dashboard.csv.total')}</th>
                  <th>{t('dashboard.csv.status')}</th>
                  <th>{t('dashboard.csv.date')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o: any) => (
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
        )}
      </section>
    </div>
  );
}
