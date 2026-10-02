'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { useI18n } from '@/i18n';
import { jget } from '@/lib/api';
import { downloadCsv } from '@/lib/csv';

export default function InventoryPage() {
  const { fmt, ProductThumb, Kpi2, statusBadge, Avatar } = UI;
  const { t } = useI18n();
  const [products, setProducts] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [moves, setMoves] = useState<any[]>([]);
  const [warehouse, setWarehouse] = useState('all');
  const [tab, setTab] = useState('stock');
  const [moveType, setMoveType] = useState('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  // Any filter change goes back to page 1.
  const changeWarehouse = (v: string) => {
    setWarehouse(v);
    setPage(1);
  };
  const changeQuery = (v: string) => {
    setQuery(v);
    setPage(1);
  };

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
  const q = query.trim().toLowerCase();
  const filtered = products.filter(
    (p) =>
      (warehouse === 'all' || p.warehouse === warehouse) &&
      (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)),
  );
  // Client-side paging, as on Products; the KPI totals above still use the full list.
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page - 1) * pageSize, page * pageSize);
  // Up to 5 page buttons, centred on the current page.
  const firstPage = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pageNums = Array.from({ length: Math.min(5, totalPages) }, (_, i) => firstPage + i);
  const fmoves = moves.filter((m) => moveType === 'all' || m.type === moveType);

  // t() echoes the key when a string is missing — fall back to the raw status code then.
  const statusLabel = (s: string) => {
    const key = `inventory.status.${s}`;
    const label = t(key);
    return label === key ? s : label;
  };

  // Exports the Stock levels view, honouring the warehouse filter.
  const exportCsv = () => {
    const cols = [
      'product',
      'sku',
      'warehouse',
      'onHand',
      'reserved',
      'incoming',
      'available',
      'damaged',
      'status',
    ];
    const rows = filtered.map((p) => [
      p.name,
      p.sku,
      p.warehouse,
      p.stock,
      p.reserved,
      p.incoming,
      Math.max(0, p.stock - p.reserved),
      p.damaged,
      statusLabel(p.status),
    ]);
    const date = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD, local time
    downloadCsv(
      `inventory-${warehouse}-${date}.csv`,
      cols.map((c) => t(`inventory.col.${c}`)),
      rows,
    );
  };

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
          <button className="btn btn-secondary" onClick={exportCsv} disabled={!filtered.length}>
            <Icon name="download" size={14} /> {t('inventory.export')}
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
            <div className="input-group" style={{ width: 280 }}>
              <Icon name="search" size={14} style={{ color: 'var(--fg-tertiary)' }} />
              <input
                placeholder={t('inventory.search')}
                aria-label={t('inventory.search')}
                value={query}
                onChange={(e) => changeQuery(e.target.value)}
              />
              {query && (
                <button
                  type="button"
                  className="icon-btn"
                  style={{ width: 20, height: 20 }}
                  aria-label={t('inventory.clearSearch')}
                  onClick={() => changeQuery('')}
                >
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
            <UI.Select
              style={{ width: 220 }}
              aria-label={t('inventory.warehouseFilter')}
              value={warehouse}
              onChange={changeWarehouse}
              options={[
                { value: 'all', label: 'All warehouses' },
                ...warehouses.map((w) => ({ value: w.id, label: `${w.id} — ${w.name}` })),
              ]}
            />
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
                {pageItems.map((p) => (
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
                {products.length > 0 && pageItems.length === 0 && (
                  <tr>
                    <td colSpan={9}>
                      <UI.EmptyState
                        icon="search"
                        title={t('inventory.noMatch')}
                        body={t('inventory.noMatchBody')}
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <nav
            aria-label={t('inventory.pagination')}
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              padding: '12px 16px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: 'var(--t-sm)',
            }}
          >
            <span className="muted">
              {t('inventory.showing', {
                from: fmt.int(Math.min((page - 1) * pageSize + 1, filtered.length)),
                to: fmt.int(Math.min(page * pageSize, filtered.length)),
                total: fmt.int(filtered.length),
              })}
            </span>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                className="btn btn-ghost btn-sm"
                disabled={page === 1}
                onClick={() => setPage((n) => n - 1)}
              >
                <Icon name="chevLeft" size={12} /> {t('inventory.prev')}
              </button>
              {pageNums.map((n) => (
                <button
                  key={n}
                  className={`btn btn-sm ${page === n ? 'btn-secondary' : 'btn-ghost'}`}
                  aria-current={page === n ? 'page' : undefined}
                  onClick={() => setPage(n)}
                  style={{ minWidth: 30, justifyContent: 'center' }}
                >
                  {n}
                </button>
              ))}
              <button
                className="btn btn-ghost btn-sm"
                disabled={page === totalPages}
                onClick={() => setPage((n) => n + 1)}
              >
                {t('inventory.next')} <Icon name="chevRight" size={12} />
              </button>
            </div>
          </nav>
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
