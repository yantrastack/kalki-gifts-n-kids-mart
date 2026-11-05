'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { useI18n } from '@/i18n';
import CustomerFormModal from '@/components/CustomerFormModal';
import { jget } from '@/lib/api';

// Same page size as the Inventory table's pager.
const PAGE_SIZE = 10;
export default function CustomersPage() {
  const { fmt, Avatar } = UI;
  const { t } = useI18n();
  const [customers, setCustomers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  useEffect(() => {
    jget('/api/customers').then(setCustomers);
  }, []);

  const openForm = () => setFormOpen(true);
  const onCreated = (row: any) => {
    setCustomers((cs) => [row, ...cs]);
    // The new customer is prepended; jump to page 1 so it's visible.
    setPage(1);
  };
  const filtered = customers.filter(
    (c) => !query || c.name.toLowerCase().includes(query.toLowerCase()),
  );
  // Client-side paging over the *filtered* list, so search always covers every
  // customer. Clamped so the page stays valid when the list shrinks under it.
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const pageItems = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  // Up to 5 page buttons, centred on the current page.
  const firstPage = Math.max(1, Math.min(current - 2, totalPages - 4));
  const pageNums = Array.from({ length: Math.min(5, totalPages) }, (_, i) => firstPage + i);

  return (
    <div className="page">
      <div className="ph">
        <div>
          <div className="ph-title">Customers</div>
          <div className="ph-sub">
            {customers.length} customers ·{' '}
            {fmt.moneyCompact(customers.reduce((s, c) => s + c.spend, 0))} lifetime spend
          </div>
        </div>
        <div className="ph-actions">
          <button type="button" className="btn btn-primary" onClick={openForm}>
            <Icon name="plus" size={14} /> {t('customers.add')}
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <div className="table-toolbar">
          <div className="input-group" style={{ width: 280 }}>
            <Icon name="search" size={14} style={{ color: 'var(--fg-tertiary)' }} />
            <input
              placeholder="Search customers"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        <div className="table-scroll">
          <table className="dt">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Type</th>
                <th>Email</th>
                <th className="col-num col-mid">Orders</th>
                <th className="col-num col-mid">Lifetime spend</th>
                <th className="col-num col-mid">Balance</th>
                <th className="col-mid">Last order</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="row" style={{ gap: 10 }}>
                      <Avatar name={c.name} color={c.color} size={30} />
                      <div style={{ fontWeight: 500 }}>{c.name}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${c.type === 'business' ? 'badge-info' : ''}`}>
                      <span className="badge-dot" />
                      {c.type}
                    </span>
                  </td>
                  <td className="muted" style={{ fontSize: 'var(--t-sm)' }}>
                    {c.email}
                  </td>
                  <td className="col-mid">{c.orders}</td>
                  <td className="col-mid mono">{fmt.money(c.spend)}</td>
                  <td
                    className="col-mid mono"
                    style={{ color: c.balance > 0 ? 'var(--danger)' : 'var(--fg-tertiary)' }}
                  >
                    {c.balance > 0 ? fmt.money(c.balance) : '—'}
                  </td>
                  <td className="muted col-mid">{c.lastOrder}</td>
                </tr>
              ))}
              {query && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="muted" style={{ textAlign: 'center', padding: 32 }}>
                    {t('customers.noMatch')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <nav
          aria-label={t('customers.pagination')}
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
            {t('customers.showing', {
              from: fmt.int(Math.min((current - 1) * PAGE_SIZE + 1, filtered.length)),
              to: fmt.int(Math.min(current * PAGE_SIZE, filtered.length)),
              total: fmt.int(filtered.length),
            })}
          </span>
          <div
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
            >
              <Icon name="chevLeft" size={12} /> {t('customers.prev')}
            </button>
            {pageNums.map((n) => (
              <button
                type="button"
                key={n}
                className={`btn btn-sm ${current === n ? 'btn-secondary' : 'btn-ghost'}`}
                aria-current={current === n ? 'page' : undefined}
                onClick={() => setPage(n)}
                style={{ minWidth: 30, justifyContent: 'center' }}
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={current === totalPages}
              onClick={() => setPage(current + 1)}
            >
              {t('customers.next')} <Icon name="chevRight" size={12} />
            </button>
          </div>
        </nav>
      </div>

      <CustomerFormModal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        customers={customers}
        onCreated={onCreated}
      />
    </div>
  );
}
