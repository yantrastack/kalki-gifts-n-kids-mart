'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { useI18n } from '@/i18n';
import { jget, jsend } from '@/lib/api';
import {
  CUSTOMER_LIMITS,
  type CustomerErrors,
  type CustomerField,
  parseCustomer,
} from '@/lib/customerValidation';

const EMPTY_FORM: Record<CustomerField, string> = {
  name: '',
  type: 'business',
  email: '',
  phone: '',
  address: '',
};
// Same page size as the Inventory table's pager.
const PAGE_SIZE = 10;
const ALL_TOUCHED ={ name: true, type: true, email: true, phone: true, address: true };
const TEXT_FIELDS: {
  key: Exclude<CustomerField, 'name' | 'type'>;
  type: string;
  maxLength: number;
  autoComplete: string;
}[] = [
  { key: 'email', type: 'email', maxLength: CUSTOMER_LIMITS.emailMax, autoComplete: 'email' },
  { key: 'phone', type: 'tel', maxLength: CUSTOMER_LIMITS.phoneMax, autoComplete: 'tel' },
  {
    key: 'address',
    type: 'text',
    maxLength: CUSTOMER_LIMITS.addressMax,
    autoComplete: 'street-address',
  },
];

export default function CustomersPage() {
  const { fmt, Avatar, Modal, useToast } = UI;
  const { t } = useI18n();
  const toast = useToast();
  const [customers, setCustomers] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  // A field's error shows once the user has changed or left it, or for every field
  // after a submit attempt — never on a pristine form.
  const [touched, setTouched] = useState<Partial<Record<CustomerField, boolean>>>({});
  // Field errors returned by the API; cleared when that field changes.
  const [serverErrors, setServerErrors] = useState<CustomerErrors>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    jget('/api/customers').then(setCustomers);
  }, []);

  // Same Zod schema as the API, re-run on every render so errors track the input live.
  // Duplicates are checked against the loaded customers here; the API re-checks the DB.
  const parsed = parseCustomer(form, customers);
  const errorFor = (key: CustomerField) =>
    touched[key] ? (serverErrors[key] ?? parsed.errors[key]) : undefined;
  const errorText = (key: CustomerField, maxLength: number) => {
    const error = errorFor(key);
    return error
      ? t(`customers.errors.${error === 'duplicate' ? `duplicate.${key}` : error}`, {
          field: t(`customers.${key}`),
          max: maxLength,
        })
      : null;
  };

  const openForm = () => {
    setForm(EMPTY_FORM);
    setTouched({});
    setServerErrors({});
    setFormOpen(true);
  };
  const closeForm = () => {
    if (!saving) setFormOpen(false);
  };
  const touch = (key: CustomerField) => setTouched((tc) => ({ ...tc, [key]: true }));
  const setField = (key: CustomerField, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    touch(key);
    setServerErrors(({ [key]: _, ...rest }) => rest);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!parsed.data) {
      setTouched(ALL_TOUCHED);
      return;
    }
    setSaving(true);
    try {
      const row = await jsend('/api/customers', 'POST', parsed.data);
      setCustomers((cs) => [row, ...cs]);
      // The new customer is prepended; jump to page 1 so it's visible.
      setPage(1);
      toast({ message: t('customers.added', { name: row.name }), icon: 'check' });
      setFormOpen(false);
    } catch (err: any) {
      if (err.status === 400 && err.body?.errors) {
        setServerErrors(err.body.errors);
        setTouched(ALL_TOUCHED);
      } else toast({ message: t('customers.saveFailed'), icon: 'alert', type: 'danger' });
    } finally {
      setSaving(false);
    }
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
                <th className="col-num">Orders</th>
                <th className="col-num">Lifetime spend</th>
                <th className="col-num">Balance</th>
                <th>Last order</th>
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

      <Modal open={formOpen} onClose={closeForm}>
        <form onSubmit={save} noValidate style={{ display: 'contents' }}>
          <div className="modal-header">
            <div className="modal-title">{t('customers.add')}</div>
            <button type="button" className="icon-btn" onClick={closeForm}>
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="field">
              <span>
                {t('customers.name')}
                <span className="field-required"> *</span>
              </span>
              <input
                className="input"
                autoComplete="name"
                maxLength={CUSTOMER_LIMITS.nameMax}
                aria-required
                aria-invalid={!!errorFor('name')}
                aria-describedby={errorFor('name') ? 'customer-name-error' : undefined}
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                onBlur={() => touch('name')}
              />
              {errorFor('name') && (
                <span id="customer-name-error" className="field-error" role="alert">
                  {errorText('name', CUSTOMER_LIMITS.nameMax)}
                </span>
              )}
            </label>
            <div className="field">
              <span>{t('customers.type')}</span>
              <UI.Select
                aria-label={t('customers.type')}
                value={form.type}
                onChange={(v) => setField('type', v)}
                options={[
                  { value: 'business', label: t('customers.business') },
                  { value: 'individual', label: t('customers.individual') },
                ]}
              />
              {errorFor('type') && (
                <span className="field-error" role="alert">
                  {errorText('type', 0)}
                </span>
              )}
            </div>
            {TEXT_FIELDS.map(({ key, type, maxLength, autoComplete }) => {
              const error = errorFor(key);
              return (
                <label key={key} className="field">
                  <span>{t(`customers.${key}`)}</span>
                  <input
                    className="input"
                    type={type}
                    maxLength={maxLength}
                    autoComplete={autoComplete}
                    aria-invalid={!!error}
                    aria-describedby={error ? `customer-${key}-error` : undefined}
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    onBlur={() => touch(key)}
                  />
                  {error && (
                    <span id={`customer-${key}-error`} className="field-error" role="alert">
                      {errorText(key, maxLength)}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeForm}
              disabled={saving}
            >
              {t('customers.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Icon name="check" size={14} /> {t('customers.add')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
