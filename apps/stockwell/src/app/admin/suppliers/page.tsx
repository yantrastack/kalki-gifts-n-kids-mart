'use client';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/Icon';
import * as UI from '@/components/ui';
import { jget, jsend } from '@/lib/api';
import { useI18n } from '@/i18n';
import { useUser } from '@/components/UserContext';
import {
  parseSupplier,
  SUPPLIER_LIMITS,
  type SupplierErrors,
  type SupplierField,
  type SupplierInput,
} from '@/lib/supplierValidation';

const EMPTY_FORM: SupplierInput = { name: '', contact: '', email: '', phone: '' };
const ALL_TOUCHED = { name: true, contact: true, email: true, phone: true };
const FIELDS: {
  key: SupplierField;
  type: string;
  maxLength: number;
  autoComplete: string;
  required: boolean;
}[] = [
  {
    key: 'name',
    type: 'text',
    maxLength: SUPPLIER_LIMITS.nameMax,
    autoComplete: 'organization',
    required: true,
  },
  {
    key: 'contact',
    type: 'text',
    maxLength: SUPPLIER_LIMITS.contactMax,
    autoComplete: 'name',
    required: false,
  },
  {
    key: 'email',
    type: 'email',
    maxLength: SUPPLIER_LIMITS.emailMax,
    autoComplete: 'email',
    required: true,
  },
  { key: 'phone', type: 'tel', maxLength: 20, autoComplete: 'tel', required: true },
];

export default function SuppliersPage() {
  const { fmt, Avatar, Modal, Dropdown, MenuItem, MenuSep, useToast } = UI;
  const { t } = useI18n();
  const toast = useToast();
  const { isAdmin } = useUser();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  // Add/edit share one form: `editing` is the supplier being edited, null when adding.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  // Errors show for a field once it's been blurred, or for all fields after a submit attempt.
  const [touched, setTouched] = useState<Partial<Record<SupplierField, boolean>>>({});
  // Field errors returned by the API (e.g. a name taken meanwhile); cleared when that field changes.
  const [serverErrors, setServerErrors] = useState<SupplierErrors>({});
  const [removing, setRemoving] = useState<any | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Same Zod schema as the API. Duplicates are checked against every *other* supplier,
  // so an edited supplier's own name/email/phone never count against it.
  const parsed = parseSupplier(
    form,
    suppliers.filter((s) => s.id !== editing?.id),
  );
  const { errors } = parsed;

  const load = () =>
    jget('/api/suppliers')
      .then(setSuppliers)
      .catch(() => toast({ message: t('suppliers.loadFailed'), icon: 'alert', type: 'danger' }));
  useEffect(() => {
    load();
  }, []);

  const openForm = (supplier: any | null) => {
    setEditing(supplier);
    setForm(
      supplier
        ? {
            name: supplier.name ?? '',
            contact: supplier.contact ?? '',
            email: supplier.email ?? '',
            phone: supplier.phone ?? '',
          }
        : EMPTY_FORM,
    );
    setTouched({});
    setServerErrors({});
    setFormOpen(true);
  };
  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setTouched({});
    setServerErrors({});
  };
  const setField = (key: SupplierField, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
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
      const body = parsed.data;
      const saved = editing
        ? await jsend(`/api/suppliers/${editing.id}`, 'PUT', body)
        : await jsend('/api/suppliers', 'POST', body);
      toast({
        message: t(editing ? 'suppliers.updated' : 'suppliers.added', { name: saved.name }),
        icon: 'check',
      });
      closeForm();
      load();
    } catch (err: any) {
      if (err.status === 400 && err.body?.errors) {
        setServerErrors(err.body.errors);
        setTouched(ALL_TOUCHED);
      } else if (err.status === 404) {
        toast({ message: t('suppliers.notFound'), icon: 'alert', type: 'danger' });
        closeForm();
        load();
      } else {
        toast({ message: t('suppliers.saveFailed'), icon: 'alert', type: 'danger' });
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!removing || deleting) return;
    setDeleting(true);
    try {
      await jsend(`/api/suppliers/${removing.id}`, 'DELETE');
      toast({ message: t('suppliers.removed', { name: removing.name }), icon: 'trash' });
    } catch (err: any) {
      toast({
        message: t(err.status === 404 ? 'suppliers.notFound' : 'suppliers.removeFailed'),
        icon: 'alert',
        type: 'danger',
      });
    } finally {
      setDeleting(false);
      setRemoving(null);
      load();
    }
  };

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
          <button className="btn btn-primary" onClick={() => openForm(null)}>
            <Icon name="plus" size={14} /> {t('suppliers.add')}
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
              <Dropdown
                trigger={
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 26, height: 26 }}
                    aria-label={t('suppliers.actions')}
                  >
                    <Icon name="more" size={14} />
                  </button>
                }
              >
                <MenuItem icon="edit" label={t('suppliers.edit')} onClick={() => openForm(s)} />
                {isAdmin && <MenuSep />}
                {isAdmin && (
                  <MenuItem
                    icon="trash"
                    label={t('suppliers.remove')}
                    danger
                    onClick={() => setRemoving(s)}
                  />
                )}
              </Dropdown>
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

      <Modal open={formOpen} onClose={closeForm}>
        <form onSubmit={save} noValidate style={{ display: 'contents' }}>
          <div className="modal-header">
            <div className="modal-title">
              {t(editing ? 'suppliers.editTitle' : 'suppliers.add')}
            </div>
            <button type="button" className="icon-btn" onClick={closeForm}>
              <Icon name="x" size={16} />
            </button>
          </div>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {FIELDS.map(({ key, type, maxLength, autoComplete, required }) => {
              const label = t(`suppliers.${key}`);
              const error = touched[key] ? (serverErrors[key] ?? errors[key]) : undefined;
              return (
                <label key={key} className="field">
                  <span>
                    {label}
                    {required && <span className="field-required"> *</span>}
                  </span>
                  <input
                    className="input"
                    type={type}
                    maxLength={maxLength}
                    autoComplete={autoComplete}
                    aria-required={required}
                    aria-invalid={!!error}
                    aria-describedby={error ? `supplier-${key}-error` : undefined}
                    value={form[key]}
                    onChange={(e) => setField(key, e.target.value)}
                    onBlur={() => setTouched((tc) => ({ ...tc, [key]: true }))}
                  />
                  {error && (
                    <span id={`supplier-${key}-error`} className="field-error" role="alert">
                      {t(`suppliers.errors.${error === 'duplicate' ? `duplicate.${key}` : error}`, {
                        field: label,
                        min: SUPPLIER_LIMITS.nameMin,
                        max: maxLength,
                      })}
                    </span>
                  )}
                </label>
              );
            })}
          </div>
          <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={closeForm}>
              {t('suppliers.cancel')}
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Icon name="check" size={14} /> {t(editing ? 'suppliers.save' : 'suppliers.add')}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!removing} onClose={() => !deleting && setRemoving(null)} small>
        <div className="modal-header">
          <div className="modal-title">{t('suppliers.removeTitle')}</div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => setRemoving(null)}
            disabled={deleting}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">
          {t('suppliers.removeBody', { name: removing?.name ?? '' })}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setRemoving(null)}
            disabled={deleting}
          >
            {t('suppliers.cancel')}
          </button>
          <button type="button" className="btn btn-danger" onClick={remove} disabled={deleting}>
            <Icon name="trash" size={14} /> {t('suppliers.remove')}
          </button>
        </div>
      </Modal>
    </div>
  );
}
