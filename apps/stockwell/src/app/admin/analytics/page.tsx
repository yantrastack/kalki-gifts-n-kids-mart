'use client';
import { useEffect, useState } from 'react';
import * as UI from '@/components/ui';
import { jget } from '@/lib/api';

export default function AnalyticsPage() {
  const { fmt, Kpi2, Donut, BarChart } = UI;
  const [data, setData] = useState<any>(null);
  useEffect(() => {
    jget('/api/analytics').then(setData);
  }, []);

  if (!data)
    return (
      <div className="page">
        <div className="page-loading">Loading analytics…</div>
      </div>
    );
  const k = data.kpis;

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Analytics</div>
          <div className="ph-sub">Inventory and sales performance.</div>
        </div>
      </div>

      <div className="kpi-grid kpi-grid-5" style={{ marginBottom: 'var(--s-5)' }}>
        <Kpi2 label="Retail value" value={fmt.moneyCompact(k.retailValue)} sub="stock at retail" />
        <Kpi2 label="Cost value" value={fmt.moneyCompact(k.inventoryValue)} sub="stock at cost" />
        <Kpi2
          label="Avg margin"
          value={fmt.pct(k.avgMargin)}
          sub="across SKUs"
          color="var(--success)"
        />
        <Kpi2 label="Sales booked" value={fmt.moneyCompact(k.salesValue)} sub="all orders" />
        <Kpi2 label="Active SKUs" value={fmt.int(k.skuCount)} sub="in catalog" />
      </div>

      <div className="dash-row-2" style={{ marginBottom: 'var(--s-5)' }}>
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
                  minWidth: 150,
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
                    <span className="mono muted">{fmt.pct(c.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Stock movement volume</div>
              <div className="card-subtitle">Units by type</div>
            </div>
          </div>
          <div className="card-body">
            {data.movementByType.length ? (
              <BarChart data={data.movementByType} height={200} />
            ) : (
              <UI.EmptyState icon="layers" title="No movements yet" />
            )}
          </div>
        </div>
      </div>

      <div className="dash-row-2">
        <div className="card">
          <div className="card-header">
            <div className="card-title">Top products by value</div>
          </div>
          <div className="card-body" style={{ padding: 'var(--s-3) var(--s-5)' }}>
            {data.topProducts.map((p: any, i: number) => (
              <div
                key={i}
                className="spread"
                style={{
                  padding: '8px 0',
                  borderBottom:
                    i < data.topProducts.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div className="row" style={{ gap: 10, minWidth: 0 }}>
                  <span className="muted mono" style={{ fontSize: 11, width: 16 }}>
                    0{i + 1}
                  </span>
                  <span
                    style={{
                      fontSize: 'var(--t-base)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 200,
                    }}
                  >
                    {p.name}
                  </span>
                </div>
                <span className="mono" style={{ fontWeight: 600 }}>
                  {fmt.moneyCompact(p.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <div className="card-title">Top brands by value</div>
          </div>
          <div className="card-body">
            {data.topBrands.length ? (
              <BarChart
                data={data.topBrands.map((b: any) => ({
                  label: b.name.slice(0, 6),
                  value: b.value,
                }))}
                height={200}
                color="var(--chart-2)"
              />
            ) : (
              <UI.EmptyState icon="tag" title="No brands" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
