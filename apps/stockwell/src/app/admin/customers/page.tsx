'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget } from '@/lib/api';

export default function CustomersPage() {
  const { fmt, Avatar } = UI;
  const [customers, setCustomers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  useEffect(() => {
    jget('/api/customers').then(setCustomers);
  }, []);
  const filtered = customers.filter(
    (c) => !query || c.name.toLowerCase().includes(query.toLowerCase()),
  );

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
          <button className="btn btn-primary">
            <Icon name="plus" size={14} /> Add customer
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
              onChange={(e) => setQuery(e.target.value)}
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
                <th className="col-num">Orders</th>
                <th className="col-num">Lifetime spend</th>
                <th className="col-num">Balance</th>
                <th>Last order</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
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
                  <td className="col-num">{c.orders}</td>
                  <td className="col-num mono">{fmt.money(c.spend)}</td>
                  <td
                    className="col-num mono"
                    style={{ color: c.balance > 0 ? 'var(--danger)' : 'var(--fg-tertiary)' }}
                  >
                    {c.balance > 0 ? fmt.money(c.balance) : '—'}
                  </td>
                  <td className="muted">{c.lastOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
