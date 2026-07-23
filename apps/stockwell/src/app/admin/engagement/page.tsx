'use client';
import { useEffect, useState } from 'react';
import * as UI from '@/components/ui';
import { Icon } from '@/components/Icon';
import { jget } from '@/lib/api';
import { useI18n } from '@/i18n';
import type { EngagementSummary } from '@stockwell/shared';

export default function EngagementPage() {
  const { fmt, Kpi2, ProductThumb } = UI;
  const { t } = useI18n();
  const [data, setData] = useState<EngagementSummary | null>(null);

  useEffect(() => {
    jget('/api/analytics/engagement').then(setData);
  }, []);

  if (!data)
    return (
      <div className="page">
        <div className="page-loading">Loading engagement…</div>
      </div>
    );

  const { totals, products } = data;
  const rate = totals.views ? (totals.likes + totals.shares + totals.buys) / totals.views : 0;
  const maxScore = Math.max(1, ...products.map((p) => p.score));

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">{t('nav.engagement')}</div>
          <div className="ph-sub">Discover reels — how shoppers view, like, share &amp; buy.</div>
        </div>
      </div>

      <div className="kpi-grid kpi-grid-5" style={{ marginBottom: 'var(--s-5)' }}>
        <Kpi2 label="Reach (sessions)" value={fmt.int(totals.sessions)} sub="unique visitors" />
        <Kpi2 label="Views" value={fmt.int(totals.views)} sub="reel impressions" />
        <Kpi2 label="Likes" value={fmt.int(totals.likes)} sub="on Discover" color="#e0466b" />
        <Kpi2
          label="Shares"
          value={fmt.int(totals.shares)}
          sub="sent to friends"
          color="var(--info)"
        />
        <Kpi2
          label="Engagement rate"
          value={fmt.pct(rate)}
          sub="actions ÷ views"
          color="var(--success)"
        />
      </div>

      <div className="table-wrap">
        <div className="table-toolbar">
          <div style={{ fontWeight: 600, fontSize: 'var(--t-sm)' }}>Top products by engagement</div>
          <div className="muted tiny" style={{ marginLeft: 'auto' }}>
            {products.length} products · {fmt.int(totals.buys)} buy taps
          </div>
        </div>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Product</th>
                <th className="col-num">Views</th>
                <th className="col-num">Likes</th>
                <th className="col-num">Shares</th>
                <th className="col-num">Buys</th>
                <th style={{ width: 200 }}>Engagement</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <ProductThumb name={p.name} size={30} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{p.name}</div>
                        <div className="muted tiny">{p.category}</div>
                      </div>
                    </div>
                  </td>
                  <td className="col-num mono">{fmt.int(p.views)}</td>
                  <td className="col-num mono" style={{ color: '#e0466b' }}>
                    {fmt.int(p.likes)}
                  </td>
                  <td className="col-num mono">{fmt.int(p.shares)}</td>
                  <td className="col-num mono" style={{ color: 'var(--success)' }}>
                    {fmt.int(p.buys)}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          flex: 1,
                          height: 6,
                          borderRadius: 999,
                          background: 'var(--bg-muted)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            width: `${Math.round((p.score / maxScore) * 100)}%`,
                            height: '100%',
                            background: 'var(--accent)',
                            borderRadius: 999,
                          }}
                        />
                      </div>
                      <span
                        className="mono tiny muted"
                        style={{ minWidth: 34, textAlign: 'right' }}
                      >
                        {fmt.int(p.score)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div
                      className="muted"
                      style={{
                        padding: 32,
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <Icon name="activity" size={22} />
                      No engagement yet — open the storefront Discover feed to generate activity.
                    </div>
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
