'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget } from '@/lib/api';

export default function WarehousesPage() {
  const { fmt } = UI;
  const [warehouses, setWarehouses] = useState<any[]>([]);
  useEffect(() => {
    jget('/api/warehouses').then(setWarehouses);
  }, []);

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Warehouses</div>
          <div className="ph-sub">
            {warehouses.length} locations ·{' '}
            {fmt.int(warehouses.reduce((s, w) => s + w.products, 0))} product lines
          </div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-primary">
            <Icon name="plus" size={14} /> Add warehouse
          </button>
        </div>
      </div>
      <div className="card-grid">
        {warehouses.map((w) => (
          <div key={w.id} className="card" style={{ padding: 'var(--s-4)' }}>
            <div className="spread" style={{ marginBottom: 12 }}>
              <div className="row" style={{ gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: 'var(--bg-muted)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--accent)',
                  }}
                >
                  <Icon name="warehouse" size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600 }}>{w.name}</div>
                  <div className="muted tiny mono">
                    {w.id} · {w.city}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div className="spread" style={{ marginBottom: 6 }}>
                <span className="muted tiny">Capacity</span>
                <span className="mono" style={{ fontWeight: 600 }}>
                  {fmt.pct(w.capacity)}
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: 'var(--bg-muted)',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${w.capacity * 100}%`,
                    background: w.capacity > 0.7 ? 'var(--warn)' : 'var(--accent)',
                    borderRadius: 999,
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
              <div>
                <div className="muted tiny">Products</div>
                <div className="mono" style={{ fontWeight: 600 }}>
                  {fmt.int(w.products)}
                </div>
              </div>
              <div>
                <div className="muted tiny">Stock value</div>
                <div className="mono" style={{ fontWeight: 600 }}>
                  {fmt.moneyCompact(w.value)}
                </div>
              </div>
              <div>
                <div className="muted tiny">Staff</div>
                <div className="mono" style={{ fontWeight: 600 }}>
                  {w.staff}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
