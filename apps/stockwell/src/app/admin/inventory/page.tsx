'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget } from '@/lib/api';

export default function InventoryPage() {
  const { fmt, ProductThumb, Kpi2, statusBadge, Avatar } = UI;
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [moves, setMoves] = useState<any[]>([]);
  const [warehouse, setWarehouse] = useState('all');
  const [tab, setTab] = useState('stock');
  const [moveType, setMoveType] = useState('all');

  useEffect(() => {
    jget('/api/products').then(setProducts);
    jget('/api/warehouses').then(setWarehouses);
    jget('/api/stock-moves').then(setMoves);
  }, []);

  const totalOnHand = products.reduce((s, p) => s + p.stock, 0);
  const totalReserved = products.reduce((s, p) => s + p.reserved, 0);
  const totalIncoming = products.reduce((s, p) => s + p.incoming, 0);
  const totalDamaged = products.reduce((s, p) => s + p.damaged, 0);
  const totalValue = products.reduce((s, p) => s + p.stock * p.cost, 0);
  const filtered = products.filter((p) => warehouse === 'all' || p.warehouse === warehouse);
  const fmoves = moves.filter((m) => moveType === 'all' || m.type === moveType);

  const MoveItem = ({ m }: any) => {
    const iconMap: any = {
      add: 'plus',
      remove: 'minus',
      transfer: 'arrowRight',
      sale: 'cart',
      return: 'refresh',
    };
    return (
      <div className="tl-item">
        <div className={`tl-icon ${m.type}`}>
          <Icon name={iconMap[m.type] || 'refresh'} size={12} />
        </div>
        <div className="tl-body">
          <div className="tl-title">
            <span
              style={{ fontWeight: 600, color: m.qty > 0 ? 'var(--success)' : 'var(--danger)' }}
              className="mono"
            >
              {m.qty > 0 ? '+' : ''}
              {m.qty}
            </span>
            <span> · {m.product}</span>
          </div>
          <div
            className="tl-meta"
            style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}
          >
            <Avatar name={m.who} size={18} />
            <span>{m.who}</span>
            <span>·</span>
            <span className="mono">{m.warehouse}</span>
            <span>·</span>
            <span>{m.meta}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Inventory</div>
          <div className="ph-sub">Real-time stock counts and movement across all warehouses.</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-secondary">
            <Icon name="download" size={14} /> Export
          </button>
        </div>
      </div>

      <div className="kpi-grid kpi-grid-5" style={{ marginBottom: 'var(--s-5)' }}>
        <Kpi2 label="On hand" value={fmt.int(totalOnHand)} sub="units across catalog" />
        <Kpi2 label="Reserved" value={fmt.int(totalReserved)} sub="for open orders" />
        <Kpi2 label="Incoming" value={fmt.int(totalIncoming)} sub="from POs" color="var(--info)" />
        <Kpi2
          label="Damaged"
          value={fmt.int(totalDamaged)}
          sub="needs review"
          color="var(--warn)"
        />
        <Kpi2 label="Stock value" value={fmt.moneyCompact(totalValue)} sub="at cost" />
      </div>

      <div className="tabs">
        <div className={`tab ${tab === 'stock' ? 'active' : ''}`} onClick={() => setTab('stock')}>
          Stock levels
        </div>
        <div
          className={`tab ${tab === 'timeline' ? 'active' : ''}`}
          onClick={() => setTab('timeline')}
        >
          Movement timeline
        </div>
      </div>

      {tab === 'stock' && (
        <div className="table-wrap">
          <div className="table-toolbar">
            <select
              className="select"
              style={{ width: 220 }}
              value={warehouse}
              onChange={(e) => setWarehouse(e.target.value)}
            >
              <option value="all">All warehouses</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.id} — {w.name}
                </option>
              ))}
            </select>
          </div>
          <div className="table-scroll">
            <table className="dt">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Warehouse</th>
                  <th className="col-num">On hand</th>
                  <th className="col-num">Reserved</th>
                  <th className="col-num">Incoming</th>
                  <th className="col-num">Available</th>
                  <th className="col-num">Damaged</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="row">
                        <ProductThumb name={p.name} />
                        <div style={{ fontWeight: 500 }}>{p.name}</div>
                      </div>
                    </td>
                    <td className="mono" style={{ fontSize: 'var(--t-sm)' }}>
                      {p.sku}
                    </td>
                    <td className="mono">{p.warehouse}</td>
                    <td
                      className="col-num"
                      style={{
                        fontWeight: 600,
                        color:
                          p.stock === 0
                            ? 'var(--danger)'
                            : p.status === 'low'
                              ? 'var(--warn)'
                              : 'inherit',
                      }}
                    >
                      {fmt.int(p.stock)}
                    </td>
                    <td className="col-num muted">{fmt.int(p.reserved)}</td>
                    <td
                      className="col-num"
                      style={{ color: p.incoming > 0 ? 'var(--info)' : 'var(--fg-tertiary)' }}
                    >
                      {p.incoming > 0 ? `+${fmt.int(p.incoming)}` : '—'}
                    </td>
                    <td className="col-num mono">{fmt.int(Math.max(0, p.stock - p.reserved))}</td>
                    <td
                      className="col-num"
                      style={{ color: p.damaged > 0 ? 'var(--warn)' : 'var(--fg-tertiary)' }}
                    >
                      {p.damaged || '—'}
                    </td>
                    <td>{statusBadge(p.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'timeline' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Stock movement</div>
            <div
              style={{
                display: 'flex',
                background: 'var(--bg-muted)',
                borderRadius: 'var(--r-md)',
                padding: 2,
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              {[
                { id: 'all', label: 'All' },
                { id: 'add', label: 'Added' },
                { id: 'remove', label: 'Removed' },
                { id: 'transfer', label: 'Transfers' },
                { id: 'sale', label: 'Sales' },
                { id: 'return', label: 'Returns' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setMoveType(t.id)}
                  style={{
                    padding: '4px 10px',
                    fontSize: 'var(--t-sm)',
                    fontWeight: 500,
                    borderRadius: 'var(--r-sm)',
                    background: moveType === t.id ? 'var(--bg-elev)' : 'transparent',
                    color: moveType === t.id ? 'var(--fg)' : 'var(--fg-secondary)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <div className="card-body" style={{ padding: '0 var(--s-5) var(--s-4)' }}>
            <div className="tl" style={{ paddingTop: 12 }}>
              {fmoves.map((m) => (
                <MoveItem key={m.id} m={m} />
              ))}
              {fmoves.length === 0 && (
                <UI.EmptyState
                  icon="layers"
                  title="No movements"
                  body="Stock movements will appear here as you adjust inventory."
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
