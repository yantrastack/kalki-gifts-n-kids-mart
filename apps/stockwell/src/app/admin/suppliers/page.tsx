'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget } from '@/lib/api';

export default function SuppliersPage() {
  const { fmt, Avatar } = UI;
  const [suppliers, setSuppliers] = useState<any[]>([]);
  useEffect(() => {
    jget('/api/suppliers').then(setSuppliers);
  }, []);
  const totalSpend = suppliers.reduce((s, x) => s + x.spend, 0);
  const avgOnTime = suppliers.length
    ? suppliers.reduce((s, x) => s + x.onTime, 0) / suppliers.length
    : 0;

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Suppliers</div>
          <div className="ph-sub">
            {suppliers.length} vendors · {fmt.moneyCompact(totalSpend)} total spend ·{' '}
            {fmt.pct(avgOnTime)} avg on-time
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-primary">
            <Icon name="plus" size={14} /> Add supplier
          </button>
        </div>
      </div>
      <div className="card-grid">
        {suppliers.map((s) => (
          <div key={s.id} className="card" style={{ padding: 'var(--s-4)' }}>
            <div className="row" style={{ gap: 12, marginBottom: 12 }}>
              <Avatar name={s.name} size={40} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div className="muted tiny">{s.contact}</div>
              </div>
            </div>
            <dl className="dp-kv" style={{ fontSize: 'var(--t-sm)' }}>
              <dt>Email</dt>
              <dd className="mono" style={{ fontSize: 'var(--t-xs)' }}>
                {s.email}
              </dd>
              <dt>Phone</dt>
              <dd className="mono">{s.phone}</dd>
              <dt>On-time</dt>
              <dd>
                <span
                  style={{
                    color: s.onTime >= 0.9 ? 'var(--success)' : 'var(--warn)',
                    fontWeight: 600,
                  }}
                >
                  {fmt.pct(s.onTime)}
                </span>
              </dd>
              <dt>Total spend</dt>
              <dd className="mono" style={{ fontWeight: 600 }}>
                {fmt.money(s.spend)}
              </dd>
              <dt>Last order</dt>
              <dd>{s.lastOrder}</dd>
            </dl>
          </div>
        ))}
      </div>
    </div>
  );
}
